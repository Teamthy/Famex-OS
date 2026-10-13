/**
 * RLS tenant-isolation verification — runs against a REAL database.
 *
 *   DATABASE_URL="postgresql://..." npm run verify:rls
 *
 * Unit tests (tests/lib/db-rls.test.ts) check the SQL withSchool() emits, but
 * they cannot prove Postgres actually enforces isolation. This script does: it
 * seeds two throwaway schools, then tries to read and write across the boundary.
 *
 * Run it after any change to the RLS migrations, and as a smoke test against a
 * fresh environment before go-live. It cleans up after itself.
 *
 * Exits non-zero if any check fails, so it can gate a deploy.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

/**
 * Pin the pool to a SINGLE connection.
 *
 * The "connection hygiene" check below only means something if the unscoped
 * query reuses the same backend that just ran withSchool(). With a multi-
 * connection pool Prisma may hand out a fresh one and the check passes
 * vacuously — it did exactly that while this script was being written, and
 * silently missed a deliberately reintroduced bug.
 *
 * connection_limit=1 also matches the documented production DATABASE_URL in
 * .env.example, so this mirrors how the app really runs.
 */
function singleConnectionUrl(raw: string | undefined) {
  if (!raw) throw new Error("DATABASE_URL is required to verify RLS.");
  const url = new URL(raw);
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("pool_timeout", "20");
  return url.toString();
}

const prisma = new PrismaClient({
  datasources: { db: { url: singleConnectionUrl(process.env.DATABASE_URL) } },
});

/**
 * Local mirror of lib/db-rls.ts → withSchool(), bound to THIS client.
 *
 * We deliberately do not import the real helper: it closes over the shared
 * lib/prisma singleton, which is a *different* client with its own pool. The
 * connection-hygiene check below is only meaningful when the scoped
 * transaction and the follow-up unscoped read share one backend, so the helper
 * has to run on this pinned single-connection client.
 *
 * Keep this in sync with lib/db-rls.ts — the SQL it emits is asserted by
 * tests/lib/db-rls.test.ts.
 */
const SCHOOL_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,62}[A-Za-z0-9])?$/;

async function withSchool<T>(
  schoolId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!schoolId || !SCHOOL_ID_PATTERN.test(schoolId)) {
    throw new Error("withSchool() requires a valid schoolId.");
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
    return fn(tx);
  });
}

