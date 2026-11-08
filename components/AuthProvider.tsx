"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";

import { cacheClear, getQueuedWrites } from "@/lib/offline/db";
import { listPapers, purgePapers } from "@/lib/offline/exam-store";
import { planSignOut } from "@/lib/offline/session";


type User = { id: string; name: string; email: string; role: string };

type Value = {
  user: User | null;
  /**
   * Module keys this school has switched on (F0-17), or null when the answer
   * does not apply to this role / has not arrived yet. The admin sidebar
   * renders from this, so nav and entitlement can never disagree.
   */
  modules: string[] | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /**
   * Opens a confirmation dialog and only signs out if the user agrees.
   * Every sidebar/topbar sign-out button routes through this.
   */
  logout: () => void;
  /**
   * Signs out immediately, no prompt. Reserved for cases where the session is
   * already invalid and there is nothing to confirm — e.g. a wrong-role login
   * being cleared, or a failed re-authentication.
   */
  logoutImmediately: () => Promise<void>;
};

const Context = createContext<Value | undefined>(undefined);

/**
 * Clear this device of the signed-out user's data.
 *
 * Audit B-15: web sign-out posted to /api/auth/logout and cleared the cookie,
 * and everything else stayed — cached fees, cached messages, and any exam paper
 * with its answers. `cacheClear()` had existed in lib/offline/db.ts for exactly
 * this and had no callers; its own comment claimed it ran on sign-out.
 *
 * What is deleted is decided by planSignOut() in lib/offline/session.ts, not
 * here: a paper whose answers have never reached the server is kept, because
 * it is the only copy, and losing an exam is worse than leaving a file the
 * next account is not allowed to open.
 *
 * Best-effort throughout. A failure to clear must not block sign-out — the
 * user pressing the button is usually the one who wants off the device.
 */
async function clearDeviceData(): Promise<void> {
  const [papers, queued] = await Promise.all([
    listPapers().catch(() => []),
    getQueuedWrites().catch(() => []),
  ]);

  const plan = planSignOut({ papers, queueCount: queued.length });

  await Promise.all([
    cacheClear().catch(() => undefined),
    purgePapers(plan.papersToDelete).catch(() => undefined),
  ]);
}

/** Count what sign-out would discard, so the dialog can say so. */
async function pendingOfflineWork(): Promise<{ papers: number; queue: number }> {
  const [papers, queued] = await Promise.all([
    listPapers().catch(() => []),
    getQueuedWrites().catch(() => []),
  ]);
  return { papers: papers.length, queue: queued.length };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [modules, setModules] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const refresh = async () => {
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
      if (r.ok) {
        const body = (await r.json()) as { user: User | null; modules: string[] | null };
        setUser(body.user);
        setModules(body.modules ?? null);
      } else {
        setUser(null);
        setModules(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const logoutImmediately = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // The cookie is cleared server-side on a best-effort basis; if the
      // request never lands we still send the user to /login rather than
      // stranding them on a page they can no longer use.
    }
    setUser(null);
    setModules(null);
    await clearDeviceData();
    window.location.assign("/login");
  }, []);

  // Confirmation lives here rather than in each sidebar so a new call site
  // cannot accidentally ship an unguarded sign-out. Previously four separate
  // components called logout() directly — one of them a bare icon button in
  // the topbar, one tap away on every portal page.
  // What is on this device that signing out would discard. Read when the
  // dialog opens, not when it renders, because it means an IndexedDB call.
  const [offlineWork, setOfflineWork] = useState<{ papers: number; queue: number } | null>(null);

  const logout = useCallback(() => {
    setOfflineWork(null);
    setConfirming(true);
    void pendingOfflineWork().then(setOfflineWork);
  }, []);

  return (
    <Context.Provider value={{ user, modules, loading, refresh, logout, logoutImmediately }}>
      {children}
      <ConfirmDialog
        open={confirming}
        variant="danger"
        title="Sign out?"
        message={(() => {
          const base = user?.name
            ? `You're signed in as ${user.name}. You'll need your email and password to sign back in.`
            : "You'll need your email and password to sign back in.";
          if (!offlineWork) return base;
          const parts: string[] = [];
          if (offlineWork.queue > 0) {
            // Real work that never reached the server. Say it plainly: it is
            // discarded, and the user is the only one who can decide.
            parts.push(
              `${offlineWork.queue} change${offlineWork.queue === 1 ? "" : "s"} made while offline ${
                offlineWork.queue === 1 ? "has" : "have"
              } not reached the school yet`,
            );
          }
          if (offlineWork.papers > 0) {
            parts.push(
              `${offlineWork.papers} downloaded exam paper${offlineWork.papers === 1 ? "" : "s"}`,
            );
          }
          if (parts.length === 0) {
            return `${base} Any data saved on this device will be cleared.`;
          }
          return `${base} This device holds ${parts.join(" and ")}. Cached data is cleared, and unsent work will be lost.`;
        })()}
        confirmText={signingOut ? "Signing out…" : "Yes, sign me out"}
        cancelText="Stay signed in"
        onCancel={() => {
          if (!signingOut) {
            setConfirming(false);
            setOfflineWork(null);
          }
        }}
        onConfirm={() => {
          if (signingOut) return; // guard against a double-click
          setSigningOut(true);
          void logoutImmediately();
        }}
      />
    </Context.Provider>
  );
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
