"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to an external error tracking service in production
    console.error("Application error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="grid min-h-screen place-items-center bg-[#0a1628] p-6 text-center">
          <div className="max-w-md">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
              <svg
                className="h-10 w-10 text-red-400"
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
            <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
            <p className="mt-3 text-sm text-slate-400">
              An unexpected error occurred. Our team has been notified and is working to resolve the
              issue.
            </p>
            {error.digest && (
              <p className="mt-2 font-mono text-xs text-slate-500">Error ID: {error.digest}</p>
            )}
            <button
              onClick={() => reset()}
              className="mt-6 inline-flex items-center rounded-full bg-[#16a34a] px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#15803d]"
            >
              Try again
            </button>
            <a href="/" className="mt-3 block text-sm text-slate-400 underline hover:text-white">
              Return to homepage
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
