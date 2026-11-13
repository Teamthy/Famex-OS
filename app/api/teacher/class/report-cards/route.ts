import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { getTeacherContext } from "@/lib/teacher-context";
import { requireModule } from "@/lib/module-guard";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * The form teacher's remark on a report card.
 *
 * `/teacher/class/report-cards` had a "Save Remark" button whose handler was
 * `toast("Remark added for …")` — no request, no persistence. A form teacher
 * could write a remark for every child in their class, see a success message
 * each time, and none of it would appear on a single report card.
 *
 * `ReportCard.classTeacherRemark` has existed all along; nothing wrote to it
 * from this screen.
 */

const patchSchema = z.object({
  reportCardId: z.string().trim().min(1),
  remark: z.string().trim().min(2).max(1000),
});

export async function GET() {
  const guard = await requireModule("report_cards", [UserRole.TEACHER, UserRole.HOD]);
  if (!guard.ok) return guard.response;
  const ctx = await getTeacherContext();
  if (!ctx) return NextResponse.json({ error: "Teacher profile not found." }, { status: 404 });
  if (!ctx.formClassId) {
    return NextResponse.json(
      { error: "Only a form teacher can view class report cards." },
      { status: 403 },
    );
  }

  const reports = await prisma.reportCard.findMany({
    where: {
      schoolId: ctx.user.schoolId,
      studentProfile: { currentClassId: ctx.formClassId },
    },
    orderBy: [{ studentProfile: { displayName: "asc" } }, { generatedAt: "desc" }],
    take: 500,
    select: {
      id: true,
      verificationCode: true,
      sessionLabel: true,
      termLabel: true,
      classNameSnapshot: true,
      status: true,
      overallAverage: true,
      overallGrade: true,
      classTeacherRemark: true,
      attendancePresent: true,
      attendanceTotal: true,
      studentProfile: { select: { studentId: true, displayName: true } },
    },
  });

  return NextResponse.json({
    className: ctx.formClassName,
    reports: reports.map((report) => ({
      id: report.id,
      verificationCode: report.verificationCode,
      sessionLabel: report.sessionLabel,
      termLabel: report.termLabel,
      classNameSnapshot: report.classNameSnapshot,
      status: report.status,
      overallAverage: report.overallAverage,
      overallGrade: report.overallGrade,
      classTeacherRemark: report.classTeacherRemark,
      attendancePresent: report.attendancePresent,
      attendanceTotal: report.attendanceTotal,
      studentId: report.studentProfile.studentId,
      studentName: report.studentProfile.displayName,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireModule("report_cards", [UserRole.TEACHER, UserRole.HOD]);
  if (!guard.ok) return guard.response;
  const ctx = await getTeacherContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof patchSchema>;
  try {
    input = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Enter a remark." }, { status: 400 });
  }

  // The remark is the FORM teacher's, so only a form teacher may write it, and
  // only for a card belonging to a student in their own class. Subject
  // teachers comment per subject in the gradebook instead.
  if (!ctx.formClassId) {
    return NextResponse.json(
      { error: "Only a form teacher can add the class teacher's remark." },
      { status: 403 },
    );
  }

  const formClassId = ctx.formClassId;
  const ipAddress = getClientIp(request);
  const outcome = await prisma.$transaction(async (tx) => {
    const card = await tx.reportCard.findFirst({
      where: {
        id: input.reportCardId,
        schoolId: ctx.user.schoolId,
        studentProfile: { currentClassId: formClassId },
      },
      include: { studentProfile: { select: { displayName: true } } },
    });
    if (!card) return { status: 404 as const };

    // The state check and CAS update below make this safe if an admin releases
    // the card concurrently with the teacher's save.
    if (card.status !== "DRAFT" || card.releasedAt) return { status: 409 as const };

    const updated = await tx.reportCard.updateMany({
      where: {
        id: card.id,
        schoolId: ctx.user.schoolId,
        status: "DRAFT",
        releasedAt: null,
        studentProfile: { currentClassId: formClassId },
      },
      data: { classTeacherRemark: input.remark },
    });
    if (updated.count !== 1) return { status: 409 as const };

    await tx.auditLog.create({
      data: {
        schoolId: ctx.user.schoolId,
        actorUserId: ctx.user.id,
        action: "REPORT_CARD_REMARK_SAVED",
        entityType: "ReportCard",
        entityId: card.id,
        ipAddress,
      },
    });
    return { status: 200 as const, displayName: card.studentProfile.displayName };
  });

  if (outcome.status === 404) {
    return NextResponse.json(
      { error: "That report card is not in your form class." },
      { status: 404 },
    );
  }
  if (outcome.status === 409) {
    return NextResponse.json(
      {
        error: "This report card has already been released. Ask an admin to unrelease it first.",
        code: "ALREADY_RELEASED",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Remark saved for ${outcome.displayName}.`,
  });
}
