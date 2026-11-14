import { ClassResultStatus, type UserRole } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveCurrentLabels } from "@/lib/academic-session";
import { GRADEBOOK_ADMIN_ROLES } from "@/lib/gradebook";
import { requireModule } from "@/lib/module-guard";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/requests";
import { classResultLockState, compileClassTermResults, listClassResults } from "@/lib/results";
import { termLabelForIndex } from "@/lib/results-engine";

export const dynamic = "force-dynamic";

/**
 * Admin result cycle for a term: compile → review → release.
 *
 * ── Why this is a separate screen from the report card generator
 *
 * Generating cards is the last step. Before it, someone has to decide that the
 * term's results are CORRECT — that every gradebook is locked, that CBT papers
 * have been graded, that the marks a teacher typed are the marks that will be
 * printed. Compilation is that step: it snapshots a class's totals, averages
 * and positions into TermResult, and releasing publishes them.
 *
 * ── The three states, and what each means
 *
 *   DRAFT     nothing compiled. Cards fall back to gradebooks.
 *   COMPILED  numbers are frozen. Staff may still correct a line; parents see
 *             nothing. Corrections recompute totals, positions and the year
 *             average across every later term.
 *   RELEASED  published. Marks are locked (RESULTS_RELEASED) — a correction
 *             after this goes through unrelease → correct → release, so nobody
 *             is told one number and shown another.
 *
 * ── Term isolation
 *
 * Every action is scoped to one (session, termIndex). Compiling or releasing
 * First Term touches nothing in Second or Third: no cross-term writes, no
 * backfilling of later terms, no assumed defaults. A term with no data stays
 * exactly as it was.
 */
const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("COMPILE_CLASS"),
    classId: z.string().trim().min(1),
    sessionLabel: z.string().trim().min(1).optional(),
    termIndex: z.number().int().min(1).max(3).optional(),
    allowUnlockedGradebooks: z.boolean().optional(),
    recompile: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("COMPILE_ALL"),
    sessionLabel: z.string().trim().min(1).optional(),
    termIndex: z.number().int().min(1).max(3).optional(),
    allowUnlockedGradebooks: z.boolean().optional(),
    recompile: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("RELEASE_CLASS"),
    classId: z.string().trim().min(1),
    sessionLabel: z.string().trim().min(1).optional(),
    termIndex: z.number().int().min(1).max(3).optional(),
  }),
  z.object({
    action: z.literal("UNRELEASE_CLASS"),
    classId: z.string().trim().min(1),
    sessionLabel: z.string().trim().min(1).optional(),
    termIndex: z.number().int().min(1).max(3).optional(),
    reason: z.string().trim().min(4).max(500),
  }),
  z.object({
    action: z.literal("NEXT_RESUMPTION"),
    sessionLabel: z.string().trim().min(1).optional(),
    termIndex: z.number().int().min(1).max(3).optional(),
    nextResumption: z.string().trim().min(1).max(120),
    classId: z.string().trim().min(1).optional(),
  }),
]);

/** Resolve the term to act on: the request's, or the school's current one. */
async function resolveTarget(params: {
  schoolId: string;
  sessionLabel?: string;
  termIndex?: number;
}): Promise<
  { sessionLabel: string; termIndex: number; termLabel: string } | { error: NextResponse }
> {
  let current: Awaited<ReturnType<typeof resolveCurrentLabels>>;
  try {
    current = await resolveCurrentLabels(params.schoolId);
  } catch {
    return {
      error: NextResponse.json(
        { error: "No academic term is currently set for this school.", code: "NO_CURRENT_TERM" },
        { status: 409 },
      ),
    };
  }
  const termIndex = params.termIndex ?? current.termIndex ?? 1;
  return {
    sessionLabel: params.sessionLabel ?? current.sessionLabel,
    termIndex,
    termLabel: termLabelForIndex(termIndex),
  };
}