const A = "rlsverify_a";
const B = "rlsverify_b";

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "  PASS" : "  FAIL"}  ${name}` + (ok ? "" : `  (got ${actual}, want ${expected})`),
  );
}

function checkThrows(name: string, threw: boolean) {
  if (!threw) failures += 1;
  console.log(`${threw ? "  PASS" : "  FAIL"}  ${name}`);
}

async function cleanup() {
  // Children first — FKs.
  await prisma.feeInvoice.deleteMany({ where: { schoolId: { in: [A, B] } } });
  await prisma.studentProfile.deleteMany({ where: { schoolId: { in: [A, B] } } });
  await prisma.user.deleteMany({ where: { schoolId: { in: [A, B] } } });
  await prisma.schoolClass.deleteMany({ where: { schoolId: { in: [A, B] } } });
  await prisma.school.deleteMany({ where: { id: { in: [A, B] } } });
}

async function seed() {
  for (const [id, label] of [
    [A, "A"],
    [B, "B"],
  ] as const) {
    await prisma.school.create({
      data: {
        id,
        slug: `rlsverify-${label.toLowerCase()}`,
        name: `RLS Verify ${label}`,
        address: "test",
        phone: "+2340000000000",
        email: `rlsverify-${label.toLowerCase()}@example.test`,
      },
    });
    await prisma.schoolClass.create({
      data: { id: `${id}_cls`, schoolId: id, level: "JSS1", arm: "A", displayName: "JSS1A" },
    });
    await prisma.user.create({
      data: {
        id: `${id}_usr`,
        schoolId: id,
        email: `stu-${label.toLowerCase()}@example.test`,
        passwordHash: "x",
        name: `Student ${label}`,
        role: "STUDENT",
      },
    });
    await prisma.studentProfile.create({
      data: {
        id: `${id}_stu`,
        schoolId: id,
        userId: `${id}_usr`,
        studentId: `RLS-${label}-1`,
        firstName: "Student",
        lastName: label,
        displayName: `Student ${label}`,
        currentClassId: `${id}_cls`,
      },
    });
  }

  await prisma.feeInvoice.create({
    data: {
      id: `${A}_inv`,
      schoolId: A,
      studentProfileId: `${A}_stu`,
      invoiceNumber: "RLS-INV-A",
      title: "A fees",
      termLabel: "First Term",
      totalAmount: 50_000,
      amountPaid: 0,
      balanceDue: 50_000,
    },
  });
  await prisma.feeInvoice.create({
    data: {
      id: `${B}_inv`,
      schoolId: B,
      studentProfileId: `${B}_stu`,
      invoiceNumber: "RLS-INV-B",
      title: "B fees",
      termLabel: "First Term",
      totalAmount: 90_000,
      amountPaid: 0,
      balanceDue: 90_000,
    },
  });
}

async function main() {
  console.log("RLS tenant-isolation verification\n");

  // ── Guard: a superuser (or any role with BYPASSRLS) silently bypasses every
  //    policy, so this script's checks pass vacuously while RLS proves nothing.
  //    That is exactly the trap that produced a confusing "isolation is not
  //    safe" wall of failures below — the connecting role was a superuser, so
  //    all reads/writes leaked by design. Fail fast with a clear reason instead.
  //    The production DATABASE_URL role must therefore be a non-superuser.
  const roleRow = await prisma.$queryRaw<
    { by: boolean }[]
  >`SELECT rolsuper AS by FROM pg_roles WHERE rolname = current_user`;
  const isSuperuser = roleRow[0]?.by === true;
  if (isSuperuser) {
    console.error(
      "\n✖ The DATABASE_URL role is a SUPERUSER (or BYPASSRLS). Row-Level Security is\n" +
        "  BYPASSED entirely for this connection, so these checks cannot prove isolation.\n" +
        "  Create a non-superuser role for the app and re-run with it:\n" +
        "    CREATE ROLE app LOGIN PASSWORD '<strong>';\n" +
        "    GRANT USAGE ON SCHEMA public TO app;\n" +
        "    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;\n" +
        "    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app;\n" +
        "  then:  DATABASE_URL=postgresql://app:<strong>@host/db npm run verify:rls\n",
    );
    process.exit(1);
  }

  await cleanup();
  await seed();

  console.log("Reads");
  check(
    "school A sees only its own invoice",
    await withSchool(A, (tx) => tx.feeInvoice.count({ where: { id: { contains: "rlsverify" } } })),
    1,
  );
  check(
    "school B sees only its own invoice",
    await withSchool(B, (tx) => tx.feeInvoice.count({ where: { id: { contains: "rlsverify" } } })),
    1,
  );

  // The important one: an aggregate with NO tenant filter. If the app ever
  // forgets a WHERE clause, RLS must still bound the result.
  const sum = await withSchool(A, (tx) =>
    tx.feeInvoice.aggregate({
      _sum: { totalAmount: true },
      where: { id: { contains: "rlsverify" } },
    }),
  );
  check("unfiltered SUM under A excludes B", sum._sum.totalAmount, 50_000);

  console.log("\nConnection hygiene");
  // Regression guard for the empty-string GUC bug.
  //
  // After a scoped transaction commits, Postgres does NOT restore a custom GUC
  // to NULL — it resets it to the EMPTY STRING. A policy that only tests
  // `IS NULL` therefore degrades to `"schoolId" = ''`, which matches nothing,
  // and every later UNSCOPED query on that pooled connection silently returns
  // zero rows. With connection_limit=1 (the documented production setting) the
  // very next request hits it.
  //
  // Assert the raw setting first, so a failure points straight at the cause
  // rather than at a confusing row count.
  const guc = await prisma.$queryRaw<
    { v: string | null }[]
  >`SELECT current_setting('app.current_school_id', true) AS v`;
  const gucValue = guc[0]?.v ?? null;
  const contextCleared = gucValue === null || gucValue === "";
  check("tenant context is cleared after the transaction", contextCleared, true);

  // The real assertion: with the context cleared (to '' in practice), an
  // unscoped read must still see every row.
  check(
    "unscoped query after withSchool() still sees all rows",
    await prisma.feeInvoice.count({ where: { id: { contains: "rlsverify" } } }),
    2,
  );

  console.log("\nWrites");
  // updateMany (not update) so a blocked write reports count 0 rather than
  // raising — keeps the output clean while asserting the same guarantee.
  const updated = await withSchool(A, (tx) =>
    tx.feeInvoice.updateMany({ where: { id: `${B}_inv` }, data: { amountPaid: 99_999 } }),
  );
  check("school A cannot update school B's invoice", updated.count, 0);

  check(
    "school B's invoice is untouched",
    (await prisma.feeInvoice.findUnique({ where: { id: `${B}_inv` } }))?.amountPaid,
    0,
  );

  const deleted = await withSchool(A, (tx) =>
    tx.feeInvoice.deleteMany({ where: { id: `${B}_inv` } }),
  );
  check("school A's delete of school B's invoice affects 0 rows", deleted.count, 0);
  check(
    "school B's invoice still exists",
    await prisma.feeInvoice.count({ where: { id: `${B}_inv` } }),
    1,
  );

  console.log("\nInput validation");
  let threw = false;
  try {
    await withSchool("", (tx) => tx.feeInvoice.count());
  } catch {
    threw = true;
  }
  checkThrows("blank schoolId is rejected (would disable isolation)", threw);

  await cleanup();
  await prisma.$disconnect();

  console.log(
    failures === 0
      ? "\nAll RLS checks passed.\n"
      : `\n${failures} RLS check(s) FAILED — tenant isolation is not safe.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  logger.error("\nVerification crashed:", {
    error: error instanceof Error ? error.message : String(error),
  });
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
