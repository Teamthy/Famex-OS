/**
 * One-time, out-of-band bootstrap for the first Famex Super Admin.
 *
 * This script is deliberately not an HTTP route and never creates an account
 * through school staff provisioning. It requires an explicit confirmation,
 * the configured Famex school, an empty SUPER_ADMIN role, MFA_ENCRYPTION_KEY,
 * and a private output path outside the repository. It creates an MFA-ready
 * account immediately and writes the one-time credentials/setup bundle with
 * mode 0600. Transfer that bundle securely, then delete it.
 *
 * Example (run from a secured operator workstation, never CI):
 * SUPER_ADMIN_BOOTSTRAP_CONFIRM=CREATE_INITIAL_FAMEX_SUPER_ADMIN \
 * SUPER_ADMIN_EMAIL=operator@example.com SUPER_ADMIN_NAME='Famex Operator' \
 * SUPER_ADMIN_BOOTSTRAP_OUTPUT=/tmp/famex-super-admin-setup.json \
 * DATABASE_URL='postgresql://…' npx tsx scripts/bootstrap-super-admin.ts
 *
 * Never point this command at CI credentials or a production database during
 * tests. The CI verifier uses only an isolated disposable Postgres service.
 */
import { randomBytes } from "node:crypto";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";
import {
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUrl,
} from "../lib/mfa";
import { schoolSlugFromEnv } from "../lib/school-defaults";

const CONFIRMATION = "CREATE_INITIAL_FAMEX_SUPER_ADMIN";
const prisma = new PrismaClient();

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function ensurePrivateOutputPath(value: string): string {
  if (!isAbsolute(value)) throw new Error("SUPER_ADMIN_BOOTSTRAP_OUTPUT must be an absolute path.");
  const outputPath = resolve(value);
  const fromRepo = relative(process.cwd(), outputPath);
  if (
    fromRepo === "" ||
    (fromRepo !== ".." && !fromRepo.startsWith(`..${sep}`) && !isAbsolute(fromRepo))
  ) {
    throw new Error("The bootstrap output file must be outside the repository.");
  }
  return outputPath;
}

async function main() {
  if (process.env.SUPER_ADMIN_BOOTSTRAP_CONFIRM !== CONFIRMATION) {
    throw new Error(`Set SUPER_ADMIN_BOOTSTRAP_CONFIRM=${CONFIRMATION} to proceed.`);
  }
  if (!process.env.MFA_ENCRYPTION_KEY || process.env.MFA_ENCRYPTION_KEY.length < 32) {
    throw new Error("A dedicated MFA_ENCRYPTION_KEY of at least 32 characters is required.");
  }

  const email = requiredEnv("SUPER_ADMIN_EMAIL").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("SUPER_ADMIN_EMAIL must be a valid email address.");
  }
  const name = requiredEnv("SUPER_ADMIN_NAME");
  const outputPath = ensurePrivateOutputPath(requiredEnv("SUPER_ADMIN_BOOTSTRAP_OUTPUT"));
  const school = await prisma.school.findUnique({
    where: { slug: schoolSlugFromEnv() },
    select: { id: true, name: true, status: true },
  });
  if (!school || school.status !== "ACTIVE") {
    throw new Error(
      "The configured active Famex school was not found; refusing to guess or create one.",
    );
  }

  const initialPassword = randomBytes(32).toString("base64url");
  const totpSecret = generateTotpSecret();
  const recoveryCodes = generateRecoveryCodes(10);
  const bundle = {
    email,
    initialPassword,
    mustChangePasswordAtFirstSignIn: true,
    school: school.name,
    mfa: {
      enabledAtBootstrap: true,
      issuer: school.name,
      secret: totpSecret,
      otpauthUrl: otpauthUrl({ issuer: school.name, account: email, secret: totpSecret }),
      recoveryCodes,
    },
    createdAt: new Date().toISOString(),
  };

  await mkdir(resolve(outputPath, ".."), { recursive: true, mode: 0o700 });
  await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await chmod(outputPath, 0o600);

  try {
    const passwordHash = await bcrypt.hash(initialPassword, 12);
    const encryptedTotp = encryptSecret(totpSecret);
    const userId = await prisma.$transaction(async (tx) => {
      // Serialize two concurrent invocations; only one may ever create the
      // first platform operator. The lock is transaction-scoped and contains
      // no customer-controlled input.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(7382419, 27)`;
      const existing = await tx.user.count({ where: { role: UserRole.SUPER_ADMIN } });
      if (existing > 0)
        throw new Error("A Super Admin already exists; bootstrap is one-time only.");
      const emailTaken = await tx.user.findUnique({
        where: { schoolId_email: { schoolId: school.id, email } },
        select: { id: true },
      });
      if (emailTaken)
        throw new Error("That email already belongs to an account in the Famex school.");

      const user = await tx.user.create({
        data: {
          schoolId: school.id,
          email,
          name,
          role: UserRole.SUPER_ADMIN,
          passwordHash,
          mustChangePassword: true,
          mfaEnabled: true,
          mfaSecretEncrypted: encryptedTotp,
          mfaEnrolledAt: new Date(),
        },
        select: { id: true },
      });
      await tx.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((code) => ({
          schoolId: school.id,
          userId: user.id,
          codeHash: hashRecoveryCode(code),
        })),
      });
      await tx.auditLog.create({
        data: {
          schoolId: school.id,
          actorUserId: user.id,
          action: "SUPER_ADMIN_BOOTSTRAPPED",
          entityType: "User",
          entityId: user.id,
          metadata: { source: "out_of_band_cli", mfaEnabled: true },
        },
      });
      return user.id;
    });
    console.log(`Created MFA-enforced Super Admin ${email} (${userId}) for ${school.name}.`);
    console.log(
      `One-time setup bundle written to ${outputPath}; securely transfer it, then delete it.`,
    );
  } catch (error) {
    await rm(outputPath, { force: true });
    throw error;
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