/** GET — the whole term's state, class by class, for the results screen. */
export async function GET(request: NextRequest) {
  const guard = await requireRoles();
  if (guard instanceof NextResponse) return guard;
  const user = guard;

  const url = new URL(request.url);
  const target = await resolveTarget({
    schoolId: user.schoolId,
    sessionLabel: url.searchParams.get("sessionLabel") ?? undefined,
    termIndex: url.searchParams.get("termIndex")
      ? Number(url.searchParams.get("termIndex"))
      : undefined,
  });
  if ("error" in target) return target.error;

  const requestedClassId = url.searchParams.get("classId");
  const classes = await prisma.schoolClass.findMany({
    where: {
      schoolId: user.schoolId,
      isActive: true,
      ...(requestedClassId ? { id: requestedClassId } : {}),
    },
    select: {
      id: true,
      displayName: true,
      level: true,
      students: { where: { isActive: true }, select: { id: true } },
    },
    orderBy: { displayName: "asc" },
  });
  if (requestedClassId && !classes.length) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const grids = await Promise.all(
    classes.map(async (schoolClass) => {
      const [lock, results] = await Promise.all([
        classResultLockState({
          classId: schoolClass.id,
          sessionLabel: target.sessionLabel,
          termIndex: target.termIndex,
        }),
        listClassResults({
          schoolId: user.schoolId,
          classId: schoolClass.id,
          sessionLabel: target.sessionLabel,
          termIndex: target.termIndex,
        }),
      ]);
      return {
        class: {
          id: schoolClass.id,
          displayName: schoolClass.displayName,
          level: schoolClass.level,
        },
        studentCount: schoolClass.students.length,
        status: lock.status,
        locked: lock.locked,
        compiled: lock.compiled,
        compiledAt: lock.compiledAt,
        releasedAt: lock.releasedAt,
        resultCount: results.length,
        // Students with no compiled line: they were skipped, not zeroed, and
        // an admin needs to see who before releasing the class.
        missing: schoolClass.students.length - results.length,
        results,
      };
    }),
  );

  // The next term's readiness, so an admin closing First Term can see that
  // Second Term is still untouched rather than assuming it is.
  const laterTerms = await prisma.classTermResult.groupBy({
    by: ["termIndex"],
    where: {
      schoolId: user.schoolId,
      sessionLabel: target.sessionLabel,
      termIndex: { gt: target.termIndex },
    },
    _count: { _all: true },
    _max: { compiledAt: true },
  });

  return NextResponse.json({
    sessionLabel: target.sessionLabel,
    termIndex: target.termIndex,
    termLabel: target.termLabel,
    isFinalTerm: target.termIndex >= 3,
    classes: grids,
    summary: {
      classes: grids.length,
      compiled: grids.filter((row) => row.compiled).length,
      released: grids.filter((row) => row.status === ClassResultStatus.RELEASED).length,
      studentsCompiled: grids.reduce((sum, row) => sum + row.resultCount, 0),
      studentsMissing: grids.reduce((sum, row) => sum + row.missing, 0),
    },
    // Later terms are reported, never modified: the requirement is that Second
    // and Third Term records stay exactly as they are until someone compiles
    // them.
    laterTerms: laterTerms.map((row) => ({
      termIndex: row.termIndex,
      termLabel: termLabelForIndex(row.termIndex),
      compiledClasses: row._count._all,
      lastCompiledAt: row._max.compiledAt?.toISOString() ?? null,
    })),
  });
}

