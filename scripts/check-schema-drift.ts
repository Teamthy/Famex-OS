/**
 * Schema-drift guard.
 *
 *   DATABASE_URL="postgresql://..." npm run check:drift
 *
 * Fails if `prisma/schema.prisma` and the migration history have diverged —
 * i.e. if a database built purely from `prisma migrate deploy` would NOT match
 * the schema the application code is generated against.
 *
 * Why this exists: the repo accumulated 25 drift items before anyone noticed,
 * and two of them were live bugs rather than cosmetic —
 *
 *   • DeviceToken was declared in schema.prisma and used by
 *     app/api/push/register/route.ts, but created by no migration. Mobile push
 *     registration failed with P2021 on every migration-built environment
 *     (fresh dev machine, CI, Vercel preview, rebuilt production).
 *   • StudentProfile.photoUrl was missing the same way, breaking the student
 *     photo upload and ID-card page.
 *
 * Both were invisible locally because those databases had been patched by hand
 * or by `prisma db push`. Only a from-scratch build reveals it — which is
 * exactly what this script does in CI.
 *
 * Exits non-zero on drift so it can gate a merge or deploy.
 */
import { execFileSync } from "node:child_process";
import { logger } from "@/lib/logger";

function run(args: string[]) {
  return execFileSync("npx", ["prisma", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required (point it at a scratch database, not production).");
    process.exit(1);
  }

  console.log("Checking schema.prisma against the migration history...\n");

  let output = "";
  let drifted = false;

  try {
    output = run([
      "migrate",
      "diff",
      "--from-schema-datasource",
      "prisma/schema.prisma",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--exit-code",
    ]);
  } catch (error) {
    // --exit-code makes prisma exit 2 when a difference exists.
    const err = error as { status?: number; stdout?: string; stderr?: string };
    output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    drifted = err.status === 2;
    if (!drifted) {
      logger.error("Drift check could not run:\n", {
        error: output instanceof Error ? output.message : String(output),
      });
      process.exit(1);
    }
  }

  if (!drifted) {
    console.log("No drift. A database built from migrations matches schema.prisma.\n");
    process.exit(0);
  }

  console.error(output.trim());
  console.error(
    [
      "",
      "Schema drift detected.",
      "",
      "schema.prisma and the migrations no longer agree, so a database built by",
      "`prisma migrate deploy` will not match the Prisma client the app uses.",
      "",
      "Fix it by adding a migration that closes the gap:",
      "  npx prisma migrate dev --name describe_the_change",
      "",
      "Read the generated SQL before committing. If it wants to DROP an index",
      "that exists in the database but not in schema.prisma, the right fix is",
      "usually to DECLARE that index in schema.prisma instead — dropping it",
      "silently removes a performance guarantee something is relying on.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

main();
