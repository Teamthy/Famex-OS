import Link from "next/link";

/**
 * The page a signed-in user sees when a role cannot open a route.
 *
 * ── Why this exists (B-06) ─────────────────────────────────────────────────
 * Middleware used to answer a refusal with a redirect to the caller's portal
 * home. For any role its own list did not name — proprietor, principal,
 * vice-principal, librarian, nurse — the home fell through to
 * /student/dashboard, which was refused too and sent them straight back. The
 * result was an endless redirect that looked like a broken server.
 *
 * A refusal now either redirects somewhere genuinely different, or lands here
 * with a 403 and says what happened. It is reachable as `/forbidden`, and
 * middleware rewrites to it so the URL the user typed stays in the address bar
 * and in the `from` parameter.
 */

const EXPLANATIONS: Record<string, string> = {
  STUDENT: "This area is for staff. Your own work is in the student portal.",
  PARENT: "This area is for staff. Your child's records are in the parent portal.",
  TEACHER: "This area is for administrators. Your classes are in the teacher portal.",
  HOD: "This area is for administrators. Your department's work is in the teacher portal.",
  LIBRARIAN: "Your account opens the library and inventory, and not the rest of the workspace.",
  NURSE: "Your account opens the clinic, and not the rest of the workspace.",
};

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; role?: string }>;
}) {
  const params = await searchParams;
  const role = params.role ?? "";
  const from = params.from ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-6">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center shadow-[var(--card-shadow)]">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-orange/10 text-2xl font-bold text-brand-orange">
          403
        </div>
        <h1 className="font-display text-xl tracking-wide text-[var(--text-primary)]">
          You cannot open this page
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {EXPLANATIONS[role] ??
            "Your account does not have access to this area of the school's workspace."}
        </p>
        {from ? (
          <p className="mt-3 rounded-lg bg-[var(--surface-disabled)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
            Requested: <span className="font-mono">{from}</span>
          </p>
        ) : null}
        <p className="mt-4 text-[11px] text-[var(--text-muted)]">
          If you think this is wrong, ask an administrator to check your role. Someone who can
          grant the access you need will see this exact page name.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy hover:bg-brand-green-dark"
          >
            Go to my dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[var(--border-subtle)] px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:border-brand-green hover:text-brand-green"
          >
            Sign in as someone else
          </Link>
        </div>
      </div>
    </main>
  );
}
