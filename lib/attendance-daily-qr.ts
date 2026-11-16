import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "FAMEX-CLOCK-V1";

export type AttendanceQrAudience = "STAFF" | "STUDENT";

export type DailyAttendanceQrClaims = {
  schoolId: string;
  profileId: string;
  audience: AttendanceQrAudience;
  workDate: string;
};

function signingSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be configured with at least 32 characters for attendance QR.",
    );
  }
  return secret;
}

function validClaims(value: unknown): value is DailyAttendanceQrClaims & { v: 1 } {
  if (!value || typeof value !== "object") return false;
  const claims = value as Record<string, unknown>;
  return (
    claims.v === 1 &&
    typeof claims.schoolId === "string" &&
    claims.schoolId.length > 0 &&
    typeof claims.profileId === "string" &&
    claims.profileId.length > 0 &&
    (claims.audience === "STAFF" || claims.audience === "STUDENT") &&
    typeof claims.workDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(claims.workDate)
  );
}

/** Issue an authenticated, signed QR ticket scoped to a person, school and local workday. */
export function createDailyAttendanceQr(claims: DailyAttendanceQrClaims): string {
  if (!validClaims({ ...claims, v: 1 })) throw new Error("Invalid daily attendance QR claims.");
  const encoded = Buffer.from(JSON.stringify({ v: 1, ...claims }), "utf8").toString("base64url");
  const signature = createHmac("sha256", signingSecret())
    .update(`${PREFIX}.${encoded}`)
    .digest("base64url");
  return `${PREFIX}.${encoded}.${signature}`;
}

export function isDailyAttendanceQr(value: string): boolean {
  return value.trim().startsWith(`${PREFIX}.`);
}

/** Verify provider-independent QR input; callers must additionally check current school workday. */
export function verifyDailyAttendanceQr(value: string): DailyAttendanceQrClaims | null {
  const parts = value.trim().split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const [, encoded, signature] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;

  const expected = createHmac("sha256", signingSecret()).update(`${PREFIX}.${encoded}`).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  return validClaims(claims) ? claims : null;
}
