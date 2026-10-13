import { redirect } from "next/navigation";

/**
 * Superseded by /teacher/performance-records.
 *
 * This entered one score for one student through a "Save Score" button that
 * posted nowhere. Performance Records does the same job for a whole class in
 * one grid and actually saves, so this was both broken and slower.
 *
 * Kept as a redirect so existing links resolve.
 */
export default function AddPerformancePage() {
  redirect("/teacher/performance-records");
}
