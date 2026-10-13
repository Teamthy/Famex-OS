import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { completeModuleAndMaybeCertify, getItPortalUser } from "@/lib/it-education";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";

export const dynamic = "force-dynamic";

const schema = z.object({
  courseId: z.string().trim().min(1),
  moduleId: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const user = await getItPortalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await completeModuleAndMaybeCertify({
    userId: user.id,
    courseId: payload.courseId,
    moduleId: payload.moduleId,
  });

  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  if (result.certified) {
    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "IT_CERTIFICATE_ISSUED",
        entityType: "ItCertificate",
        entityId: result.certificateNumber,
        ipAddress: getClientIp(request),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    progressPercent: result.progressPercent,
    certified: result.certified,
    certificateNumber: result.certificateNumber,
    message: result.certified
      ? `Course completed! Certificate ${result.certificateNumber} has been issued.`
      : "Module marked as complete.",
  });
}
