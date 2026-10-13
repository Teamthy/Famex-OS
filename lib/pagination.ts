/**
 * Pagination helpers for bounded queries.
 *
 * Every admin list endpoint MUST use these to prevent unbounded
 * result sets that blow up memory and latency as data accumulates.
 */

import { NextRequest } from "next/server";

export const PAGE_LIMITS = {
  /** Short lists: dropdowns, selects, summaries */
  SHORT: 25,
  /** Standard lists: admissions, students, staff, news */
  STANDARD: 50,
  /** Large lists: report cards, broadsheet, analytics */
  LARGE: 200,
  /** Aggregations: dashboard stats, finance overviews */
  AGGREGATE: 500,
  /** Absolute maximum — never exceed this */
  MAX: 1000,
} as const;

/**
 * Extracts page/pageSize from request search params with safe defaults.
 */
export function getPagination(
  request: NextRequest,
  defaultPageSize: number = PAGE_LIMITS.STANDARD,
) {
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    Math.max(1, parseInt(params.get("pageSize") || String(defaultPageSize), 10) || defaultPageSize),
    PAGE_LIMITS.MAX,
  );
  const skip = (page - 1) * pageSize;

  return { page, pageSize, skip, take: pageSize };
}

/**
 * Wraps a paginated result with metadata for the client.
 */
export function paginatedResponse<T>(items: T[], total: number, page: number, pageSize: number) {
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
