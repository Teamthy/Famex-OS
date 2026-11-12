import { EnrolmentOutcome, Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import {
  collectLifecycleExceptions,
  commitClassChange,
  commitReadmit,
  commitWithdraw,
  LifecycleError,
  planClassChange,
  planReadmit,
  planWithdraw,
} from "@/lib/student-lifecycle";
import { getClientIp } from "@/lib/requests";
import {
  completeReservedIdempotency,
  idempotencyRequestHash,
  releaseReservedIdempotency,
  requestMethodForIdempotency,
  requestPathForIdempotency,
  reserveIdempotency,
} from "@/lib/idempotency";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.COORDINATOR];

/**
 * GET /api/admin/student-lifecycle
 *
 * Read-only exception report for the whole school. The report is deliberately
 * not scoped to the current screen: one call detects historic drift from the
 * old class-move/archive/restore paths across every active and inactive record.
 */
export async function GET() {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const report = await collectLifecycleExceptions(user.schoolId);
  return NextResponse.json(report);
}

const reasonSchema = z.string().trim().min(4).max(500).optional();
const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("PLAN_CLASS_CHANGE"),
    studentProfileId: z.string().trim().min(1),
    toClassId: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal("COMMIT_CLASS_CHANGE"),
    studentProfileId: z.string().trim().min(1),
    toClassId: z.string().trim().min(1),
    reason: reasonSchema,
  }),
  z.object({
    action: z.literal("PLAN_WITHDRAW"),
    studentProfileId: z.string().trim().min(1),
    outcome: z.enum([EnrolmentOutcome.WITHDRAWN, EnrolmentOutcome.TRANSFERRED]).optional(),
  }),
  z.object({
    action: z.literal("COMMIT_WITHDRAW"),
    studentProfileId: z.string().trim().min(1),
    outcome: z.enum([EnrolmentOutcome.WITHDRAWN, EnrolmentOutcome.TRANSFERRED]).optional(),
    reason: reasonSchema,
  }),
  z.object({
    action: z.literal("PLAN_READMIT"),
    studentProfileId: z.string().trim().min(1),
    classId: z.string().trim().min(1).nullable().optional(),
  }),
  z.object({
    action: z.literal("COMMIT_READMIT"),
    studentProfileId: z.string().trim().min(1),
    classId: z.string().trim().min(1).nullable().optional(),
    reason: reasonSchema,
  }),
]);

/**
 * One service boundary for all lifecycle dry-runs and commits. Every request
 * is scoped by the authenticated schoolId; student/class IDs from a browser
 * are never trusted as tenant ownership evidence.
 */
export async function POST(request: NextRequest) {
  const user = await requireRole(ADMIN_ROLES);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid student lifecycle request." }, { status: 400 });
  }

  const isCommit = input.action.startsWith("COMMIT_");
  let lease: { lockedUntil: Date; key: string } | null = null;
  if (isCommit) {
    const key = request.headers.get("idempotency-key")?.trim();
    if (!key || key.length < 16) {
      return NextResponse.json(
        { error: "An Idempotency-Key header (min. 16 chars) is required." },
        { status: 400 },
      );
    }
    const reservation = await reserveIdempotency({
      schoolId: user.schoolId,
      scope: "ACADEMIC_LIFECYCLE",
      key,
      requestHash: idempotencyRequestHash({
        method: requestMethodForIdempotency(request),
        path: requestPathForIdempotency(request, "/api/admin/student-lifecycle"),
        actorId: user.id,
        scope: "ACADEMIC_LIFECYCLE",
        body: input,
      }),
    });
    if (reservation.outcome !== "reserved") {
      return NextResponse.json(reservation.body, {
        status: reservation.status,
        ...(reservation.outcome === "in-progress"
          ? { headers: { "Retry-After": String(reservation.retryAfterSeconds) } }
          : {}),
      });
    }
    lease = { lockedUntil: reservation.lockedUntil, key };
  }

  const complete = async (tx: Prisma.TransactionClient, result: unknown) => {
    if (!lease) throw new Error("IDEMPOTENCY_RESERVATION_MISSING");
    await completeReservedIdempotency(tx, {
      schoolId: user.schoolId,
      scope: "ACADEMIC_LIFECYCLE",
      key: lease.key,
      lockedUntil: lease.lockedUntil,
      response: { result: JSON.parse(JSON.stringify(result)) as unknown },
      statusCode: 200,
    });
  };

  try {
    const common = { schoolId: user.schoolId, studentProfileId: input.studentProfileId };
    switch (input.action) {
      case "PLAN_CLASS_CHANGE":
        return NextResponse.json({
          plan: await planClassChange({ ...common, toClassId: input.toClassId }),
        });
      case "COMMIT_CLASS_CHANGE":
        return NextResponse.json({
          result: await commitClassChange({
            ...common,
            toClassId: input.toClassId,
            actorUserId: user.id,
            reason: input.reason,
            ipAddress: getClientIp(request),
            onCommit: complete,
          }),
        });
      case "PLAN_WITHDRAW":
        return NextResponse.json({
          plan: await planWithdraw({ ...common, outcome: input.outcome }),
        });
      case "COMMIT_WITHDRAW":
        return NextResponse.json({
          result: await commitWithdraw({
            ...common,
            outcome: input.outcome,
            actorUserId: user.id,
            reason: input.reason,
            ipAddress: getClientIp(request),
            onCommit: complete,
          }),
        });
      case "PLAN_READMIT":
        return NextResponse.json({
          plan: await planReadmit({ ...common, classId: input.classId }),
        });
      case "COMMIT_READMIT":
        return NextResponse.json({
          result: await commitReadmit({
            ...common,
            classId: input.classId,
            actorUserId: user.id,
            reason: input.reason,
            ipAddress: getClientIp(request),
            onCommit: complete,
          }),
        });
    }
  } catch (error) {
    if (lease) {
      await releaseReservedIdempotency({
        schoolId: user.schoolId,
        scope: "ACADEMIC_LIFECYCLE",
        key: lease.key,
        lockedUntil: lease.lockedUntil,
      });
    }
    if (error instanceof LifecycleError) {
      const status =
        error.code === "STUDENT_NOT_FOUND" || error.code === "CLASS_NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ error: "Student lifecycle operation failed." }, { status: 500 });
  }
}
