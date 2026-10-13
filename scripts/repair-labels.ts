/**
 * Targeted label repair.
 *
 * Companion to `reconcile:labels`, which only reports. This one can write —
 * but only for the models you name, and only after showing you the plan.
 *
 *   npm run repair:labels -- --gradebooks           # dry run (default)
 *   npm run repair:labels -- --gradebooks --apply   # actually write
 *
 * Models:
 *   --gradebooks   SubjectGradebook — re-point at the current session/term
 *   --budgets      Budget — re-point at the current session/term
 *
 * Deliberately NOT offered:
 *   ReportCard   a released card is a document already sent home, and the
 *                number/labels on it are what a parent can verify at
 *                /verify/report. Silently rewriting history is worse than a
 *                stale label.
 *   FeeInvoice   a financial record. Its termLabel is descriptive text on an
 *                invoice that may already be paid; nothing queries fees by
 *                term any more (see the report-card generator), so there is
 *                no benefit worth the risk.
 *
 * Everything runs in ONE transaction. A partial repair is harder to reason
 * about than none.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

/** A planned write, expressed against the TRANSACTION client. */
type Step = (tx: Prisma.TransactionClient) => Promise<unknown>;

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const DO_GRADEBOOKS = args.includes("--gradebooks");
const DO_BUDGETS = args.includes("--budgets");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

