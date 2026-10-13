import { useCallback, useEffect, useState } from "react";
import { termApi, type CurrentTerm } from "@/lib/api";

/**
 * The school's current session and term.
 *
 * Returns null while loading or when unavailable (offline, signed out) so
 * callers can render nothing rather than a placeholder that looks like data.
 * A wrong term label is worse than no term label.
 */
export function useCurrentTerm() {
  const [term, setTerm] = useState<CurrentTerm | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setTerm(await termApi.current());
    } catch {
      // Non-fatal: the term chip is contextual, never load-bearing. A failure
      // hides it instead of blocking the screen behind it.
      setTerm(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { term, loading, reload: load };
}
