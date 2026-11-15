import { NewsAudience, UserRole, type Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireModule } from "@/lib/module-guard";
import { notifyDirectorsOfPublishedSchoolEvent } from "@/lib/director-notifications";
import {
  getEligiblePublicationWhatsAppRecipients,
  isPublicationWhatsAppConfigured,
  newsAudienceLabel,
  publicationPortalUrl,
  publicationWhatsAppJobData,
  resolveNewsAudienceRecipients,
} from "@/lib/news-publications";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR];

function slugify(title: string) {
  return `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)}-${Date.now().toString(36)}`;
}

const audienceSchema = z.nativeEnum(NewsAudience).default(NewsAudience.PUBLIC);

const publicationSchema = z
  .object({
    title: z.string().trim().min(4).max(180),
    category: z.string().trim().min(2).max(40),
    excerpt: z.string().trim().min(10).max(300),
    content: z.string().trim().min(20).max(20_000),
    publish: z.boolean().optional(),
    audience: audienceSchema,
    targetClassId: z.string().trim().min(1).nullable().optional(),
    parentProfileIds: z.array(z.string().trim().min(1)).max(500).optional(),
  })
  .superRefine((value, context) => {
    const parentIds = value.parentProfileIds ?? [];
    if (new Set(parentIds).size !== parentIds.length) {
      context.addIssue({
        code: "custom",
        path: ["parentProfileIds"],
        message: "Remove duplicate parents.",
      });
    }
    if (value.audience === NewsAudience.CLASS_PARENTS && !value.targetClassId) {
      context.addIssue({ code: "custom", path: ["targetClassId"], message: "Choose a class." });
    }
    if (value.audience === NewsAudience.SELECTED_PARENTS && parentIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["parentProfileIds"],
        message: "Select at least one parent.",
      });
    }
  });

const patchSchema = z.object({
  postId: z.string().trim().min(1),
  action: z.enum(["PUBLISH", "UNPUBLISH", "DELETE"]),
});

async function cancelPendingPublicationJobs(tx: Prisma.TransactionClient, postId: string) {
  await tx.notificationJob.updateMany({
    where: {
      dedupeKey: { startsWith: `parent-publication:${postId}:` },
      status: "PENDING",
    },
    data: {
      status: "SKIPPED",
      lastError: "Publication was unpublished or deleted before dispatch.",
    },
  });
}

async function notifyPublicationParents(
  tx: Prisma.TransactionClient,
  post: {
    id: string;
    schoolId: string;
    audience: NewsAudience;
    targetClassId: string | null;
    title: string;
    excerpt: string;
  },
  publicationRevision: string,
  selectedParentProfileIds?: string[],
) {
  const recipients = await resolveNewsAudienceRecipients(tx, {
    schoolId: post.schoolId,
    audience: post.audience,
    targetClassId: post.targetClassId,
    parentProfileIds: selectedParentProfileIds,
  });

  if (recipients.length) {
    await tx.newsPostRecipient.createMany({
      data: recipients.map((recipient) => ({
        schoolId: post.schoolId,
        newsPostId: post.id,
        parentProfileId: recipient.id,
      })),
      skipDuplicates: true,
    });
  }

  const whatsappRecipients = await getEligiblePublicationWhatsAppRecipients(
    tx,
    post.schoolId,
    recipients,
  );
  if (whatsappRecipients.length) {
    await tx.notificationJob.createMany({
      data: whatsappRecipients.map((recipient) =>
        publicationWhatsAppJobData({
          schoolId: post.schoolId,
          postId: post.id,
          publicationRevision,
          title: post.title,
          excerpt: post.excerpt,
          portalUrl: publicationPortalUrl(post.id),
          recipient,
        }),
      ),
      skipDuplicates: true,
    });
  }

  return { recipientCount: recipients.length, whatsappQueued: whatsappRecipients.length };
}

