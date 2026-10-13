import { NextRequest, NextResponse } from "next/server";
import { ApplicationStatus, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PEOPLE_ADMIN_ROLES, oneTimeSecret, passwordHash, uniqueStudentNumber } from "@/lib/people";
import { getClientIp } from "@/lib/requests";
import { sendParentWelcomeEmail } from "@/lib/email";
import { requireRole } from "@/lib/session";
import { logger } from "@/lib/logger";
import {
  completeReservedIdempotency,
  idempotencyRequestHash,
  releaseReservedIdempotency,
  requestMethodForIdempotency,
  requestPathForIdempotency,
  reserveIdempotency,
} from "@/lib/idempotency";
const schema = z.object({
  applicationId: z.string().min(1),
  classId: z.string().min(1),
  entranceScore: z.number().int().min(0).max(100),
  entrancePassed: z.boolean(),
  placementNote: z.string().trim().max(500).optional(),
});
export async function POST(request: NextRequest) {
  const user = await requireRole(PEOPLE_ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || key.length < 16)
    return NextResponse.json(
      { error: "An Idempotency-Key header (min. 16 chars) is required." },
      { status: 400 },
    );
  let rawBody: unknown;
  let input: z.infer<typeof schema>;
  try {
    rawBody = await request.json();
    input = schema.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid placement details." }, { status: 400 });
  }
  const requestHash = idempotencyRequestHash({
    method: requestMethodForIdempotency(request),
    path: requestPathForIdempotency(request, "/api/admin/admissions/enroll"),
    actorId: user.id,
    scope: "ADMISSION_ENROLLMENT",
    body: rawBody,
  });
  // Reserve the idempotency key BEFORE any side effect (atomic insert under
  // the unique constraint) so concurrent double-submits cannot both enrol.
  const reservation = await reserveIdempotency({
    schoolId: user.schoolId,
    scope: "ADMISSION_ENROLLMENT",
    key,
    requestHash,
  });
  if (reservation.outcome !== "reserved") {
    return NextResponse.json(reservation.body, {
      status: reservation.status,
      ...(reservation.outcome === "in-progress"
        ? { headers: { "Retry-After": String(reservation.retryAfterSeconds) } }
        : {}),
    });
  }
  const releaseReservation = () =>
    releaseReservedIdempotency({
      schoolId: user.schoolId,
      scope: "ADMISSION_ENROLLMENT",
      key,
      lockedUntil: reservation.lockedUntil,
    });
  const application = await prisma.admissionApplication.findFirst({
    where: { schoolId: user.schoolId, applicationId: input.applicationId },
    include: { enrolledStudent: true },
  });
  if (!application) {
    await releaseReservation();
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  if (application.enrolledStudent) {
    // Not an error and no side effect: record it so retries replay the same
    // answer instead of re-reading a possibly-changed application.
    const alreadyResponse = {
      student: {
        studentId: application.enrolledStudent.studentId,
        displayName: application.enrolledStudent.displayName,
      },
      alreadyEnrolled: true,
    };
    await completeReservedIdempotency(prisma, {
      schoolId: user.schoolId,
      scope: "ADMISSION_ENROLLMENT",
      key,
      lockedUntil: reservation.lockedUntil,
      response: alreadyResponse,
      statusCode: 200,
    });
    return NextResponse.json(alreadyResponse);
  }
  if (application.paymentStatus !== PaymentStatus.PAID) {
    await releaseReservation();
    return NextResponse.json(
      { error: "Admission payment has not been verified." },
      { status: 409 },
    );
  }
  if (!input.entrancePassed) {
    await releaseReservation();
    return NextResponse.json(
      { error: "Only applicants who passed the entrance assessment may be enrolled." },
      { status: 409 },
    );
  }
  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: input.classId, schoolId: user.schoolId, isActive: true },
  });
  if (!schoolClass) {
    await releaseReservation();
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }
  if (schoolClass.level !== application.classApplying) {
    await releaseReservation();
    return NextResponse.json(
      { error: `Placement must match the applied class level (${application.classApplying}).` },
      { status: 409 },
    );
  }
  const existingParent = await prisma.user.findFirst({
    where: { email: application.parentEmail, schoolId: user.schoolId },
  });
  const number = await uniqueStudentNumber(user.schoolId);
  const displayName = [application.firstName, application.middleName, application.lastName]
    .filter(Boolean)
    .join(" ");
  const tempPassword = oneTimeSecret();
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SchoolClass" WHERE id = ${schoolClass.id} AND "schoolId" = ${user.schoolId} AND "isActive" = true FOR UPDATE`;
      const lockedClass = await tx.schoolClass.findFirst({
        where: { id: schoolClass.id, schoolId: user.schoolId, isActive: true },
        include: { _count: { select: { students: { where: { isActive: true } } } } },
      });
      if (!lockedClass) throw new Error("CLASS_NOT_FOUND");
      if (lockedClass.capacity !== null && lockedClass._count.students >= lockedClass.capacity) {
        throw new Error("CLASS_AT_CAPACITY");
      }
      let parent = existingParent
        ? await tx.parentProfile.findFirst({ where: { userId: existingParent.id } })
        : null;
      let parentCreated = false;
      if (!parent) {
        const parentUser = await tx.user.create({
          data: {
            schoolId: user.schoolId,
            email: application.parentEmail,
            name:
              application.guardianName ||
              application.fatherName ||
              application.motherName ||
              "Parent",
            role: "PARENT",
            passwordHash: await passwordHash(tempPassword),
            mustChangePassword: true,
          },
        });
        parent = await tx.parentProfile.create({
          data: {
            schoolId: user.schoolId,
            userId: parentUser.id,
            displayName: parentUser.name,
            phone: application.parentPhone,
          },
        });
        parentCreated = true;
      }
      const student = await tx.studentProfile.create({
        data: {
          schoolId: user.schoolId,
          currentClassId: lockedClass.id,
          admissionApplicationId: application.id,
          studentId: number,
          firstName: application.firstName,
          lastName: application.lastName,
          otherNames: application.middleName,
          displayName,
          gender: application.gender,
          guardianName: parent.displayName,
          guardianPhone: application.parentPhone,
          guardianEmail: application.parentEmail,
        },
      });
      await tx.parentStudentLink.create({
        data: {
          parentProfileId: parent.id,
          studentProfileId: student.id,
          relationship: application.guardianRelationship || "Guardian",
          isPrimary: true,
        },
      });
      await tx.admissionApplication.update({
        where: { id: application.id },
        data: {
          status: ApplicationStatus.APPROVED,
          statusNote: input.placementNote || null,
          reviewedAt: new Date(),
          entranceScore: input.entranceScore,
          entrancePassed: true,
          recommendedClassId: lockedClass.id,
          entranceReviewedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          schoolId: user.schoolId,
          actorUserId: user.id,
          action: "ADMISSION_ENROLLED",
          entityType: "AdmissionApplication",
          entityId: application.applicationId,
          ipAddress: getClientIp(request),
          metadata: {
            studentId: number,
            className: lockedClass.displayName,
            entranceScore: input.entranceScore,
          },
        },
      });
      // Complete the reservation inside this transaction so the replayable
      // response commits atomically with the enrolment. The temporary password
      // is deliberately never persisted in the replay response.
      await completeReservedIdempotency(tx, {
        schoolId: user.schoolId,
        scope: "ADMISSION_ENROLLMENT",
        key,
        lockedUntil: reservation.lockedUntil,
        response: {
          student: { studentId: number, displayName, className: lockedClass.displayName },
          parentAccount: {
            email: application.parentEmail,
            temporaryPassword: null,
            mustChangePassword: parentCreated,
            welcomeEmailSent: false,
          },
        },
        statusCode: 201,
      });
      return {
        student,
        parentCreated,
        parentDisplayName: parent.displayName,
        className: lockedClass.displayName,
      };
    });
    // Email the parent their portal credentials.
    //
    // Fire-and-forget on purpose: the enrolment transaction has already
    // committed, and a Resend outage must not fail the request or leave the
    // clerk unsure whether the student was enrolled. The temporary password is
    // still returned below so staff can read it out if the email bounces.
    let welcomeEmailSent = false;
    if (result.parentCreated) {
      try {
        await sendParentWelcomeEmail({
          to: application.parentEmail,
          parentName: result.parentDisplayName,
          studentName: displayName,
          studentId: number,
          className: result.className,
          temporaryPassword: tempPassword,
        });
        welcomeEmailSent = true;
      } catch (emailError) {
        logger.error("Parent welcome email failed", {
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    }

    const response = {
      student: { studentId: number, displayName, className: result.className },
      parentAccount: {
        email: application.parentEmail,
        temporaryPassword: result.parentCreated ? tempPassword : null,
        mustChangePassword: result.parentCreated,
        welcomeEmailSent,
      },
    };
    // The transaction stored the replay response with welcomeEmailSent=false
    // (email is attempted after commit); refresh it now, best-effort.
    if (result.parentCreated) {
      try {
        await prisma.idempotencyRecord.updateMany({
          where: {
            schoolId: user.schoolId,
            scope: "ADMISSION_ENROLLMENT",
            key,
            status: "COMPLETED",
          },
          data: {
            response: {
              student: response.student,
              parentAccount: {
                email: response.parentAccount.email,
                temporaryPassword: null,
                mustChangePassword: response.parentAccount.mustChangePassword,
                welcomeEmailSent,
              },
            },
          },
        });
      } catch {
        // Replay fidelity only — the enrollment itself is committed.
      }
    }
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "IDEMPOTENCY_RESERVATION_LOST") {
      return NextResponse.json(
        {
          error:
            "The request outlived its idempotency lease and was rolled back. Please retry the same request.",
        },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === "CLASS_AT_CAPACITY") {
      await releaseReservation();
      return NextResponse.json({ error: "This class is at capacity." }, { status: 409 });
    }
    await releaseReservation();
    logger.error("Request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Enrollment could not be completed. No partial record was saved." },
      { status: 500 },
    );
  }
}
