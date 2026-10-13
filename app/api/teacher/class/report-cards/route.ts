import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { getTeacherContext } from "@/lib/teacher-context";

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

export async function PATCH(request: NextRequest) {
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

  const card = await prisma.reportCard.findFirst({
    where: {
      id: input.reportCardId,
      schoolId: ctx.user.schoolId,
      studentProfile: { currentClassId: ctx.formClassId },
    },
    select: { id: true, releasedAt: true, studentProfile: { select: { displayName: true } } },
  });
  if (!card) {
    return NextResponse.json(
      { error: "That report card is not in your form class." },
      { status: 404 },
    );
  }

  // A released card is what parents are already reading. Editing it silently
  // would change a document they have seen, with no notice that it moved.
  if (card.releasedAt) {
    return NextResponse.json(
      {
        error: "This report card has already been released. Ask an admin to unrelease it first.",
        code: "ALREADY_RELEASED",
      },
      { status: 409 },
    );
  }

  await prisma.reportCard.update({
    where: { id: card.id },
    data: { classTeacherRemark: input.remark },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: ctx.user.schoolId,
      actorUserId: ctx.user.id,
      action: "REPORT_CARD_REMARK_SAVED",
      entityType: "ReportCard",
      entityId: card.id,
      ipAddress: getClientIp(request),
    },
  });

  return NextResponse.json({
    ok: true,
    message: `Remark saved for ${card.studentProfile.displayName}.`,
  });
}
