"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";

type User = { id: string; name: string; email: string; role: string };

type Value = {
  user: User | null;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const refresh = async () => {
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
      setUser(r.ok ? (await r.json()).user : null);
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
    window.location.assign("/login");
  }, []);

  // Confirmation lives here rather than in each sidebar so a new call site
  // cannot accidentally ship an unguarded sign-out. Previously four separate
  // components called logout() directly — one of them a bare icon button in
  // the topbar, one tap away on every portal page.
  const logout = useCallback(() => setConfirming(true), []);

  return (
    <Context.Provider value={{ user, loading, refresh, logout, logoutImmediately }}>
      {children}
      <ConfirmDialog
        open={confirming}
        variant="danger"
        title="Sign out?"
        message={
          user?.name
            ? `You're signed in as ${user.name}. You'll need your email and password to sign back in.`
            : "You'll need your email and password to sign back in."
        }
        confirmText={signingOut ? "Signing out…" : "Yes, sign me out"}
        cancelText="Stay signed in"
        onCancel={() => {
          if (!signingOut) setConfirming(false);
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
