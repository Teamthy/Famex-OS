"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

/**
 * The little bar above a printable document.
 *
 * It is `no-print`, so it never reaches paper — it exists only so a person who
 * opened the print page can find Back and the print button without hunting
 * through the browser's menu.
 */
export default function PrintToolbar({
  title,
  backHref,
}: {
  title: string;
  backHref: string;
}) {
  return (
    <div className="no-print mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4">
      <div className="min-w-0">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={13} /> Back
        </Link>
        <p className="mt-1 truncate text-sm font-bold text-neutral-900">{title}</p>
      </div>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800"
      >
        <Printer size={15} /> Print / Save as PDF
      </button>
    </div>
  );
}