/** POST — compile, release, unrelease, or set the next resumption date. */
export async function POST(request: NextRequest) {
  const guard = await requireRoles();
  if (guard instanceof NextResponse) return guard;
  const user = guard;

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request.")
        : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const target = await resolveTarget({
    schoolId: user.schoolId,
    sessionLabel: "sessionLabel" in payload ? payload.sessionLabel : undefined,
    termIndex: "termIndex" in payload ? payload.termIndex : undefined,
  });
  if ("error" in target) return target.error;

  // ── COMPILE ────────────────────────────────────────────────────────────────
  if (payload.action === "COMPILE_CLASS" || payload.action === "COMPILE_ALL") {
    const classes =
      payload.action === "COMPILE_CLASS"
        ? await prisma.schoolClass.findMany({
            where: { id: payload.classId, schoolId: user.schoolId, isActive: true },
            select: { id: true, displayName: true },
          })
        : await prisma.schoolClass.findMany({
            where: { schoolId: user.schoolId, isActive: true },
            select: { id: true, displayName: true },
            orderBy: { displayName: "asc" },
          });

    if (!classes.length) {
      return NextResponse.json({ error: "No classes to compile." }, { status: 404 });
    }

    const compiled: Array<{ classId: string; className: string }> = [];
    const failed: Array<{ classId: string; className: string; error: string; code: string }> = [];

    for (const schoolClass of classes) {
      try {
        await compileClassTermResults({
          schoolId: user.schoolId,
          classId: schoolClass.id,
          sessionLabel: target.sessionLabel,
          termIndex: target.termIndex,
          termLabel: target.termLabel,
          actorUserId: user.id,
          allowUnlockedGradebooks: payload.allowUnlockedGradebooks,
          recompile: payload.recompile,
        });
        compiled.push({ classId: schoolClass.id, className: schoolClass.displayName });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Compilation failed.";
        const code = message.startsWith("UNLOCKED_GRADEBOOKS")
          ? "UNLOCKED_GRADEBOOKS"
          : message === "ALREADY_COMPILED"
            ? "ALREADY_COMPILED"
            : message === "RESULTS_RELEASED"
              ? "RESULTS_RELEASED"
              : message === "RESULT_STATE_CHANGED"
                ? "RESULT_STATE_CHANGED"
                : message === "NOTHING_TO_COMPILE"
                  ? "NOTHING_TO_COMPILE"
                  : message === "NO_STUDENTS"
                    ? "NO_STUDENTS"
                    : "FAILED";
        // One class failing must not stop the rest: a school compiling twelve
        // classes should not have to hunt for the one with an unlocked
        // gradebook by re-running the whole batch twelve times.
        failed.push({
          classId: schoolClass.id,
          className: schoolClass.displayName,
          error:
            code === "UNLOCKED_GRADEBOOKS"
              ? `Gradebooks not locked: ${message.split(":")[1] ?? ""}`.trim()
              : code === "ALREADY_COMPILED"
                ? "Already compiled — pass recompile to rebuild it."
                : code === "RESULTS_RELEASED"
                  ? "Results are released. Unrelease them before recompiling."
                  : code === "RESULT_STATE_CHANGED"
                    ? "The result state changed while compiling. Refresh and retry."
                    : code === "NOTHING_TO_COMPILE"
                      ? "No marked subjects or graded CBT papers."
                      : code === "NO_STUDENTS"
                        ? "No active students."
                        : message,
          code,
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "RESULT_TERM_COMPILED",
        entityType: "AcademicSession",
        entityId: target.sessionLabel,
        metadata: {
          sessionLabel: target.sessionLabel,
          termIndex: target.termIndex,
          compiled: compiled.length,
          failed: failed.length,
        },
        ipAddress: getClientIp(request),
      },
    });

    const message = compiled.length
      ? `${compiled.length} class(es) compiled for ${target.termLabel}.${failed.length ? ` ${failed.length} could not be compiled.` : ""}`
      : "No class could be compiled.";

    return NextResponse.json(
      { ok: compiled.length > 0, compiled, failed, message },
      { status: compiled.length ? 200 : 409 },
    );
  }

  // ── RELEASE ────────────────────────────────────────────────────────────────
  if (payload.action === "RELEASE_CLASS") {
    const lock = await classResultLockState({
      classId: payload.classId,
      sessionLabel: target.sessionLabel,
      termIndex: target.termIndex,
    });
    if (!lock.compiled) {
      return NextResponse.json(
        {
          error: "Compile this class's results before releasing them.",
          code: "NOT_COMPILED",
        },
        { status: 409 },
      );
    }
    if (lock.status === ClassResultStatus.RELEASED) {
      return NextResponse.json({ ok: true, message: "These results are already released." });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.classTermResult.update({
        where: {
          classId_sessionLabel_termIndex: {
            classId: payload.classId,
            sessionLabel: target.sessionLabel,
            termIndex: target.termIndex,
          },
        },
        data: {
          status: ClassResultStatus.RELEASED,
          releasedAt: now,
          releasedByUserId: user.id,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "RESULT_TERM_RELEASED",
        entityType: "SchoolClass",
        entityId: payload.classId,
        metadata: { sessionLabel: target.sessionLabel, termIndex: target.termIndex },
        ipAddress: getClientIp(request),
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Results released for ${target.termLabel}. Students can now see them; marks are locked.`,
    });
  }

  // ── UNRELEASE ──────────────────────────────────────────────────────────────
  if (payload.action === "UNRELEASE_CLASS") {
    const lock = await classResultLockState({
      classId: payload.classId,
      sessionLabel: target.sessionLabel,
      termIndex: target.termIndex,
    });
    if (lock.status !== ClassResultStatus.RELEASED) {
      return NextResponse.json(
        { error: "These results are not released.", code: "NOT_RELEASED" },
        { status: 409 },
      );
    }

    await prisma.classTermResult.update({
      where: {
        classId_sessionLabel_termIndex: {
          classId: payload.classId,
          sessionLabel: target.sessionLabel,
          termIndex: target.termIndex,
        },
      },
      data: {
        status: ClassResultStatus.COMPILED,
        releasedAt: null,
        releasedByUserId: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "RESULT_TERM_UNRELEASED",
        entityType: "SchoolClass",
        entityId: payload.classId,
        metadata: {
          sessionLabel: target.sessionLabel,
          termIndex: target.termIndex,
          reason: payload.reason,
        },
        ipAddress: getClientIp(request),
      },
    });

    return NextResponse.json({
      ok: true,
      message:
        "Results withdrawn from students so they can be corrected. Release them again when the corrections are done.",
    });
  }

  // ── NEXT RESUMPTION ────────────────────────────────────────────────────────
  const where = {
    schoolId: user.schoolId,
    sessionLabel: target.sessionLabel,
    termIndex: target.termIndex,
    ...(payload.classId ? { classId: payload.classId } : {}),
  };
  const updated = await prisma.termResult.updateMany({
    where,
    data: { nextResumption: payload.nextResumption },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "RESULT_NEXT_RESUMPTION_SET",
      entityType: "AcademicSession",
      entityId: target.sessionLabel,
      metadata: {
        sessionLabel: target.sessionLabel,
        termIndex: target.termIndex,
        nextResumption: payload.nextResumption,
        rows: updated.count,
      },
      ipAddress: getClientIp(request),
    },
  });

  return NextResponse.json({
    ok: true,
    rows: updated.count,
    message:
      updated.count > 0
        ? `Next resumption set on ${updated.count} result(s).`
        : "No compiled results to update yet.",
  });
}

/**
 * Admin-only, and guarded by the report-card module.
 *
 * Deliberately not `requireModule("report_cards", …)` directly: that helper
 * returns a discriminated union the two handlers above would each have to
 * unwrap. This wrapper keeps one auth path for the whole route.
 */
async function requireRoles() {
  const guard = await requireModule("report_cards", GRADEBOOK_ADMIN_ROLES as UserRole[]);
  if (!guard.ok) return guard.response;
  return guard.user;
}
