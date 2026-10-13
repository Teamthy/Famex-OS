"use client";

export default function PortalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
        <svg
          className="h-8 w-8 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-[var(--text-primary,#111)]">Something went wrong</h2>
      <p className="mt-2 text-sm text-[var(--text-muted,#666)]">
        We could not load this page. Please try again or contact support if the problem persists.
      </p>
      <button
        onClick={() => reset()}
        className="mt-5 inline-flex items-center rounded-full bg-[#16a34a] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#15803d]"
      >
        Retry
      </button>
    </div>
  );
}
