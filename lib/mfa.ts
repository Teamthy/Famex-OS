import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * TOTP multi-factor authentication (B, FIS production core).
 *
 * ── Design ─────────────────────────────────────────────────────────────────
 * - RFC 4226/6238 TOTP (SHA-1, 30s step, 6 digits) — the interoperable
 *   subset every authenticator app (Google/Microsoft Authenticator, Authy)
 *   supports. No new dependency: HMAC + base32 is ~50 lines and pinned by
 *   the RFC test vectors in tests/lib/mfa.test.ts.
 * - The secret is stored AES-256-GCM encrypted (key derived from
 *   MFA_ENCRYPTION_KEY, falling back to AUTH_SECRET). A database leak must
 *   not hand out working second factors.
 * - Recovery codes are single-use; only SHA-256 hashes are stored and the
 *   plain codes are shown exactly once, at enrolment.
 * - Login flow: password → (if enrolled) short-lived challenge token →
 *   /api/auth/mfa/verify → full session. The challenge is NOT a session:
 *   verifyMfaChallenge is the only thing that accepts it.
 */

// ── Base32 (RFC 4648) ───────────────────────────────────────────────────────

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/[\s-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character in TOTP secret.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ── TOTP core ───────────────────────────────────────────────────────────────

const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;

export function generateTotpSecret(): string {
  // 20 bytes = 160 bits, the RFC 4226 recommended secret length for SHA-1.
  return base32Encode(randomBytes(20));
}

function hotp(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function totpCode(secretBase32: string, atMs: number = Date.now()): string {
  return hotp(secretBase32, Math.floor(atMs / 1000 / TOTP_STEP_SECONDS));
}

/** Constant-time compare that tolerates different lengths without leaking via early exit on content. */
function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a 6-digit code allowing ±window steps of clock drift (default 1 =
 * roughly ±30s, the usual authenticator tolerance).
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  opts: { atMs?: number; window?: number } = {},
): boolean {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const atMs = opts.atMs ?? Date.now();
  const window = opts.window ?? 1;
  const counter = Math.floor(atMs / 1000 / TOTP_STEP_SECONDS);
  for (let step = -window; step <= window; step += 1) {
    if (safeEqualString(hotp(secretBase32, counter + step), normalized)) return true;
  }
  return false;
}

export function otpauthUrl(input: { issuer: string; account: string; secret: string }): string {
  const label = encodeURIComponent(`${input.issuer}:${input.account}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ── Secret encryption at rest ───────────────────────────────────────────────

function encryptionKey(): Buffer {
  const material = process.env.MFA_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!material || material.length < 32) {
    throw new Error("MFA_ENCRYPTION_KEY or AUTH_SECRET (32+ characters) is required for MFA.");
  }
  return createHash("sha256").update(material).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Unrecognised MFA secret format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// ── Recovery codes ──────────────────────────────────────────────────────────

const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L confusables

export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const bytes = randomBytes(8);
    const chars = [...bytes].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]);
    codes.push(`${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`);
  }
  return codes;
}

export function hashRecoveryCode(code: string): string {
  const normalized = code.replace(/[\s-]/g, "").toUpperCase();
  return createHash("sha256").update(normalized).digest("hex");
}

// ── Enrolment / verification service ────────────────────────────────────────

type MfaUserRow = {
  id: string;
  schoolId: string;
  email: string;
  mfaEnabled: boolean;
  mfaSecretEncrypted: string | null;
};

async function loadMfaUser(userId: string): Promise<MfaUserRow> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, schoolId: true, email: true, mfaEnabled: true, mfaSecretEncrypted: true },
  });
  if (!user) throw new Error("That account could not be found.");
  return user;
}

async function auditMfa(schoolId: string, userId: string, action: string) {
  await prisma.auditLog.create({
    data: { schoolId, actorUserId: userId, action, entityType: "User", entityId: userId },
  });
}

/**
 * Begin enrolment: store a fresh (still disabled) secret and hand back the
 * otpauth URI for the authenticator app. Calling this again before
 * confirming simply replaces the pending secret — nothing is live until
 * confirmMfaEnrolment verifies a code from the new secret.
 */
export async function startMfaEnrolment(input: {
  userId: string;
  issuer: string;
}): Promise<{ secret: string; otpauthUrl: string }> {
  const user = await loadMfaUser(input.userId);
  if (user.mfaEnabled) {
    throw new Error("Two-factor authentication is already on. Turn it off before enrolling again.");
  }
  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaSecretEncrypted: encryptSecret(secret), mfaEnabled: false, mfaEnrolledAt: null },
  });
  return {
    secret,
    otpauthUrl: otpauthUrl({ issuer: input.issuer, account: user.email, secret }),
  };
}

/** Confirm enrolment with a live code; returns the one-time recovery codes. */
export async function confirmMfaEnrolment(input: {
  userId: string;
  code: string;
}): Promise<{ recoveryCodes: string[] }> {
  const user = await loadMfaUser(input.userId);
  if (user.mfaEnabled) throw new Error("Two-factor authentication is already on.");
  if (!user.mfaSecretEncrypted) {
    throw new Error("Start enrolment first so we can give you a setup key.");
  }
  const secret = decryptSecret(user.mfaSecretEncrypted);
  if (!verifyTotp(secret, input.code)) {
    throw new Error("That code did not match. Check the time on your phone and try the next code.");
  }
  const recoveryCodes = generateRecoveryCodes(10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true, mfaEnrolledAt: new Date() },
    }),
    prisma.mfaRecoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.mfaRecoveryCode.createMany({
      data: recoveryCodes.map((code) => ({
        schoolId: user.schoolId,
        userId: user.id,
        codeHash: hashRecoveryCode(code),
      })),
    }),
  ]);
  await auditMfa(user.schoolId, user.id, "MFA_ENROLLED");
  return { recoveryCodes };
}

export type SecondFactorMethod = "TOTP" | "RECOVERY_CODE";

/**
 * Verify the second factor at sign-in (or before disabling MFA). A recovery
 * code is burned the moment it succeeds — replaying it must fail.
 */
export async function verifySecondFactor(input: {
  userId: string;
  code: string;
}): Promise<{ ok: boolean; method?: SecondFactorMethod }> {
  const user = await loadMfaUser(input.userId);
  if (!user.mfaEnabled || !user.mfaSecretEncrypted) return { ok: false };

  const secret = decryptSecret(user.mfaSecretEncrypted);
  if (verifyTotp(secret, input.code)) return { ok: true, method: "TOTP" };

  const candidate = await prisma.mfaRecoveryCode.findFirst({
    where: { userId: user.id, codeHash: hashRecoveryCode(input.code), usedAt: null },
    select: { id: true },
  });
  if (!candidate) return { ok: false };
  // Conditional update so two simultaneous attempts cannot both spend it.
  const spent = await prisma.mfaRecoveryCode.updateMany({
    where: { id: candidate.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (spent.count !== 1) return { ok: false };
  await auditMfa(user.schoolId, user.id, "MFA_RECOVERY_CODE_USED");
  return { ok: true, method: "RECOVERY_CODE" };
}

/** Disable MFA — only with a currently-valid second factor. */
export async function disableMfa(input: { userId: string; code: string }): Promise<void> {
  const user = await loadMfaUser(input.userId);
  if (!user.mfaEnabled) throw new Error("Two-factor authentication is not on.");
  const verified = await verifySecondFactor(input);
  if (!verified.ok) throw new Error("That code did not match, so two-factor stays on.");
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false, mfaSecretEncrypted: null, mfaEnrolledAt: null },
    }),
    prisma.mfaRecoveryCode.deleteMany({ where: { userId: user.id } }),
  ]);
  await auditMfa(user.schoolId, user.id, "MFA_DISABLED");
}