async function main() {
  if (!DO_GRADEBOOKS && !DO_BUDGETS) {
    console.log(`
Targeted label repair — nothing selected, so nothing to do.

  npm run repair:labels -- --gradebooks           preview
  npm run repair:labels -- --gradebooks --apply   write

  --gradebooks   re-point SubjectGradebook rows at the current session/term
  --budgets      re-point Budget rows at the current session/term

ReportCard and FeeInvoice are intentionally not repairable here — see the
comment at the top of scripts/repair-labels.ts for why.
`);
    return;
  }

  console.log(
    APPLY
      ? `\n${RED}APPLY MODE — this will write.${RESET}\n`
      : `\n${DIM}Dry run. Nothing will be written. Add --apply to commit.${RESET}\n`,
  );

  const schools = await prisma.school.findMany({ select: { id: true, name: true } });

  for (const school of schools) {
    const currentTerm = await prisma.term.findFirst({
      where: { schoolId: school.id, isCurrent: true },
      include: { session: true },
    });

    if (!currentTerm) {
      console.log(`${school.name}: no current term set — skipped.`);
      continue;
    }

    const target = {
      sessionLabel: currentTerm.session.label,
      termLabel: currentTerm.label,
    };

    console.log("═".repeat(70));
    console.log(`  ${school.name}`);
    console.log(`  Target: ${target.sessionLabel} · ${target.termLabel}`);
    console.log("═".repeat(70));

    const knownSessions = new Set(
      (await prisma.academicSession.findMany({ where: { schoolId: school.id } })).map(
        (s) => s.label,
      ),
    );
    const knownTerms = new Set(
      (await prisma.term.findMany({ where: { schoolId: school.id } })).map((t) => t.label),
    );

    // Steps take the transaction client as an argument. The first version of
    // this closed over the global `prisma`, so every update auto-committed
    // OUTSIDE the transaction — the writes landed, the empty transaction then
    // timed out, and the catch block printed "nothing committed" while the
    // data had in fact changed. An error message that says the opposite of
    // the truth is worse than no error message.
    const plan: Step[] = [];

    // ── SubjectGradebook ──
    if (DO_GRADEBOOKS) {
      const rows = await prisma.subjectGradebook.findMany({
        where: { schoolId: school.id },
        include: {
          classroom: { select: { displayName: true } },
          entries: { select: { id: true } },
        },
      });

      const drifted = rows.filter(
        (r) => !knownSessions.has(r.sessionLabel) || !knownTerms.has(r.termLabel),
      );

      console.log(`\n── SubjectGradebook: ${drifted.length} drifted of ${rows.length}`);

      for (const row of drifted) {
        // The unique key is (classId, subjectName, sessionLabel, termLabel).
        // If a row ALREADY exists on the target labels, re-pointing this one
        // would violate it — and, worse, silently merge two terms' scores.
        const collision = rows.find(
          (other) =>
            other.id !== row.id &&
            other.classId === row.classId &&
            other.subjectName === row.subjectName &&
            other.sessionLabel === target.sessionLabel &&
            other.termLabel === target.termLabel,
        );

        const label = `${row.classroom.displayName} · ${row.subjectName} [${row.status}] ${row.entries.length} entries`;

        if (collision) {
          console.log(`  ${RED}SKIP${RESET} ${label}`);
          console.log(
            `       a gradebook already exists on ${target.sessionLabel} · ${target.termLabel}`,
          );
          console.log(`       ${DIM}merging them would combine two terms of scores${RESET}`);
          continue;
        }

        console.log(`  ${GREEN}MOVE${RESET} ${label}`);
        console.log(
          `       ${row.sessionLabel} · ${row.termLabel}  →  ${target.sessionLabel} · ${target.termLabel}`,
        );

        plan.push((tx) =>
          tx.subjectGradebook.update({
            where: { id: row.id },
            data: { sessionLabel: target.sessionLabel, termLabel: target.termLabel },
          }),
        );
      }
    }

    // ── Budget ──
    if (DO_BUDGETS) {
      const rows = await prisma.budget.findMany({ where: { schoolId: school.id } });
      const drifted = rows.filter(
        (r) => !knownSessions.has(r.sessionLabel) || !knownTerms.has(r.termLabel),
      );

      console.log(`\n── Budget: ${drifted.length} drifted of ${rows.length}`);

      for (const row of drifted) {
        // Unique key: (schoolId, category, termLabel, sessionLabel).
        const collision = rows.find(
          (other) =>
            other.id !== row.id &&
            other.category === row.category &&
            other.sessionLabel === target.sessionLabel &&
            other.termLabel === target.termLabel,
        );

        if (collision) {
          console.log(`  ${RED}SKIP${RESET} ${row.category} — already exists on the target term`);
          continue;
        }

        console.log(`  ${GREEN}MOVE${RESET} ${row.category}`);
        console.log(
          `       ${row.sessionLabel} · ${row.termLabel}  →  ${target.sessionLabel} · ${target.termLabel}`,
        );

        plan.push((tx) =>
          tx.budget.update({
            where: { id: row.id },
            data: { sessionLabel: target.sessionLabel, termLabel: target.termLabel },
          }),
        );
      }
    }

    // ── Execute ──
    console.log("");
    if (!plan.length) {
      console.log(`  Nothing to change.\n`);
      continue;
    }

    if (!APPLY) {
      console.log(
        `  ${YELLOW}${plan.length} row(s) would be updated. Re-run with --apply.${RESET}\n`,
      );
      continue;
    }

    // One transaction: a half-finished repair is worse than none.
    //
    // The default 5s timeout is not enough against a remote database — each
    // update is a round trip, and Neon adds latency to every one. Eight
    // updates were enough to blow it, which surfaced as a confusing P2028
    // "Transaction not found" rather than an honest timeout.
    await prisma.$transaction(
      async (tx) => {
        for (const step of plan) await step(tx);
      },
      { timeout: 120_000, maxWait: 30_000 },
    );
    console.log(`  ${GREEN}${plan.length} row(s) updated.${RESET}\n`);
  }

  if (APPLY) {
    console.log("Re-run `npm run reconcile:labels` to confirm.\n");
  }
}

main()
  .catch((error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.error(
        `\n${RED}Unique constraint hit — rolled back, nothing changed.${RESET}\n` +
          `Two rows would have collided on the target labels. Re-run the dry run.\n`,
      );
    } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028") {
      console.error(
        `\n${RED}The transaction timed out.${RESET}\n` +
          `It was rolled back, so the data should be unchanged — but verify with:\n\n` +
          `    npm run reconcile:labels\n`,
      );
    } else {
      // Do NOT claim "nothing committed" — this handler cannot know that.
      console.error(
        `\n${RED}Repair failed.${RESET} Verify the actual state with ` +
          `\`npm run reconcile:labels\` before re-running.\n`,
      );
      logger.error("Request failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
