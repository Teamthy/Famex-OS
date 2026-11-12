/**
 * Exercise the out-of-band Super Admin bootstrap against real Postgres.
 * This creates only a uniquely named synthetic school/account, verifies the
 * persisted role, encrypted MFA seed, recovery hashes and audit event, then
 * removes all fixtures. Never run against production.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { decryptSecret, hashRecoveryCode, totpCode, verifyTotp } from "@/lib/mfa";

const prisma = new PrismaClient();
const stamp = randomUUID().replaceAll("-", "").slice(0, 16);
const slug = `verify-super-admin-${stamp}`;
const email = `super-admin-${stamp}@example.test`;
const outputPath = join("/tmp", `${slug}.json`);
const retryOutputPath = join("/tmp", `${slug}-retry.json`);
// The verifier decrypts the bootstrap-created seed in this parent process as
// well as its child CLI. Give both processes the same disposable key; this is
// synthetic CI-only material and never a deployment secret.
const TEST_MFA_ENCRYPTION_KEY = "ci-super-admin-mfa-encryption-key-32chars";
process.env.MFA_ENCRYPTION_KEY = TEST_MFA_ENCRYPTION_KEY;
let schoolId: string | null = null;

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  PASS ${message}`);
}

function runBootstrap(output: string) {
  return spawnSync(process.execPath, ["--import", "tsx", "scripts/bootstrap-super-admin.ts"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      SCHOOL_SLUG: slug,
      SUPER_ADMIN_EMAIL: email,
      SUPER_ADMIN_NAME: "CI Super Admin",
      SUPER_ADMIN_BOOTSTRAP_CONFIRM: "CREATE_INITIAL_FAMEX_SUPER_ADMIN",
      SUPER_ADMIN_BOOTSTRAP_OUTPUT: output,
      MFA_ENCRYPTION_KEY: TEST_MFA_ENCRYPTION_KEY,
    },
  });
}

async function main() {
  if (/neon\.tech|prod/i.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("Refusing to run against what looks like production.");
  }

  try {
    const school = await prisma.school.create({
      data: {
        slug,
        name: "Super Admin Bootstrap Verification",
        address: "CI verification only",
        phone: "+2348000000000",
      },
      select: { id: true },
    });
    schoolId = school.id;

    const first = runBootstrap(outputPath);
    const firstOutput =
      first.error?.message ||
      first.stderr ||
      first.stdout ||
      `status=${first.status}; signal=${first.signal ?? "none"}`;
    check(first.status === 0, `bootstrap CLI succeeds (${firstOutput})`);
    const bundle = JSON.parse(await readFile(outputPath, "utf8")) as {
      email: string;
      initialPassword: string;
      mustChangePasswordAtFirstSignIn: boolean;
      mfa: { enabledAtBootstrap: boolean; secret: string; recoveryCodes: string[] };
    };
    check(
      bundle.email === email && bundle.initialPassword.length >= 32,
      "writes one-time credentials privately",
    );
    check(bundle.mustChangePasswordAtFirstSignIn, "requires the temporary password to be changed");
    check(
      bundle.mfa.enabledAtBootstrap && bundle.mfa.recoveryCodes.length === 10,
      "enables MFA and issues recovery codes at creation",
    );

    const user = await prisma.user.findUniqueOrThrow({
      where: { schoolId_email: { schoolId: school.id, email } },
      include: { mfaRecoveryCodes: true },
    });
    check(user.role === "SUPER_ADMIN", "persists the appended SUPER_ADMIN enum value");
    check(
      user.isActive && !user.isSuspended && user.mustChangePassword,
      "persists a forced password rotation and active account",
    );
    check(
      user.mfaEnabled && Boolean(user.mfaEnrolledAt),
      "stores MFA as enabled before the first sign-in",
    );
    check(
      Boolean(user.mfaSecretEncrypted) && !user.mfaSecretEncrypted?.includes(bundle.mfa.secret),
      "stores only the encrypted MFA secret",
    );
    const decryptedSecret = decryptSecret(user.mfaSecretEncrypted!);
    check(
      decryptedSecret === bundle.mfa.secret &&
        verifyTotp(decryptedSecret, totpCode(decryptedSecret)),
      "encrypted TOTP secret verifies against a live code",
    );
    check(
      user.mfaRecoveryCodes.length === 10 &&
        bundle.mfa.recoveryCodes.every((code) =>
          user.mfaRecoveryCodes.some((row) => row.codeHash === hashRecoveryCode(code)),
        ),
      "stores hashes for all one-time recovery codes",
    );
    const audit = await prisma.auditLog.findFirst({
      where: { schoolId: school.id, actorUserId: user.id, action: "SUPER_ADMIN_BOOTSTRAPPED" },
    });
    check(Boolean(audit), "writes the bootstrap audit record");

    const repeated = runBootstrap(retryOutputPath);
    check(repeated.status !== 0, "rejects a second bootstrap attempt");
    check(
      (await prisma.user.count({ where: { role: "SUPER_ADMIN" } })) === 1,
      "does not create a second Super Admin",
    );
    console.log("Super Admin bootstrap verification: PASS");
  } finally {
    if (schoolId) {
      await prisma.auditLog.deleteMany({ where: { schoolId } });
      await prisma.mfaRecoveryCode.deleteMany({ where: { schoolId } });
      await prisma.user.deleteMany({ where: { schoolId } });
      await prisma.school.deleteMany({ where: { id: schoolId } });
    }
    await rm(outputPath, { force: true });
    await rm(retryOutputPath, { force: true });
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Super Admin bootstrap verification failed:",
    error instanceof Error ? error.stack : String(error),
  );
  process.exitCode = 1;
});
