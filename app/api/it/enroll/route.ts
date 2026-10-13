import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getItPortalUser } from "@/lib/it-education";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";

export const dynamic = "force-dynamic";

const schema = z.object({ courseId: z.string().trim().min(1) });

export async function POST(request: NextRequest) {
  const user = await getItPortalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const course = await prisma.itCourse.findFirst({
    where: { id: payload.courseId, isActive: true },
    select: { id: true, title: true },
  });
  if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });

  const enrollment = await prisma.itEnrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    update: {},
    create: { schoolId: user.schoolId, userId: user.id, courseId: course.id },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "IT_COURSE_ENROLLED",
      entityType: "ItEnrollment",
      entityId: enrollment.id,
      metadata: { courseTitle: course.title },
      ipAddress: getClientIp(request),
    },
  });

  return NextResponse.json({
    ok: true,
    message: `Enrolled in ${course.title}. Start learning now!`,
  });
}
