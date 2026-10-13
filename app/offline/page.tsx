import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: "You are offline | Ykay College",
  robots: { index: false },
};

/**
 * Offline fallback for the PWA service worker. Kept static and dependency-free
 * so it can be precached and served with zero network.
 */
export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-brand-navy px-6 py-20">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-brand-green/15 text-brand-green">
          <WifiOff size={28} />
        </div>
        <h1 className="font-display text-3xl tracking-widest text-white sm:text-4xl">
          YOU ARE <span className="text-brand-green">OFFLINE</span>
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/75">
          This page needs an internet connection. Pages you have already visited still open —
          reconnect to load the rest.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-[#4ec54d] px-7 py-3.5 text-xs font-bold uppercase tracking-[0.15em] text-[#0c1824] transition-all duration-300 hover:scale-[1.03] hover:bg-[#3aa93a] active:scale-[0.97]"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
