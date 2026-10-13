import { AlertChannel, AttendanceCorrectionStatus, AttendanceStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import {
  attendanceDateKey,
  getTeacherAttendanceContext,
  normalizeAttendanceDate,
  summarizeStatuses,
} from "@/lib/teacher-attendance";

export const runtime = "nodejs";

const SAVE_SCHEMA = z.object({
  classId: z.string().trim().min(1),
  sessionDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  periodKey: z.string().trim().min(1).max(40).default("DAILY_REGISTER"),
  notes: z.string().trim().max(500).optional().nullable(),
  finalize: z.boolean().default(false),
  entries: z
    .array(
      z.object({
        studentProfileId: z.string().trim().min(1),
        status: z.nativeEnum(AttendanceStatus),
        note: z.string().trim().max(280).optional().nullable(),
      }),
    )
    .min(1),
});

function buildClassOptions(
  context: NonNullable<Awaited<ReturnType<typeof getTeacherAttendanceContext>>>,
) {
  const byClass = new Map<
    string,
    {
      id: string;
      displayName: string;
      level: string;
      arm: string;
      roles: string[];
      subjectNames: string[];
    }
  >();

  for (const assignment of context.teacherProfile.classAssignments) {
    const current = byClass.get(assignment.classroom.id);
    if (current) {
      if (!current.roles.includes(assignment.role)) current.roles.push(assignment.role);
      if (assignment.subjectName && !current.subjectNames.includes(assignment.subjectName)) {
        current.subjectNames.push(assignment.subjectName);
      }
      continue;
    }

    byClass.set(assignment.classroom.id, {
      id: assignment.classroom.id,
      displayName: assignment.classroom.displayName,
      level: assignment.classroom.level,
      arm: assignment.classroom.arm,
      roles: [assignment.role],
      subjectNames: assignment.subjectName ? [assignment.subjectName] : [],
    });
  }

  return [...byClass.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}

function selectAssignment(
  context: NonNullable<Awaited<ReturnType<typeof getTeacherAttendanceContext>>>,
  classId?: string | null,
) {
  if (classId) {
    return (
      context.teacherProfile.classAssignments.find(
        (assignment) => assignment.classroom.id === classId,
      ) || null
    );
  }

  return (
    context.teacherProfile.classAssignments.find(
      (assignment) => assignment.role === "FORM_TEACHER",
    ) ||
    context.teacherProfile.classAssignments[0] ||
    null
  );
}

function buildAlertMessage(input: {
  studentName: string;
  status: AttendanceStatus;
  className: string;
  sessionDate: string;
  note?: string | null;
}) {
  const statusLabel = input.status === AttendanceStatus.ABSENT ? "absent" : "late";
  const note = input.note ? ` Teacher note: ${input.note}.` : "";
  return `Attendance Alert: ${input.studentName} was marked ${statusLabel} in ${input.className} on ${input.sessionDate}.${note}`;
}

export async function GET(request: NextRequest) {
  const context = await getTeacherAttendanceContext();
  if (!context) {
    return jsonNoStore(
      { error: "Teacher attendance access is not available for this account." },
      { status: 403 },
    );
  }

  const availableClasses = buildClassOptions(context);
  if (!availableClasses.length) {
    return jsonNoStore({
      teacher: { displayName: context.teacherProfile.displayName },
      availableClasses: [],
      selectedClass: null,
      session: null,
      roster: [],
      summary: { present: 0, absent: 0, late: 0, total: 0 },
    });
  }

  const requestedClassId = request.nextUrl.searchParams.get("classId");
  const selectedAssignment = selectAssignment(context, requestedClassId);
  if (!selectedAssignment) {
    return jsonNoStore({ error: "You are not assigned to the selected class." }, { status: 404 });
  }

  const sessionDate = normalizeAttendanceDate(request.nextUrl.searchParams.get("date"));
  const periodKey = request.nextUrl.searchParams.get("periodKey")?.trim() || "DAILY_REGISTER";

  const [session, roster] = await Promise.all([
    prisma.attendanceSession.findUnique({
      where: {
        classId_sessionDate_periodKey: {
          classId: selectedAssignment.classroom.id,
          sessionDate,
          periodKey,
        },
      },
      select: {
        id: true,
        sessionDate: true,
        periodKey: true,
        notes: true,
        isLocked: true,
        submittedAt: true,
        entries: {
          select: {
            studentProfileId: true,
            status: true,
            note: true,
          },
        },
        correctionRequests: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            reason: true,
            resolutionNote: true,
            createdAt: true,
            reviewedAt: true,
          },
        },
      },
    }),
    prisma.studentProfile.findMany({
      where: {
        schoolId: context.user.schoolId,
        currentClassId: selectedAssignment.classroom.id,
        isActive: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        studentId: true,
        displayName: true,
        guardianName: true,
        guardianPhone: true,
      },
    }),
  ]);

  const entryMap = new Map(session?.entries.map((entry) => [entry.studentProfileId, entry]) || []);
  const rows = roster.map((student) => {
    const entry = entryMap.get(student.id);
    return {
      studentProfileId: student.id,
      studentId: student.studentId,
      displayName: student.displayName,
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
      status: entry?.status || AttendanceStatus.PRESENT,
      note: entry?.note || "",
    };
  });

  return jsonNoStore({
    teacher: { displayName: context.teacherProfile.displayName },
    availableClasses,
    selectedClass: {
      id: selectedAssignment.classroom.id,
      displayName: selectedAssignment.classroom.displayName,
      level: selectedAssignment.classroom.level,
      arm: selectedAssignment.classroom.arm,
      role: selectedAssignment.role,
      subjectName: selectedAssignment.subjectName,
    },
    session: session
      ? {
          id: session.id,
          date: attendanceDateKey(session.sessionDate),
          periodKey: session.periodKey,
          notes: session.notes,
          isLocked: session.isLocked,
          submittedAt: session.submittedAt?.toISOString() || null,
          correctionRequest: session.correctionRequests[0]
            ? {
                id: session.correctionRequests[0].id,
                status: session.correctionRequests[0].status,
                reason: session.correctionRequests[0].reason,
                resolutionNote: session.correctionRequests[0].resolutionNote,
                createdAt: session.correctionRequests[0].createdAt.toISOString(),
                reviewedAt: session.correctionRequests[0].reviewedAt?.toISOString() || null,
              }
            : null,
        }
      : {
          id: null,
          date: attendanceDateKey(sessionDate),
          periodKey,
          notes: "",
          isLocked: false,
          submittedAt: null,
          correctionRequest: null,
        },
    roster: rows,
    summary: summarizeStatuses(rows),
  });
}

