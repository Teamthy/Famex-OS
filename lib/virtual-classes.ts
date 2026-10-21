import { VirtualClassSessionStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { normalizeHttpsUrl } from "@/lib/assignments";

/** F2-05: assigned-URL live virtual classes with gated, audited joins. */
export const MAX_VIRTUAL_CLASS_MINUTES = 12 * 60;
export const MAX_JOIN_EARLY_MINUTES = 120;

export function validateMeetingUrl(raw: string): string | null {
  return normalizeHttpsUrl(raw);
}

export function validateVirtualClassSchedule(input: {
  startsAt: Date;
  endsAt: Date;
  joinOpensMinutesBefore: number;
  now?: Date;
}): string | null {
  const now = input.now ?? new Date();
  if (Number.isNaN(input.startsAt.getTime()) || Number.isNaN(input.endsAt.getTime())) {
    return "Enter valid start and end times.";
  }
  if (input.endsAt <= input.startsAt) return "The class must end after it starts.";
  if (input.endsAt <= now) return "Schedule the class so that it ends in the future.";
  const durationMinutes = (input.endsAt.getTime() - input.startsAt.getTime()) / 60_000;
  if (durationMinutes > MAX_VIRTUAL_CLASS_MINUTES) {
    return `A virtual class cannot be longer than ${MAX_VIRTUAL_CLASS_MINUTES / 60} hours.`;
  }
  if (
    !Number.isInteger(input.joinOpensMinutesBefore) ||
    input.joinOpensMinutesBefore < 0 ||
    input.joinOpensMinutesBefore > MAX_JOIN_EARLY_MINUTES
  ) {
    return `Joining may open between 0 and ${MAX_JOIN_EARLY_MINUTES} minutes before the start.`;
  }
  return null;
}

export type VirtualClassPhase = "BEFORE_OPEN" | "OPEN" | "LIVE" | "ENDED" | "CANCELLED";

export function getVirtualClassJoinWindow(
  session: {
    status: VirtualClassSessionStatus;
    startsAt: Date;
    endsAt: Date;
    joinOpensMinutesBefore: number;
  },
  now = new Date(),
) {
  const joinOpensAt = new Date(
    session.startsAt.getTime() - session.joinOpensMinutesBefore * 60_000,
  );
  if (session.status === VirtualClassSessionStatus.CANCELLED) {
    return { phase: "CANCELLED" as const, canJoin: false, joinOpensAt };
  }
  if (session.status === VirtualClassSessionStatus.ENDED || now > session.endsAt) {
    return { phase: "ENDED" as const, canJoin: false, joinOpensAt };
  }
  if (now < joinOpensAt) {
    return { phase: "BEFORE_OPEN" as const, canJoin: false, joinOpensAt };
  }
  if (now < session.startsAt) {
    return { phase: "OPEN" as const, canJoin: true, joinOpensAt };
  }
  return { phase: "LIVE" as const, canJoin: true, joinOpensAt };
}

export async function recordVirtualClassAudit(input: {
  request: Request;
  schoolId: string;
  actorUserId: string;
  action: string;
  entityType: "VirtualClassSession" | "VirtualClassJoin";
  entityId: string;
  metadata?: Prisma.InputJsonObject;
}) {
  await prisma.auditLog.create({
    data: {
      schoolId: input.schoolId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
      ipAddress: getClientIp(input.request),
    },
  });
}
