"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Shared hook for fetching data from API routes with loading/error states.
 * Replaces all mock data imports across teacher/student/parent portals.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApi<{ teacher: Teacher }>("/api/teacher/profile");
 */
export function useApi<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetcher = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load data.");
      setData(j as T);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => {
    void fetcher();
  }, [fetcher]);

  return { data, loading, error, refetch: fetcher };
}
