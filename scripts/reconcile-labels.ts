/**
 * Term/session label reconciliation — REPORT ONLY.
 *
 * Before drop 10, four models took their term and session from the calendar or
 * from a form field rather than from AcademicSession/Term. On 2026-08-02 the
 * three sources disagreed three ways, so rows written then can be filed under
 * a label that matches nothing else.
 *
 * THIS SCRIPT WRITES NOTHING. It compares every denormalised label against the
 * school's real sessions and terms and prints what it finds. Deciding what to
 * do about a mismatch needs a human who knows which term the data actually
 * belongs to — a script cannot know whether "Third Term" written in August
 * meant last session's third term or this session's first.
 *
 *   npm run reconcile:labels
 *
 * Exit code is 0 whether or not mismatches are found: this is a report, not a
 * gate. Use --json for machine-readable output.
 */
import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";

const prisma = new PrismaClient();
const asJson = process.argv.includes("--json");

/**
 * Wake the database before doing anything else.
 *
 * Neon's free tier suspends an idle branch, so the FIRST query after a quiet
 * period fails with P1001 "Can't reach database server". That is not a real
 * outage — the branch takes a few seconds to resume — but an unhandled P1001
 * looks identical to a misconfigured DATABASE_URL and buries the real cause in
 * a Prisma stack trace.
 */
