import { NextRequest } from "next/server";
import { CONTACT_THANKS, contactEnquirySchema } from "@/lib/contact-enquiry";
import { sendContactEnquiryEmail } from "@/lib/email";
import { createInAppNotification } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import { resolveTenantFromHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Roles that answer enquiries. Everyone else in the school is left out of the alert. */
const OFFICE_ROLES = ["ADMIN", "DIRECTOR", "COORDINATOR"] as const;

/**
 * Public contact form. An enquiry is stored first; the office is told afterwards.
 * The visitor is told "sent" only when the row has been written, so a failure here
 * is reported as a failure and never as success.
 */
export async function POST(request: NextRequest) {
  const limit = await enforceRateLimit("contact", getClientIp(request));
  if (limit.configurationError) {
    return jsonNoStore(
      { error: "The contact form is unavailable right now. Please call the school office." },
      { status: 503 },
    );
  }
  if (!limit.success) {
    return jsonNoStore(
      {
        error:
          "You have sent several enquiries recently. Please wait a while, or call the school office.",
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = contactEnquirySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return jsonNoStore(
      {
        error: first?.message || "Please check the form and try again.",
        field: first?.path[0] ?? null,
      },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Automated form-fillers complete the hidden field. Pretend it worked, store nothing.
  if (input.website) {
    return jsonNoStore({ ok: true, message: CONTACT_THANKS }, { status: 201 });
  }

  const { tenant } = await resolveTenantFromHost(request.headers.get("host"));
  if (!tenant) {
    logger.error("Contact enquiry received but no school resolved for this host", {
      host: request.headers.get("host"),
    });
    return jsonNoStore(
      { error: "The contact form is unavailable right now. Please call the school office." },
      { status: 503 },
    );
  }

  let enquiry: { id: string };
  try {
    enquiry = await prisma.contactEnquiry.create({
      data: {
        schoolId: tenant.id,
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        message: input.message,
      },
      select: { id: true },
    });
  } catch (error) {
    logger.error("Contact enquiry could not be saved", {
      error: String(error),
      schoolId: tenant.id,
    });
    return jsonNoStore(
      { error: "We could not send your enquiry. Please try again, or call the school office." },
      { status: 500 },
    );
  }

  // The enquiry is saved, so a failed alert must not be reported to the visitor as a failed enquiry.
  await notifyOffice(tenant.id, enquiry.id, input).catch((error) => {
    logger.error("Contact enquiry saved but the office was not alerted", {
      error: String(error),
      enquiryId: enquiry.id,
    });
  });

  return jsonNoStore({ ok: true, message: CONTACT_THANKS }, { status: 201 });
}

async function notifyOffice(
  schoolId: string,
  enquiryId: string,
  input: { name: string; email: string; phone: string; message: string },
) {
  const [office, school] = await Promise.all([
    prisma.user.findMany({
      where: { schoolId, isActive: true, role: { in: [...OFFICE_ROLES] } },
      select: { id: true },
    }),
    prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, email: true } }),
  ]);

  const contactLine = [input.email, input.phone].filter(Boolean).join(" · ");
  const body = `${contactLine}\n\n${input.message.slice(0, 600)}`;
  await Promise.allSettled(
    office.map((user) =>
      createInAppNotification({
        schoolId,
        userId: user.id,
        kind: "SYSTEM",
        title: `New enquiry from ${input.name}`,
        body,
        link: "/admin/notifications",
      }),
    ),
  );

  if (school?.email && process.env.RESEND_API_KEY) {
    await sendContactEnquiryEmail({
      to: school.email,
      schoolName: school.name,
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      message: input.message,
    }).catch((error) => {
      logger.warn("Contact enquiry email failed; in-app alert was still sent", {
        error: String(error),
        enquiryId,
      });
    });
  }
}
