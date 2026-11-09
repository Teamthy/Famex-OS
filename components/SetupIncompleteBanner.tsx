import { PRODUCT_NAME, getSchoolBrandTokens } from "@/lib/brand";

/**
 * Honest degraded-state banner rendered by the root layout when this
 * environment's database is unusable (unreachable, unmigrated) or the school
 * record has not been configured yet.
 *
 * Why this exists: before it, an environment with a placeholder DATABASE_URL
 * (the documented staging state — docs/HOSTING-DECISION-2K-USERS.md §9)
 * crashed the root layout on the first Prisma read, so EVERY route rendered a
 * blank 500 and "the UI doesn't show" with no explanation anywhere. This
 * banner never fabricates data: it says plainly that setup is incomplete,
 * keeps the page shell (environment brand tokens) visible, and points
 * administrators at /api/health and the setup runbook.
 *
 * Server component, zero client JS, zero data reads — it must render even
 * when nothing else can.
 */
export default function SetupIncompleteBanner({ reason }: { reason: "database" | "school" }) {
  const { schoolName } = getSchoolBrandTokens();
  const heading =
    reason === "database"
      ? "Setup incomplete — database not connected"
      : "Setup incomplete — school not configured";

  return (
    <div
      role="status"
      className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200"
    >
      <p className="font-semibold">{heading}</p>
      <p className="mx-auto mt-1 max-w-2xl text-xs text-amber-200/80">
        {schoolName} on {PRODUCT_NAME}: this environment cannot serve live data yet. Signed-in
        features, results and billing are unavailable until setup is finished. Administrators:
        provision and migrate the database (docs/HOSTING-DECISION-2K-USERS.md §9), then verify{" "}
        <a href="/api/health" className="underline decoration-dotted underline-offset-2">
          /api/health
        </a>
        .
      </p>
    </div>
  );
}