async function connectWithRetry(attempts = 5): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      const code = (error as { errorCode?: string; code?: string }).code;
      const unreachable = code === "P1001" || String(error).includes("Can't reach database server");
      if (!unreachable || attempt === attempts) {
        if (unreachable) {
          // Do NOT assert a cause here. P1001 is Prisma's catch-all and looks
          // identical for DNS, firewall, TLS, bad credentials and a suspended
          // branch. Point at the diagnostic instead of guessing wrong.
          console.error(
            `\nCould not reach the database after ${attempts} attempts.\n\n` +
              `P1001 does not say WHY. Run this to find out which layer fails:\n\n` +
              `    npm run diagnose:db\n\n` +
              `It checks the URL, DNS, TCP, TLS and credentials in order and stops\n` +
              `at the first real problem.\n`,
          );
        } else {
          logger.error("\nDatabase error:", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return false;
      }
      // Neon's compute resumes in a few hundred ms, but its own docs warn that
      // REPEATED rapid attempts during the restart phase can keep the
      // connection failing. So: one quick retry to cover an ordinary cold
      // start, then back off hard and leave it alone.
      const waitMs = attempt === 1 ? 1500 : attempt * 8000;
      console.log(
        `  Not reachable yet (P1001) — attempt ${attempt}/${attempts - 1}, ` +
          `waiting ${waitMs / 1000}s…`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  return false;
}

type Finding = {
  model: string;
  /** How the row identifies itself to a human. */
  ref: string;
  sessionLabel: string | null;
  termLabel: string;
  issue: string;
  /** What the label would be if it matched a known term. */
  suggestion: string | null;
};

function log(...args: unknown[]) {
  if (!asJson) console.log(...args);
}

async function main() {
  if (!(await connectWithRetry())) {
    process.exitCode = 1;
    return;
  }

  const schools = await prisma.school.findMany({ select: { id: true, name: true } });
  const report: Record<string, Finding[]> = {};

  for (const school of schools) {
    log(`\n${"═".repeat(70)}`);
    log(`  ${school.name}`);
    log("═".repeat(70));

    const sessions = await prisma.academicSession.findMany({
      where: { schoolId: school.id },
      include: { terms: { orderBy: { index: "asc" } } },
      orderBy: { startsOn: "asc" },
    });

    if (!sessions.length) {
      log("\n  No academic sessions configured — nothing to reconcile against.");
      log("  Create one at /admin/sessions first, or this report cannot judge anything.");
      continue;
    }

    // The set of labels that ARE canonical for this school.
    const knownSessions = new Set(sessions.map((s) => s.label));
    const knownTerms = new Set(sessions.flatMap((s) => s.terms.map((t) => t.label)));
    const current = sessions.find((s) => s.isCurrent);
    const currentTerm = current?.terms.find((t) => t.isCurrent);

    log(`\n  Sessions on record : ${[...knownSessions].join(", ")}`);
    log(`  Term labels        : ${[...knownTerms].join(", ")}`);
    log(
      `  Currently          : ${current?.label ?? "(none set)"} · ${currentTerm?.label ?? "(none set)"}`,
    );

    const findings: Finding[] = [];

    /** A label is suspect if it isn't one this school actually defined. */
    function check(
      model: string,
      ref: string,
      sessionLabel: string | null,
      termLabel: string,
    ): void {
      const issues: string[] = [];
      let suggestion: string | null = null;

      // The seeds used to write "First Term 2026/2027" — session baked into
      // the term string. That matches nothing else in the database.
      const embedded = /\d{4}\s*\/\s*\d{4}/.test(termLabel);
      if (embedded) {
        issues.push("term label contains a session (e.g. 'First Term 2026/2027')");
        const bare = termLabel.replace(/\s*\d{4}\s*\/\s*\d{4}\s*/, "").trim();
        if (knownTerms.has(bare)) suggestion = bare;
      }

      if (!embedded && !knownTerms.has(termLabel)) {
        issues.push(`term "${termLabel}" is not a term this school defined`);
      }

      if (sessionLabel !== null && !knownSessions.has(sessionLabel)) {
        issues.push(`session "${sessionLabel}" is not a session this school defined`);
      }

      if (issues.length) {
        findings.push({
          model,
          ref,
          sessionLabel,
          termLabel,
          issue: issues.join("; "),
          suggestion,
        });
      }
    }

    // ── ReportCard ──
    const reportCards = await prisma.reportCard.findMany({
      where: { schoolId: school.id },
      select: {
        reportNumber: true,
        sessionLabel: true,
        termLabel: true,
        status: true,
        studentProfile: { select: { displayName: true } },
      },
    });
    for (const row of reportCards) {
      check(
        "ReportCard",
        `${row.reportNumber} (${row.studentProfile.displayName}, ${row.status})`,
        row.sessionLabel,
        row.termLabel,
      );
    }

    // ── SubjectGradebook ──
    const gradebooks = await prisma.subjectGradebook.findMany({
      where: { schoolId: school.id },
      select: {
        subjectName: true,
        sessionLabel: true,
        termLabel: true,
        status: true,
        classroom: { select: { displayName: true } },
      },
    });
    for (const row of gradebooks) {
      check(
        "SubjectGradebook",
        `${row.classroom.displayName} · ${row.subjectName} (${row.status})`,
        row.sessionLabel,
        row.termLabel,
      );
    }

    // ── FeeInvoice (termLabel only — no session column) ──
    const invoices = await prisma.feeInvoice.findMany({
      where: { schoolId: school.id },
      select: {
        invoiceNumber: true,
        termLabel: true,
        status: true,
        studentProfile: { select: { displayName: true } },
      },
    });
    for (const row of invoices) {
      check(
        "FeeInvoice",
        `${row.invoiceNumber} (${row.studentProfile.displayName}, ${row.status})`,
        null,
        row.termLabel,
      );
    }

    // ── Budget ──
    const budgets = await prisma.budget.findMany({
      where: { schoolId: school.id },
      select: { category: true, sessionLabel: true, termLabel: true },
    });
    for (const row of budgets) {
      check("Budget", row.category, row.sessionLabel, row.termLabel);
    }

    const scanned = reportCards.length + gradebooks.length + invoices.length + budgets.length;

    log(`\n  Scanned ${scanned} row(s):`);
    log(`    ReportCard        ${String(reportCards.length).padStart(5)}`);
    log(`    SubjectGradebook  ${String(gradebooks.length).padStart(5)}`);
    log(`    FeeInvoice        ${String(invoices.length).padStart(5)}`);
    log(`    Budget            ${String(budgets.length).padStart(5)}`);

    if (!findings.length) {
      log(`\n  ✅ No label mismatches. Every row matches a term this school defined.`);
    } else {
      log(`\n  ⚠️  ${findings.length} row(s) with a label that matches no defined term:\n`);
      const byModel = new Map<string, Finding[]>();
      for (const f of findings) {
        if (!byModel.has(f.model)) byModel.set(f.model, []);
        byModel.get(f.model)!.push(f);
      }
      for (const [model, rows] of byModel) {
        log(`  ── ${model} (${rows.length}) ──`);
        for (const r of rows.slice(0, 25)) {
          log(`     ${r.ref}`);
          log(`       stored : ${r.sessionLabel ?? "—"} · ${r.termLabel}`);
          log(`       issue  : ${r.issue}`);
          if (r.suggestion) log(`       likely : ${r.suggestion}`);
        }
        if (rows.length > 25) log(`     … and ${rows.length - 25} more`);
        log("");
      }

      log("  NOTHING HAS BEEN CHANGED.");
      log("  These rows are not misread — they are filed under a label nothing");
      log("  else uses, so they simply will not appear in a query for the");
      log("  current term. Decide per model whether that matters:");
      log("");
      log("    · ReportCard  — a released card should KEEP saying what it said.");
      log("                    Re-labelling a document already sent home is worse");
      log("                    than leaving it.");
      log("    · Gradebook   — safe to re-label if the term is unambiguous, but");
      log("                    check for a duplicate on the target label first:");
      log("                    the unique key is (class, subject, session, term).");
      log("    · FeeInvoice  — a paid invoice is a financial record. Leave it.");
      log("    · Budget      — safe to re-label; nothing downstream cites it.");
    }

    report[school.name] = findings;
  }

  if (asJson) console.log(JSON.stringify(report, null, 2));
  else log("");
}

main()
  .catch((error) => {
    logger.error("Reconciliation failed:", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
