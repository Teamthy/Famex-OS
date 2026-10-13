import type { Metadata } from "next";
import Link from "next/link";
import { Check, GraduationCap, QrCode, Share, Smartphone, WifiOff } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { apkQrDataUrl, requestOrigin } from "@/lib/apk";

export const metadata: Metadata = {
  title: "Install the Ykay College app — iPhone & Android",
  description:
    "Install the Ykay College app straight from your browser on iPhone or Android — results, attendance, fees and school notices. No app store needed.",
};

/**
 * Install page — PWA-only.
 *
 * The installable web app IS the mobile app: full-screen, offline-ready,
 * self-updating, installable from the browser on both platforms in seconds.
 * (The Android APK option returns here when a file is actually published.)
 */
export default async function DownloadPage() {
  // QR encodes this page ON THE ORIGIN THE VISITOR IS USING — preview deploys
  // and the production domain both scan to the right place.
  const qr = await apkQrDataUrl(`${await requestOrigin()}/download`);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[var(--bg-primary)] px-6 pb-20 pt-28 md:pt-32">
        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          {/* Left: pitch + platform steps */}
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <Smartphone size={11} /> Get the app
            </span>

            <h1 className="mt-5 font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.9] tracking-[-0.01em] text-[var(--text-primary)]">
              THE SCHOOL IN
              <span className="block text-brand-green">YOUR POCKET.</span>
            </h1>

            <p className="mt-5 max-w-lg font-body text-base leading-relaxed text-[var(--text-secondary)]">
              The full Ykay College app — results, attendance, fees, timetables and school notices —
              installed straight from this website in seconds. Works on{" "}
              <b className="text-[var(--text-primary)]">iPhone and Android</b>, takes almost no
              space, updates itself, and needs no app store.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {/* Android */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]">
                <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-brand-green">
                  On Android
                </p>
                <ol className="mt-3 list-decimal space-y-2 pl-4 font-body text-sm leading-6 text-[var(--text-secondary)]">
                  <li>Open this site in Chrome.</li>
                  <li>
                    Tap <b className="text-[var(--text-primary)]">Install</b> on the banner, or menu{" "}
                    <b className="text-[var(--text-primary)]">⋮ → Install app</b>.
                  </li>
                  <li>Confirm — the Ykay icon appears on your home screen.</li>
                </ol>
              </div>
              {/* iPhone */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--card-shadow)]">
                <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-brand-green">
                  On iPhone
                </p>
                <ol className="mt-3 list-decimal space-y-2 pl-4 font-body text-sm leading-6 text-[var(--text-secondary)]">
                  <li>Open this site in Safari.</li>
                  <li>
                    Tap the{" "}
                    <b className="inline text-[var(--text-primary)]">
                      Share <Share size={12} className="inline" />
                    </b>{" "}
                    button.
                  </li>
                  <li>
                    Scroll, tap <b className="text-[var(--text-primary)]">Add to Home Screen</b>,
                    then Add.
                  </li>
                </ol>
              </div>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {[
                { icon: WifiOff, text: "Works offline for pages you have opened" },
                { icon: Check, text: "Full screen — no browser bar" },
                { icon: GraduationCap, text: "Results, attendance, fees, notices" },
              ].map((p) => (
                <li
                  key={p.text}
                  className="flex items-center gap-2 font-body text-xs font-semibold text-[var(--text-muted)]"
                >
                  <p.icon size={14} className="text-brand-green" />
                  {p.text}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: QR card */}
          <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center shadow-[var(--card-shadow-hover)] lg:sticky lg:top-24">
            <div className="mb-4 flex items-center justify-center gap-2 text-brand-green">
              <QrCode size={18} />
              <span className="font-body text-[10px] font-bold uppercase tracking-[0.25em]">
                Scan to open this page
              </span>
            </div>
            <div className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code linking to this install page" width={220} height={220} />
            </div>
            <p className="mt-5 font-body text-xs leading-relaxed text-[var(--text-muted)]">
              Point a phone camera at the code — it opens this page on the{" "}
              <b className="text-[var(--text-secondary)]">site you are on right now</b>, then follow
              the steps for your phone.
            </p>
            <Link
              href="/portal"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#4ec54d] px-6 py-3.5 font-body text-xs font-bold uppercase tracking-[0.15em] text-[#0c1824] transition-all duration-300 hover:bg-[#3aa93a]"
            >
              Already installed? Open the portal
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
