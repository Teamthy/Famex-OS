import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ReportCardStatus, UserRole } from "@prisma/client";
import { GRADEBOOK_ADMIN_ROLES } from "@/lib/gradebook";
import ReportCardSheet from "@/components/ReportCardSheet";
import PrintToolbar from "@/components/PrintToolbar";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { letterheadFromSchool, sheetFromStoredCard } from "@/lib/report-card-sheet";
import { roleMatches } from "@/lib/roles";
import { teacherMayViewReportCard } from "@/lib/report-card-access";

export const dynamic = "force-dynamic";

/**
 * The report card, on its own page, ready to print.
 *
 * `/student/report-cards` and its siblings render a dashboard around the card:
 * a topbar, a sidebar, a list of terms, buttons. Printing that produced a sheet
 * of portal chrome with a shrunken card inside it. This route renders nothing
 * but the document, in the school's paper format (components/ReportCardSheet),
 * so Ctrl-P and the browser's "Save as PDF" both produce the actual report.
 *
 * Access is the same as the detail it prints:
 *   • the student it belongs to,
 *   • a parent linked to that student,
 *   • staff who may see results (admin, director, coordinator, or the form
 *     teacher assigned to the class; a subject teacher is not shown the full card),
 *   • never a RELEASED card to anyone who is not one of those, and never a
 *     DRAFT except to staff.
 *
 * The card is looked up by its PUBLIC verification code, not its report
 * number: the number encodes the student id and is printed, and putting it in
 * a URL would make it an access key again (audit B-08).
 */
export default async function PrintableReportCardPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/report-cards/${encodeURIComponent(code)}/print`);

  const card = await prisma.reportCard.findFirst({
    where: {
      schoolId: session.schoolId,
      verificationCode: decodeURIComponent(code),
    },
    include: {
      subjects: { orderBy: { sortOrder: "asc" } },
      studentProfile: {
        select: {
          id: true,
          userId: true,
          currentClassId: true,
          studentId: true,
          displayName: true,
          currentClass: { select: { displayName: true } },
        },
      },
    },
  });

  // A missing card and a card for another school are the same answer: nothing.
  if (!card) notFound();

  const isStaff = roleMatches(session.role, GRADEBOOK_ADMIN_ROLES);

  const isStudent = session.role === UserRole.STUDENT && card.studentProfile.userId === session.id;

  const isParent =
    session.role === UserRole.PARENT &&
    (await prisma.parentStudentLink.findFirst({
      where: {
        parentProfile: { schoolId: session.schoolId, userId: session.id, isActive: true },
        studentProfileId: card.studentProfile.id,
      },
      select: { id: true },
    })) !== null;

  let isTeacher = false;
  if (
    (session.role === UserRole.TEACHER || session.role === UserRole.HOD) &&
    card.studentProfile.currentClassId
  ) {
    const teacher = await prisma.teacherProfile.findFirst({
      where: { schoolId: session.schoolId, userId: session.id, isActive: true },
      select: {
        classAssignments: {
          where: { classId: card.studentProfile.currentClassId, isActive: true },
          select: { classId: true, role: true },
        },
      },
    });
    isTeacher = teacherMayViewReportCard({
      classId: card.studentProfile.currentClassId,
      assignments: teacher?.classAssignments ?? [],
    });
  }

  if (!isStaff && !isStudent && !isParent && !isTeacher) notFound();
  // Only staff may print an unreleased card: to everyone else it does not exist.
  if (card.status !== ReportCardStatus.RELEASED && !isStaff) notFound();

  const school = await prisma.school.findUnique({
    where: { id: card.schoolId },
    select: { name: true, address: true, phone: true, email: true, motto: true },
  });
  const branding = await prisma.tenantBranding.findUnique({
    where: { schoolId: card.schoolId },
    select: { logoUrl: true, displayName: true },
  });

  // The origin the QR must carry. Taken from the request so a deployment on a
  // custom domain prints its own domain, not a hardcoded one.
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") || "https";
  const origin = host ? `${proto}://${host}` : null;

  const verifyUrl =
    origin && card.verificationCode
      ? `${origin}/verify/report/${encodeURIComponent(card.verificationCode)}`
      : null;

  const backHref = isStaff
    ? "/admin/report-cards"
    : session.role === UserRole.PARENT
      ? "/parent/report-cards"
      : session.role === UserRole.TEACHER || session.role === UserRole.HOD
        ? "/teacher/class/report-cards"
        : "/student/report-cards";

  const sheet = sheetFromStoredCard(
    card,
    {
      displayName: card.studentProfile.displayName,
      studentId: card.studentProfile.studentId,
      className: card.classNameSnapshot || card.studentProfile.currentClass?.displayName || "",
    },
    letterheadFromSchool(school, branding),
    { verifyUrl },
  );

  return (
    <main className="bg-neutral-100 min-h-screen py-8 print:bg-white print:py-0">
      <PrintToolbar
        title={`${card.studentProfile.displayName} · ${card.termLabel} ${card.sessionLabel}`}
        backHref={backHref}
      />
      <ReportCardSheet data={sheet} />
      <p className="no-print mx-auto mt-6 max-w-[210mm] px-4 text-center text-xs text-neutral-500">
        Printed from{" "}
        <Link href="/" className="underline">
          Famex
        </Link>
        . The QR code and verification code above let anyone confirm this document is genuine
        without exposing the student&apos;s records.
      </p>
    </main>
  );
}