export async function GET() {
  const guard = await requireModule("news", ADMIN_ROLES);
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const posts = await prisma.newsPost.findMany({
    take: 500,
    where: { schoolId: user.schoolId },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { name: true } },
      targetClass: { select: { displayName: true } },
      _count: { select: { recipients: true } },
    },
  });

  return NextResponse.json({
    posts: posts.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      category: post.category,
      excerpt: post.excerpt,
      content: post.content,
      isPublished: post.isPublished,
      publishedAt: post.publishedAt?.toISOString() || null,
      audience: post.audience,
      audienceLabel: newsAudienceLabel(post.audience),
      targetClassName: post.targetClass?.displayName ?? null,
      recipientCount: post._count.recipients,
      authorName: post.author?.name || "—",
      createdAt: post.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const guard = await requireModule("news", ADMIN_ROLES);
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const limit = await enforceRateLimit("newsPost", user.id);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many news posts. Please wait before posting again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let payload: z.infer<typeof publicationSchema>;
  try {
    payload = publicationSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? error.issues[0]?.message || "Invalid post." : "Invalid post.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (payload.audience === NewsAudience.CLASS_PARENTS) {
        await resolveNewsAudienceRecipients(tx, {
          schoolId: user.schoolId,
          audience: payload.audience,
          targetClassId: payload.targetClassId,
        });
      }

      const publicationRevision = payload.publish ? new Date().toISOString() : "";
      const post = await tx.newsPost.create({
        data: {
          schoolId: user.schoolId,
          authorUserId: user.id,
          title: payload.title,
          slug: slugify(payload.title),
          category: payload.category,
          excerpt: payload.excerpt,
          content: payload.content,
          audience: payload.audience,
          targetClassId:
            payload.audience === NewsAudience.CLASS_PARENTS ? payload.targetClassId : null,
          isPublished: Boolean(payload.publish),
          publishedAt: payload.publish ? new Date(publicationRevision) : null,
        },
        select: {
          id: true,
          schoolId: true,
          audience: true,
          targetClassId: true,
          title: true,
          excerpt: true,
        },
      });

      let delivery = { recipientCount: 0, whatsappQueued: 0 };
      if (payload.audience === NewsAudience.SELECTED_PARENTS) {
        const recipients = await resolveNewsAudienceRecipients(tx, {
          schoolId: user.schoolId,
          audience: payload.audience,
          parentProfileIds: payload.parentProfileIds,
        });
        if (recipients.length) {
          await tx.newsPostRecipient.createMany({
            data: recipients.map((recipient) => ({
              schoolId: user.schoolId,
              newsPostId: post.id,
              parentProfileId: recipient.id,
            })),
            skipDuplicates: true,
          });
        }
        if (payload.publish) {
          delivery = await notifyPublicationParents(
            tx,
            post,
            publicationRevision,
            payload.parentProfileIds,
          );
        }
      } else if (payload.publish && payload.audience !== NewsAudience.PUBLIC) {
        delivery = await notifyPublicationParents(tx, post, publicationRevision);
      }

      await tx.auditLog.create({
        data: {
          schoolId: user.schoolId,
          actorUserId: user.id,
          action: payload.publish ? "NEWS_POST_PUBLISHED" : "NEWS_POST_DRAFTED",
          entityType: "NewsPost",
          entityId: post.id,
          metadata: {
            title: post.title,
            audience: post.audience,
            targetClassId: post.targetClassId,
            recipientCount: delivery.recipientCount,
            whatsappQueued: delivery.whatsappQueued,
          },
          ipAddress: getClientIp(request),
        },
      });

      return { postId: post.id, ...delivery };
    });

    if (payload.publish && payload.category.toLowerCase() === "events") {
      await notifyDirectorsOfPublishedSchoolEvent({
        schoolId: user.schoolId,
        title: payload.title,
        actorUserId: user.id,
      });
    }

    const templateConfigured = isPublicationWhatsAppConfigured();
    return NextResponse.json({
      ok: true,
      message: payload.publish ? "Publication published." : "Draft saved.",
      ...result,
      whatsappTemplateConfigured: templateConfigured,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save publication." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireModule("news", ADMIN_ROLES);
  if (!guard.ok) return guard.response;
  const user = guard.user;

  let payload: z.infer<typeof patchSchema>;
  try {
    payload = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const post = await prisma.newsPost.findFirst({
    where: { id: payload.postId, schoolId: user.schoolId },
    select: {
      id: true,
      schoolId: true,
      title: true,
      excerpt: true,
      category: true,
      audience: true,
      targetClassId: true,
      isPublished: true,
    },
  });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  if (payload.action === "DELETE") {
    await prisma.$transaction(async (tx) => {
      await cancelPendingPublicationJobs(tx, post.id);
      await tx.newsPost.delete({ where: { id: post.id } });
      await tx.auditLog.create({
        data: {
          schoolId: user.schoolId,
          actorUserId: user.id,
          action: "NEWS_POST_DELETED",
          entityType: "NewsPost",
          entityId: post.id,
          metadata: { title: post.title },
          ipAddress: getClientIp(request),
        },
      });
    });
    return NextResponse.json({ ok: true, message: "Post deleted." });
  }

  if (payload.action === "UNPUBLISH") {
    const changed = await prisma.$transaction(async (tx) => {
      const update = await tx.newsPost.updateMany({
        where: { id: post.id, schoolId: user.schoolId, isPublished: true },
        data: { isPublished: false, publishedAt: null },
      });
      if (update.count !== 1) return false;
      await cancelPendingPublicationJobs(tx, post.id);
      await tx.auditLog.create({
        data: {
          schoolId: user.schoolId,
          actorUserId: user.id,
          action: "NEWS_POST_UNPUBLISHED",
          entityType: "NewsPost",
          entityId: post.id,
          metadata: { title: post.title },
          ipAddress: getClientIp(request),
        },
      });
      return true;
    });
    if (!changed)
      return NextResponse.json({ error: "Post is already unpublished." }, { status: 409 });
    return NextResponse.json({ ok: true, message: "Post unpublished." });
  }

  if (post.isPublished)
    return NextResponse.json({ error: "Post is already published." }, { status: 409 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const publishedAt = new Date();
      const publicationRevision = publishedAt.toISOString();
      const claimed = await tx.newsPost.updateMany({
        where: { id: post.id, schoolId: user.schoolId, isPublished: false },
        data: { isPublished: true, publishedAt },
      });
      if (claimed.count !== 1) throw new Error("Post state changed; refresh and try again.");

      let selectedParentProfileIds: string[] | undefined;
      if (post.audience === NewsAudience.SELECTED_PARENTS) {
        const savedRecipients = await tx.newsPostRecipient.findMany({
          where: { schoolId: user.schoolId, newsPostId: post.id },
          select: { parentProfileId: true },
        });
        selectedParentProfileIds = savedRecipients.map((recipient) => recipient.parentProfileId);
      }
      const delivery =
        post.audience === NewsAudience.PUBLIC
          ? { recipientCount: 0, whatsappQueued: 0 }
          : await notifyPublicationParents(tx, post, publicationRevision, selectedParentProfileIds);

      await tx.auditLog.create({
        data: {
          schoolId: user.schoolId,
          actorUserId: user.id,
          action: "NEWS_POST_PUBLISHED",
          entityType: "NewsPost",
          entityId: post.id,
          metadata: {
            title: post.title,
            audience: post.audience,
            targetClassId: post.targetClassId,
            recipientCount: delivery.recipientCount,
            whatsappQueued: delivery.whatsappQueued,
          },
          ipAddress: getClientIp(request),
        },
      });
      return delivery;
    });

    if (post.category.toLowerCase() === "events") {
      await notifyDirectorsOfPublishedSchoolEvent({
        schoolId: user.schoolId,
        title: post.title,
        actorUserId: user.id,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Publication published.",
      ...result,
      whatsappTemplateConfigured: isPublicationWhatsAppConfigured(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to publish post." },
      { status: 409 },
    );
  }
}
