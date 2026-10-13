"use client";

import { useEffect, useState } from "react";
import { Share, Plus, X } from "lucide-react";

/**
 * PWA install prompt — works on BOTH platforms:
 *
 *   Android / Chrome  → captures beforeinstallprompt and offers a one-tap
 *                       Install button.
 *   iPhone / Safari   → beforeinstallprompt never fires on iOS, so iOS users
 *                       get the Share → Add to Home Screen instruction card.
 *
 * Only appears on small touch-style devices (the mobile experience), is
 * dismissible, and remembers the dismissal for 3 days.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ykay-install-dismissed-at";
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [dismissed, setDismissed] = useState(true); // hidden until we know better

  useEffect(() => {
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      if (Date.now() - at < COOLDOWN_MS) return;
    } catch {
      /* private mode — carry on */
    }
    if (isStandalone()) return;

    setDismissed(false);

    if (isIOS()) {
      // Give Safari a beat, then show the instructions card.
      const t = window.setTimeout(() => setShowIOS(true), 2500);
      return () => window.clearTimeout(t);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    setShowIOS(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") dismiss();
    setDeferred(null);
  };

  if (dismissed) return null;
  if (!deferred && !showIOS) return null;

  return (
    <div className="fixed bottom-24 left-4 z-40 flex max-w-xs items-start gap-3 rounded-2xl border border-brand-green/30 bg-[var(--surface-card)] p-4 shadow-2xl md:bottom-8 md:left-8">
      <span
        className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-green/15 text-lg"
        aria-hidden="true"
      >
        📲
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[var(--text-primary)]">Install the Ykay app</p>
        {deferred ? (
          <>
            <p className="text-xs text-[var(--text-secondary)]">
              Add Ykay College to your home screen — results, attendance and notices, full screen.
            </p>
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={() => void install()}
                className="rounded-lg bg-brand-green px-3 py-1 text-xs font-bold text-brand-navy hover:bg-brand-green-dark"
              >
                Install
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Not now
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-[var(--text-secondary)]">On your iPhone or iPad:</p>
            <ol className="mt-1 list-none space-y-1 text-xs text-[var(--text-secondary)]">
              <li>
                <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-primary)]">
                  1. Tap <Share size={12} className="inline" /> Share
                </span>
              </li>
              <li>
                <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-primary)]">
                  2. Tap <Plus size={12} className="inline" /> Add to Home Screen
                </span>
              </li>
            </ol>
            <button
              type="button"
              onClick={dismiss}
              className="mt-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Not now
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default InstallPrompt;
