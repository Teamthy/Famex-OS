"use client";

/**
 * Only renders when NEXT_PUBLIC_SHOW_DEMO_BADGE=true.
 * Production must leave this unset/false.
 */
export default function DemoIndicator() {
  if (process.env.NEXT_PUBLIC_SHOW_DEMO_BADGE !== "true") return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[120] rounded-full border border-brand-orange/40 bg-brand-navy/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-orange shadow-lg">
      Demo environment
    </div>
  );
}
