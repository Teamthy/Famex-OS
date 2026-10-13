import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

const ORIGIN = "https://school.example";

describe("safeNextPath", () => {
  it("keeps in-app paths, with their query and hash", () => {
    expect(safeNextPath("/student/exams", ORIGIN)).toBe("/student/exams");
    expect(safeNextPath("/admin/fees?tab=invoices#top", ORIGIN)).toBe(
      "/admin/fees?tab=invoices#top",
    );
  });

  it("rejects protocol-relative and backslash variants that leave the site", () => {
    expect(safeNextPath("//example.com/phish", ORIGIN)).toBeNull();
    expect(safeNextPath("/\\example.com/phish", ORIGIN)).toBeNull();
    expect(safeNextPath("///example.com", ORIGIN)).toBeNull();
  });

  it("rejects absolute URLs and other schemes", () => {
    expect(safeNextPath("https://example.com/", ORIGIN)).toBeNull();
    expect(safeNextPath("http://example.com", ORIGIN)).toBeNull();
    expect(safeNextPath("javascript:alert(1)", ORIGIN)).toBeNull();
    expect(safeNextPath("student/exams", ORIGIN)).toBeNull();
  });

  it("rejects control characters, backslashes and empty or oversized values", () => {
    expect(safeNextPath("/\t/example.com", ORIGIN)).toBeNull();
    expect(safeNextPath("/%0a/x", ORIGIN)).toBe("/%0a/x"); // encoded text is an ordinary path
    expect(safeNextPath("/ok\r\nSet-Cookie:x", ORIGIN)).toBeNull();
    expect(safeNextPath("/a\\b", ORIGIN)).toBeNull();
    expect(safeNextPath("", ORIGIN)).toBeNull();
    expect(safeNextPath(null, ORIGIN)).toBeNull();
    expect(safeNextPath(undefined, ORIGIN)).toBeNull();
    expect(safeNextPath(`/${"a".repeat(3000)}`, ORIGIN)).toBeNull();
  });
});
