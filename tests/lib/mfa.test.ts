import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  totpCode,
  verifyTotp,
} from "@/lib/mfa";

/**
 * MFA primitives (B). The TOTP vectors are RFC 6238 Appendix B (SHA-1,
 * secret "12345678901234567890") truncated to 6 digits — if these numbers
 * ever move, every enrolled authenticator breaks, so they are pinned here.
 */
const RFC_SECRET_ASCII = "12345678901234567890";
const RFC_SECRET_B32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("base32", () => {
  it("encodes the RFC secret and round-trips arbitrary bytes", () => {
    expect(base32Encode(Buffer.from(RFC_SECRET_ASCII, "ascii"))).toBe(RFC_SECRET_B32);
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 42]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });
});

describe("TOTP (RFC 6238)", () => {
  it("matches the published test vectors at 6 digits", () => {
    expect(totpCode(RFC_SECRET_B32, 59_000)).toBe("287082");
    expect(totpCode(RFC_SECRET_B32, 1_111_111_109_000)).toBe("081804");
  });

  it("verifies the current code and tolerates one step of drift", () => {
    const at = 1_700_000_000_000;
    const code = totpCode(RFC_SECRET_B32, at);
    expect(verifyTotp(RFC_SECRET_B32, code, { atMs: at })).toBe(true);
    const nextStep = totpCode(RFC_SECRET_B32, at + 30_000);
    expect(verifyTotp(RFC_SECRET_B32, nextStep, { atMs: at })).toBe(true);
    const twoStepsAway = totpCode(RFC_SECRET_B32, at + 90_000);
    expect(verifyTotp(RFC_SECRET_B32, twoStepsAway, { atMs: at })).toBe(false);
  });

  it("rejects malformed codes", () => {
    expect(verifyTotp(RFC_SECRET_B32, "12345")).toBe(false);
    expect(verifyTotp(RFC_SECRET_B32, "abcdef")).toBe(false);
    expect(verifyTotp(RFC_SECRET_B32, "")).toBe(false);
  });
});

describe("secret encryption at rest", () => {
  it("round-trips and rejects tampering", () => {
    process.env.MFA_ENCRYPTION_KEY = "test-encryption-key-material-0123456789abcdef";
    const payload = encryptSecret(RFC_SECRET_B32);
    expect(payload.startsWith("v1:")).toBe(true);
    expect(payload).not.toContain(RFC_SECRET_B32);
    expect(decryptSecret(payload)).toBe(RFC_SECRET_B32);
    const tampered = `${payload.slice(0, -2)}AA`;
    expect(() => decryptSecret(tampered)).toThrow();
  });
});

describe("recovery codes", () => {
  it("generates unique, unambiguous codes", () => {
    const codes = generateRecoveryCodes(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(code).not.toMatch(/[01IOL]/);
    }
  });

  it("hashes case, space and dash variants identically", () => {
    expect(hashRecoveryCode("abcd-efgh")).toBe(hashRecoveryCode("ABCDEFGH"));
    expect(hashRecoveryCode("abcd efgh")).toBe(hashRecoveryCode("ABCDEFGH"));
    expect(hashRecoveryCode("ABCD-EFGH")).not.toBe(hashRecoveryCode("ABCD-EFGJ"));
  });
});
