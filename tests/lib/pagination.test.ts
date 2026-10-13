import { describe, it, expect } from "vitest";
import { PAGE_LIMITS, getPagination, paginatedResponse } from "@/lib/pagination";

describe("PAGE_LIMITS", () => {
  it("defines sensible limits", () => {
    expect(PAGE_LIMITS.SHORT).toBe(25);
    expect(PAGE_LIMITS.STANDARD).toBe(50);
    expect(PAGE_LIMITS.LARGE).toBe(200);
    expect(PAGE_LIMITS.AGGREGATE).toBe(500);
    expect(PAGE_LIMITS.MAX).toBe(1000);
  });

  it("SHORT < STANDARD < LARGE < AGGREGATE < MAX", () => {
    expect(PAGE_LIMITS.SHORT).toBeLessThan(PAGE_LIMITS.STANDARD);
    expect(PAGE_LIMITS.STANDARD).toBeLessThan(PAGE_LIMITS.LARGE);
    expect(PAGE_LIMITS.LARGE).toBeLessThan(PAGE_LIMITS.AGGREGATE);
    expect(PAGE_LIMITS.AGGREGATE).toBeLessThan(PAGE_LIMITS.MAX);
  });
});

describe("getPagination", () => {
  function mockRequest(params: Record<string, string>) {
    const searchParams = new URLSearchParams(params);
    return {
      nextUrl: { searchParams },
    } as any;
  }

  it("returns defaults when no params provided", () => {
    const result = getPagination(mockRequest({}));
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(PAGE_LIMITS.STANDARD);
    expect(result.skip).toBe(0);
    expect(result.take).toBe(PAGE_LIMITS.STANDARD);
  });

  it("parses page and pageSize from params", () => {
    const result = getPagination(mockRequest({ page: "3", pageSize: "25" }));
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(25);
    expect(result.skip).toBe(50); // (3-1) * 25
    expect(result.take).toBe(25);
  });

  it("clamps page to minimum of 1", () => {
    const result = getPagination(mockRequest({ page: "-5" }));
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it("caps pageSize at MAX limit", () => {
    const result = getPagination(mockRequest({ pageSize: "9999" }));
    expect(result.pageSize).toBe(PAGE_LIMITS.MAX);
    expect(result.take).toBe(PAGE_LIMITS.MAX);
  });

  it("handles invalid page values gracefully", () => {
    const result = getPagination(mockRequest({ page: "abc" }));
    expect(result.page).toBe(1);
  });

  it("uses custom default page size", () => {
    const result = getPagination(mockRequest({}), 100);
    expect(result.pageSize).toBe(100);
  });
});

describe("paginatedResponse", () => {
  it("returns correct pagination metadata", () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = paginatedResponse(items, 150, 2, 50);

    expect(result.items).toEqual(items);
    expect(result.total).toBe(150);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(50);
    expect(result.pages).toBe(3); // ceil(150/50)
  });

  it("handles zero items", () => {
    const result = paginatedResponse([], 0, 1, 50);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.pages).toBe(1); // min 1
  });

  it("handles partial last page", () => {
    const result = paginatedResponse([], 75, 1, 50);
    expect(result.pages).toBe(2); // ceil(75/50)
  });
});