export async function POST(request: NextRequest) {
  const context = await getTeacherAttendanceContext();
  if (!context) {
    return jsonNoStore(
      { error: "Teacher attendance access is not available for this account." },
      { status: 403 },
    );
  }

  try {
    const payload = SAVE_SCHEMA.parse(await request.json());
    const selectedAssignment = selectAssignment(context, payload.classId);
    if (!selectedAssignment || selectedAssignment.classroom.id !== payload.classId) {
      return jsonNoStore({ error: "You are not assigned to the selected class." }, { status: 404 });
    }

    const sessionDate = normalizeAttendanceDate(payload.sessionDate);
    const validStudents = await prisma.studentProfile.findMany({
      where: {
        schoolId: context.user.schoolId,
        currentClassId: payload.classId,
        isActive: true,
      },
      select: { id: true },
    });

    const validIds = new Set(validStudents.map((student) => student.id));
    if (
      payload.entries.length !== validStudents.length ||
      payload.entries.some((entry) => !validIds.has(entry.studentProfileId))
    ) {
      return jsonNoStore(
        { error: "Attendance entries do not match the active class roster." },
        { status: 422 },
      );
    }

    const duplicateCheck = new Set<string>();
    for (const entry of payload.entries) {
      if (duplicateCheck.has(entry.studentProfileId)) {
        return jsonNoStore(
          { error: "A student appears more than once in this register." },
          { status: 422 },
        );
      }
      duplicateCheck.add(entry.studentProfileId);
    }

    const ipAddress = getClientIp(request);
    const summary = summarizeStatuses(payload.entries);
    let createdAlertJobs = 0;

    const savedSession = await prisma.$transaction(async (tx) => {
      const existingSession = await tx.attendanceSession.findUnique({
        where: {
          classId_sessionDate_periodKey: {
            classId: payload.classId,
            sessionDate,
            periodKey: payload.periodKey,
          },
        },
        select: { id: true, isLocked: true },
      });

      if (existingSession?.isLocked) {
        throw new Error("This attendance register has already been submitted and locked.");
      }

      const session = existingSession
        ? await tx.attendanceSession.update({
            where: { id: existingSession.id },
            data: {
              teacherProfileId: context.teacherProfile.id,
              assignmentId: selectedAssignment.id,
              notes: payload.notes || null,
              isLocked: payload.finalize,
              submittedAt: payload.finalize ? new Date() : null,
            },
            select: {
              id: true,
              isLocked: true,
              submittedAt: true,
              periodKey: true,
              sessionDate: true,
            },
          })
        : await tx.attendanceSession.create({
            data: {
              schoolId: context.user.schoolId,
              classId: payload.classId,
              teacherProfileId: context.teacherProfile.id,
              assignmentId: selectedAssignment.id,
              sessionDate,
              periodKey: payload.periodKey,
              notes: payload.notes || null,
              isLocked: payload.finalize,
              submittedAt: payload.finalize ? new Date() : null,
            },
            select: {
              id: true,
              isLocked: true,
              submittedAt: true,
              periodKey: true,
              sessionDate: true,
            },
          });

      await tx.attendanceEntry.deleteMany({ where: { sessionId: session.id } });
      await tx.attendanceEntry.createMany({
        data: payload.entries.map((entry) => ({
          sessionId: session.id,
          studentProfileId: entry.studentProfileId,
          status: entry.status,
          note: entry.note?.trim() || null,
        })),
      });

      if (payload.finalize) {
        await tx.attendanceAlertJob.deleteMany({ where: { attendanceSessionId: session.id } });

        const affectedIds = payload.entries
          .filter(
            (entry) =>
              entry.status === AttendanceStatus.ABSENT || entry.status === AttendanceStatus.LATE,
          )
          .map((entry) => entry.studentProfileId);

        if (affectedIds.length) {
          const affectedStudents = await tx.studentProfile.findMany({
            where: { id: { in: affectedIds } },
            select: {
              id: true,
              displayName: true,
              guardianName: true,
              guardianPhone: true,
              guardianEmail: true,
              parentLinks: {
                where: { parentProfile: { isActive: true } },
                orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
                select: {
                  parentProfile: {
                    select: {
                      id: true,
                      displayName: true,
                      phone: true,
                      user: {
                        select: {
                          email: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          });

          const entriesById = new Map(
            payload.entries.map((entry) => [entry.studentProfileId, entry]),
          );
          const alertRows: Array<{
            schoolId: string;
            attendanceSessionId: string;
            studentProfileId: string;
            parentProfileId?: string;
            channel: AlertChannel;
            recipientName?: string;
            recipientPhone?: string;
            recipientEmail?: string;
            messagePreview: string;
            payload: object;
          }> = [];

          for (const student of affectedStudents) {
            const entry = entriesById.get(student.id);
            if (!entry) continue;
            const messagePreview = buildAlertMessage({
              studentName: student.displayName,
              status: entry.status,
              className: selectedAssignment.classroom.displayName,
              sessionDate: attendanceDateKey(sessionDate),
              note: entry.note,
            });

            const primaryParent = student.parentLinks[0]?.parentProfile;
            const recipientName =
              primaryParent?.displayName || student.guardianName || student.displayName;
            const recipientPhone = primaryParent?.phone || student.guardianPhone || undefined;
            const recipientEmail = primaryParent?.user.email || student.guardianEmail || undefined;

            if (recipientPhone) {
              alertRows.push({
                schoolId: context.user.schoolId,
                attendanceSessionId: session.id,
                studentProfileId: student.id,
                parentProfileId: primaryParent?.id,
                channel: AlertChannel.SMS,
                recipientName,
                recipientPhone,
                messagePreview,
                payload: { deliveryChannel: "SMS", attendanceStatus: entry.status },
              });
              alertRows.push({
                schoolId: context.user.schoolId,
                attendanceSessionId: session.id,
                studentProfileId: student.id,
                parentProfileId: primaryParent?.id,
                channel: AlertChannel.WHATSAPP,
                recipientName,
                recipientPhone,
                messagePreview,
                payload: { deliveryChannel: "WHATSAPP", attendanceStatus: entry.status },
              });
            }

            if (recipientEmail) {
              alertRows.push({
                schoolId: context.user.schoolId,
                attendanceSessionId: session.id,
                studentProfileId: student.id,
                parentProfileId: primaryParent?.id,
                channel: AlertChannel.EMAIL,
                recipientName,
                recipientEmail,
                messagePreview,
                payload: { deliveryChannel: "EMAIL", attendanceStatus: entry.status },
              });
            }
          }

          if (alertRows.length) {
            await tx.attendanceAlertJob.createMany({ data: alertRows });
            createdAlertJobs = alertRows.length;
          }
        }
      }

      await tx.auditLog.create({
        data: {
          schoolId: context.user.schoolId,
          actorUserId: context.user.id,
          action: payload.finalize ? "ATTENDANCE_SESSION_SUBMITTED" : "ATTENDANCE_SESSION_SAVED",
          entityType: "AttendanceSession",
          entityId: session.id,
          ipAddress,
          metadata: {
            classId: payload.classId,
            className: selectedAssignment.classroom.displayName,
            sessionDate: attendanceDateKey(sessionDate),
            periodKey: payload.periodKey,
            summary,
            createdAlertJobs,
          },
        },
      });

      if (payload.finalize) {
        await tx.attendanceCorrectionRequest.updateMany({
          where: {
            attendanceSessionId: session.id,
            status: AttendanceCorrectionStatus.PENDING,
          },
          data: {
            status: AttendanceCorrectionStatus.REJECTED,
            resolutionNote: "Superseded by a new attendance submission.",
            reviewedAt: new Date(),
            reviewedByUserId: context.user.id,
          },
        });
      }

      return session;
    });

    return jsonNoStore({
      ok: true,
      session: {
        id: savedSession.id,
        date: attendanceDateKey(savedSession.sessionDate),
        periodKey: savedSession.periodKey,
        isLocked: savedSession.isLocked,
        submittedAt: savedSession.submittedAt?.toISOString() || null,
      },
      summary,
      notificationPreview: {
        absent: summary.absent,
        late: summary.late,
        queuedParentAlerts: createdAlertJobs,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save attendance right now.";
    const status = message.includes("locked") ? 409 : 400;
    return jsonNoStore({ error: message }, { status });
  }
}
