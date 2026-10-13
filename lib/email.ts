import { Resend } from "resend";

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured.");
  return new Resend(key);
}
const from = () => process.env.EMAIL_FROM || "Ykay College <onboarding@resend.dev>";

export async function sendPasswordResetEmail(input: { to: string; name: string; token: string }) {
  const url = `${(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(input.token)}`;
  await client().emails.send({
    from: from(),
    to: input.to,
    subject: "Reset your Ykay College EduPortal password",
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
    html: `<p>Hello,</p><p>There is an admissions update for <strong>${input.studentName}</strong>: <strong>${input.status.replaceAll("_", " ")}</strong>.</p>${input.note ? `<p>${input.note}</p>` : ""}<p>Please log in to the admissions status page or contact Ykay College for guidance.</p>`,
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
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const schoolName = process.env.SCHOOL_NAME || "Ykay College";
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

export async function sendStaffInviteEmail(input: {
  to: string;
  name: string;
  token: string;
  email: string;
  role: string;
}) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const url = `${base}/staff/activate?token=${encodeURIComponent(input.token)}&email=${encodeURIComponent(input.email)}`;
  const roleLabel = input.role.replaceAll("_", " ");
  await client().emails.send({
    from: from(),
    to: input.to,
    subject: `You're invited to join Ykay College EduPortal (${roleLabel})`,
    html: `<p>Hello ${input.name},</p><p>You've been invited to join the Ykay College EduPortal as <strong>${roleLabel}</strong>.</p><p>Activate your account and set a password using the link below. The invitation expires in 7 days.</p><p><a href="${url}">Activate my account</a></p><p>If you weren't expecting this invitation, you can safely ignore this email.</p>`,
  });
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
