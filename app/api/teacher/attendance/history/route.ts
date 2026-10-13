import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";
import { attendanceDateKey, getTeacherAttendanceContext } from "@/lib/teacher-attendance";

function buildClassOptions(
  context: NonNullable<Awaited<ReturnType<typeof getTeacherAttendanceContext>>>,
) {
  const byClass = new Map<
    string,
    {
      id: string;
      displayName: string;
      roles: string[];
    }
  >();

  for (const assignment of context.teacherProfile.classAssignments) {
    const current = byClass.get(assignment.classroom.id);
    if (current) {
      if (!current.roles.includes(assignment.role)) current.roles.push(assignment.role);
      continue;
    }

    byClass.set(assignment.classroom.id, {
      id: assignment.classroom.id,
      displayName: assignment.classroom.displayName,
      roles: [assignment.role],
    });
  }

  return [...byClass.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}

function monthWindow(monthValue?: string | null) {
  if (monthValue && /^\d{4}-\d{2}$/.test(monthValue)) {
    const [year, month] = monthValue.split("-").map(Number);
    const from = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
    const to = new Date(Date.UTC(year, month, 1, 12, 0, 0));
    return { from, to, month: monthValue };
  }

  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12, 0, 0));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 12, 0, 0));
  return { from, to, month: from.toISOString().slice(0, 7) };
}

export async function GET(request: NextRequest) {
  const context = await getTeacherAttendanceContext();
  if (!context) {
    return jsonNoStore(
      { error: "Teacher attendance history is not available for this account." },
      { status: 403 },
    );
  }

  const availableClasses = buildClassOptions(context);
  if (!availableClasses.length) {
    return jsonNoStore({
      teacher: { displayName: context.teacherProfile.displayName },
      availableClasses: [],
      selectedClassId: null,
      month: monthWindow(null).month,
      records: [],
      totals: { sessions: 0, present: 0, absent: 0, late: 0, attendanceRate: 0 },
    });
  }

  const requestedClassId = request.nextUrl.searchParams.get("classId");
  const selectedAssignment =
    context.teacherProfile.classAssignments.find(
      (assignment) => assignment.classroom.id === requestedClassId,
    ) ||
    context.teacherProfile.classAssignments.find(
      (assignment) => assignment.role === "FORM_TEACHER",
    ) ||
    context.teacherProfile.classAssignments[0];

  if (!selectedAssignment) {
    return jsonNoStore({ error: "You are not assigned to the selected class." }, { status: 404 });
  }

  const range = monthWindow(request.nextUrl.searchParams.get("month"));
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      schoolId: context.user.schoolId,
      classId: selectedAssignment.classroom.id,
      sessionDate: {
        gte: range.from,
        lt: range.to,
      },
    },
    orderBy: [{ sessionDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      sessionDate: true,
      periodKey: true,
      isLocked: true,
      submittedAt: true,
      entries: {
        select: {
          status: true,
        },
      },
    },
  });

  const records = sessions.map((session) => {
    const present = session.entries.filter((entry) => entry.status === "PRESENT").length;
    const absent = session.entries.filter((entry) => entry.status === "ABSENT").length;
    const late = session.entries.filter((entry) => entry.status === "LATE").length;
    const total = session.entries.length;
    const attendanceRate = total ? Math.round((present / total) * 100) : 0;

    return {
      id: session.id,
      date: attendanceDateKey(session.sessionDate),
      periodKey: session.periodKey,
      isLocked: session.isLocked,
      submittedAt: session.submittedAt?.toISOString() || null,
      present,
      absent,
      late,
      total,
      attendanceRate,
    };
  });

  const totals = records.reduce(
    (summary, record) => {
      summary.sessions += 1;
      summary.present += record.present;
      summary.absent += record.absent;
      summary.late += record.late;
      summary.total += record.total;
      return summary;
    },
    { sessions: 0, present: 0, absent: 0, late: 0, total: 0 },
  );

  return jsonNoStore({
    teacher: { displayName: context.teacherProfile.displayName },
    availableClasses,
    selectedClassId: selectedAssignment.classroom.id,
    month: range.month,
    records,
    totals: {
      sessions: totals.sessions,
      present: totals.present,
      absent: totals.absent,
      late: totals.late,
      attendanceRate: totals.total ? Math.round((totals.present / totals.total) * 100) : 0,
    },
  });
}
