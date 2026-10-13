import { SubjectCategory } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { checkRole, explainDenial, isUnavailable, type SessionDenial } from "@/lib/session";
import {
  DEFAULT_CATALOGUE,
  SUBJECT_ADMIN_ROLES,
  listSubjects,
  syncCompulsorySubjects,
  upsertSubject,
} from "@/lib/subjects";

export const dynamic = "force-dynamic";

/**
 * A 401 that says why.
 *
 * This route 401'd in production and the response gave nothing to act on.
 * requireRole() returns null for six different reasons, and three of them
 * (revoked tokenVersion, inactive account, suspended account) are enforced
 * ONLY here and not in middleware -- which is why the page loads fine while
 * every button on it fails.
 *
 * The reason also goes in a header, so it is visible in the network tab
 * without parsing the body or making a second request.
 */
function unauthorized(denial: { reason: SessionDenial; role?: string }) {
  // A database outage is not an authorisation failure. Answering 401 would
  // tell a legitimate signed-in admin their credentials are wrong and send
  // them to re-authenticate, which cannot help. 503 + Retry-After is the
  // truth, and keeps the client's retry logic correct.
  const unavailable = isUnavailable(denial.reason);

  return NextResponse.json(
    {
      error: explainDenial(denial.reason),
      code: denial.reason,
      role: denial.role ?? null,
      hint: "GET /api/auth/whoami for the full picture.",
    },
    {
      status: unavailable ? 503 : 401,
      headers: unavailable
        ? { "x-auth-denied": denial.reason, "Retry-After": "5" }
        : { "x-auth-denied": denial.reason },
    },
  );
}

const upsertSchema = z.object({
  level: z.string().trim().min(2).max(10),
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().max(12).nullable().optional(),
  category: z.nativeEnum(SubjectCategory),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SEED_DEFAULTS"), level: z.string().trim().min(2).max(10) }),
  z.object({
    action: z.literal("SYNC_COMPULSORY"),
    level: z.string().trim().min(2).max(10).optional(),
  }),
]);

export async function GET(request: NextRequest) {
  const auth = await checkRole(SUBJECT_ADMIN_ROLES);
  if (!auth.ok) return unauthorized(auth);
  const user = auth.user;

  const level = request.nextUrl.searchParams.get("level") || undefined;

  const [subjects, levels] = await Promise.all([
    listSubjects(user.schoolId, level),
    prisma.schoolClass.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      select: { level: true },
      distinct: ["level"],
      orderBy: { level: "asc" },
    }),
  ]);

  return NextResponse.json({
    selectedLevel: level ?? null,
    levels: levels.map((l) => l.level),
    hasDefaultsFor: Object.keys(DEFAULT_CATALOGUE),
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      level: s.level,
      category: s.category,
      studentCount: s._count.enrolments,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await checkRole(SUBJECT_ADMIN_ROLES);
  if (!auth.ok) return unauthorized(auth);
  const user = auth.user;

  let input: z.infer<typeof upsertSchema>;
  try {
    input = upsertSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Provide a level, name and category." }, { status: 400 });
  }

  const subject = await upsertSubject({
    schoolId: user.schoolId,
    level: input.level.toUpperCase(),
    name: input.name,
    code: input.code ?? null,
    category: input.category,
  });

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "SUBJECT_SAVED",
      entityType: "Subject",
      entityId: subject.id,
      ipAddress: getClientIp(request),
      metadata: { name: subject.name, level: subject.level, category: subject.category },
    },
  });

  return NextResponse.json({ ok: true, subject }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await checkRole(SUBJECT_ADMIN_ROLES);
  if (!auth.ok) return unauthorized(auth);
  const user = auth.user;

  let input: z.infer<typeof actionSchema>;
  try {
    input = actionSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  if (input.action === "SEED_DEFAULTS") {
    const level = input.level.toUpperCase();
    const template = DEFAULT_CATALOGUE[level];
    if (!template) {
      return NextResponse.json(
        { error: `No default catalogue for ${level}. Add subjects manually.` },
        { status: 400 },
      );
    }
    for (const entry of template) {
      await upsertSubject({
        schoolId: user.schoolId,
        level,
        name: entry.name,
        category: entry.category,
      });
    }
    return NextResponse.json({
      ok: true,
      message: `${template.length} subject(s) added for ${level}. Edit or remove any that do not apply.`,
    });
  }

  // Auto-enrol every student at the level into its compulsory subjects.
  // Electives are never touched — nobody should be assigned a subject they
  // did not choose.
  const result = await syncCompulsorySubjects(user.schoolId, input.level?.toUpperCase());
  return NextResponse.json({
    ok: true,
    ...result,
    message: `${result.created} compulsory enrolment(s) created.`,
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await checkRole(SUBJECT_ADMIN_ROLES);
  if (!auth.ok) return unauthorized(auth);
  const user = auth.user;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing subject id." }, { status: 400 });

  const subject = await prisma.subject.findFirst({ where: { id, schoolId: user.schoolId } });
  if (!subject) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Retire rather than delete: gradebooks and exams reference it, and its
  // enrolment rows are a record of what students were taught.
  await prisma.subject.update({ where: { id }, data: { isActive: false } });

  return NextResponse.json({ ok: true, message: `${subject.name} retired.` });
}
