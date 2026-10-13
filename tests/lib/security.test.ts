import { describe, it, expect } from "vitest";
import { createOpaqueToken, hashToken, createApplicationId, safeFileName } from "@/lib/security";

describe("createOpaqueToken", () => {
  it("generates a base64url string", () => {
    const token = createOpaqueToken();
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
  });

  it("generates unique tokens", () => {
    const a = createOpaqueToken();
    const b = createOpaqueToken();
    expect(a).not.toBe(b);
  });

  it("respects byte length parameter", () => {
    const short = createOpaqueToken(8);
    const long = createOpaqueToken(64);
    expect(long.length).toBeGreaterThan(short.length);
  });
});

describe("hashToken", () => {
  it("returns a hex string", () => {
    const hash = hashToken("test-token");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic", () => {
    const a = hashToken("same-input");
    const b = hashToken("same-input");
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", () => {
    const a = hashToken("input-a");
    const b = hashToken("input-b");
    expect(a).not.toBe(b);
  });
});

describe("createApplicationId", () => {
  it("starts with YKCAPP and includes the current year", () => {
    const id = createApplicationId();
    const year = new Date().getFullYear();
    expect(id).toMatch(new RegExp(`^YKCAPP${year}`));
  });

  it("generates unique IDs", () => {
    const a = createApplicationId();
    const b = createApplicationId();
    expect(a).not.toBe(b);
  });
});

describe("safeFileName", () => {
  it("extracts and sanitizes file extensions", () => {
    expect(safeFileName("document.pdf")).toBe("pdf");
    expect(safeFileName("photo.JPG")).toBe("jpg");
    expect(safeFileName("report.docx")).toBe("docx");
  });

  it("strips non-alphanumeric characters", () => {
    expect(safeFileName("file.P@D$F")).toBe("pdf");
  });

  it("returns bin for files without extension", () => {
    expect(safeFileName("noextension")).toBe("bin");
  });
});
