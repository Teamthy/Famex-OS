import { Resend } from "resend";
import { resolveSiteUrl } from "@/lib/site-url";

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured.");
  return new Resend(key);
}
const from = () => process.env.EMAIL_FROM || "Famex International Schools <onboarding@resend.dev>";

export async function sendPasswordResetEmail(input: { to: string; name: string; token: string }) {
  const url = `${(resolveSiteUrl() || "http://localhost:3000").replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(input.token)}`;
  await client().emails.send({
    from: from(),
    to: input.to,
    subject: "Reset your Famex International Schools portal password",
    html: `<p>Hello ${input.name},</p><p>Use the link below to reset your password. It expires in 30 minutes.</p><p><a href="${url}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}

export async function sendAdmissionDecisionEmail(input: {
  to: string;
  studentName: string;
  status: string;
  note?: string | null;
}) {
  await client().emails.send({
    from: from(),
    to: input.to,
    subject: `Admissions update for ${input.studentName}`,
    html: `<p>Hello,</p><p>There is an admissions update for <strong>${input.studentName}</strong>: <strong>${input.status.replaceAll("_", " ")}</strong>.</p>${input.note ? `<p>${input.note}</p>` : ""}<p>Please log in to the admissions status page or contact Famex International Schools for guidance.</p>`,
  });
}

/**
 * Sent when an applicant is enrolled and a parent portal account is created.
 *
 * Without this the temporary password appeared once in a toast on the admin
 * screen and nowhere else — if the clerk closed the tab or looked away, the
 * family had no way in short of a manual password reset. At term start, with
 * dozens of enrolments a day, that is a guaranteed queue at the front desk.
 *
 * Deliberately fire-and-forget at the call site: a mail failure must never roll
 * back a completed enrolment. The password is still returned in the API
 * response so staff can read it out if the parent's email bounces.
 */
export async function sendParentWelcomeEmail(input: {
  to: string;
  parentName: string;
  studentName: string;
  studentId: string;
  className: string;
  temporaryPassword: string;
}) {
  const base = (resolveSiteUrl() || "http://localhost:3000").replace(/\/$/, "");
  const schoolName = process.env.SCHOOL_NAME || "Famex International Schools";
  await client().emails.send({
    from: from(),
    to: input.to,
    subject: `${input.studentName} has been enrolled at ${schoolName}`,
    html: `
      <p>Hello ${input.parentName},</p>
      <p>
        <strong>${input.studentName}</strong> has been enrolled at ${schoolName} in
        <strong>${input.className}</strong>. The student ID is
        <strong>${input.studentId}</strong>.
      </p>
      <p>You can now use the parent portal to follow attendance, results, fees and school notices.</p>
      <table cellpadding="6" style="border-collapse:collapse;margin:16px 0">
        <tr><td><strong>Portal</strong></td><td><a href="${base}/login">${base}/login</a></td></tr>
        <tr><td><strong>Email</strong></td><td>${input.to}</td></tr>
        <tr><td><strong>Temporary password</strong></td><td><code>${input.temporaryPassword}</code></td></tr>
      </table>
      <p>You will be asked to choose your own password the first time you sign in. Please do not share this email.</p>
      <p>If you did not expect this, contact the school office.</p>
    `,
  });
}

export async function sendGuardianContactVerificationEmail(input: { to: string; token: string }) {
  const base = resolveSiteUrl();
  if (!base) throw new Error("Canonical site URL is not configured.");
  const origin = new URL(base);
  if (origin.protocol !== "https:" || origin.hostname === "localhost") {
    throw new Error("Guardian contact verification requires the canonical HTTPS site URL.");
  }
  const verificationUrl = new URL("/student/verify-guardian", origin);
  verificationUrl.searchParams.set("token", input.token);
  const result = await client().emails.send({
    from: from(),
    to: input.to,
    subject: "Verify guardian contact for a student portal account",
    html: `<p>Hello,</p><p>The school has created a student portal account for a student in your family.</p><p>First, verify that you control this guardian email using the one-time link below. The student's separate activation link will be sent only after this verification succeeds.</p><p><a href="${verificationUrl.toString()}">Verify guardian email</a></p><p>This link expires in 48 hours. If you did not expect this message, contact the school office.</p>`,
  });
  if (result.error)
    throw new Error(`Guardian verification email was not accepted: ${result.error.message}`);
}

export async function sendStudentActivationEmail(input: {
  to: string;
  studentLogin: string;
  token: string;
}) {
  const base = resolveSiteUrl();
  if (!base) throw new Error("Canonical site URL is not configured.");
  const origin = new URL(base);
  if (origin.protocol !== "https:" || origin.hostname === "localhost") {
    throw new Error("Student activation requires the canonical HTTPS site URL.");
  }
  const activationUrl = new URL("/student/activate", origin);
  activationUrl.searchParams.set("token", input.token);
  const escape = (value: string) => value.replace(/[&<>\"']/g, (char) => ESCAPES[char] ?? char);
  const result = await client().emails.send({
    from: from(),
    to: input.to,
    subject: "Activate your student's portal account",
    html: `<p>Hello,</p><p>A student portal account has been created, and the guardian contact has been verified.</p><p>Student login: <strong>${escape(input.studentLogin)}</strong></p><p>Use the separate, one-time link below to set the student's password. It expires in 48 hours.</p><p><a href="${activationUrl.toString()}">Activate student account</a></p><p>If you did not expect this message, contact the school office. Do not forward the link to anyone you do not trust.</p>`,
  });
  if (result.error)
    throw new Error(`Student activation email was not accepted: ${result.error.message}`);
}

export async function sendStaffInviteEmail(input: {
  to: string;
  name: string;
  token: string;
  email: string;
  role: string;
}) {
  const base = (resolveSiteUrl() || "http://localhost:3000").replace(/\/$/, "");
  const url = `${base}/staff/activate?token=${encodeURIComponent(input.token)}&email=${encodeURIComponent(input.email)}`;
  const roleLabel = input.role.replaceAll("_", " ");
  const result = await client().emails.send({
    from: from(),
    to: input.to,
    subject: `You're invited to join the Famex International Schools portal (${roleLabel})`,
    html: `<p>Hello ${input.name},</p><p>You've been invited to join the Famex International Schools portal as <strong>${roleLabel}</strong>.</p><p>Activate your account and set a password using the link below. The invitation expires in 7 days.</p><p><a href="${url}">Activate my account</a></p><p>If you weren't expecting this invitation, you can safely ignore this email.</p>`,
  });
  if (result.error)
    throw new Error(`Staff invitation email was not accepted: ${result.error.message}`);
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Tells the school office that a visitor sent an enquiry. Reply-to is the visitor, so the office can answer directly. */
export async function sendContactEnquiryEmail(input: {
  to: string;
  schoolName: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
}) {
  const esc = (value: string) => value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
  const subjectName = input.name.replace(/[\r\n]+/g, " ");
  await client().emails.send({
    from: from(),
    to: input.to,
    replyTo: input.email,
    subject: `New enquiry from ${subjectName} (${input.schoolName})`,
    html: [
      "<p>A new enquiry came through the contact form.</p>",
      `<p><strong>Name:</strong> ${esc(input.name)}<br/>`,
      `<strong>Email:</strong> ${esc(input.email)}<br/>`,
      `<strong>Phone:</strong> ${esc(input.phone || "not given")}</p>`,
      `<p>${esc(input.message).replace(/\n/g, "<br/>")}</p>`,
      "<p>It is also listed under Notifications in the EduPortal admin area.</p>",
    ].join("\n"),
  });
}
