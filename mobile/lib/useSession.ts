/**
 * Shared session hook.
 *
 * Several screens each called getMe() with their own useState/useEffect and
 * their own `any`-typed user. This centralises it so the role is typed and a
 * screen can branch on the portal it is running in.
 */
import { useEffect, useState } from "react";
import { getMe, type SessionUser } from "@/lib/api";

export type Portal = "student" | "teacher" | "parent" | "admin" | "it" | "unknown";

/** Map a backend role onto the portal whose UI the user sees. */
export function portalFor(role?: string | null): Portal {
  switch (role) {
    case "STUDENT":
      return "student";
    case "TEACHER":
    case "HOD":
      return "teacher";
    case "PARENT":
      return "parent";
    case "ADMIN":
    case "DIRECTOR":
    case "COORDINATOR":
    case "BURSAR":
    case "SUPER_ADMIN":
      return "admin";
    case "IT_STUDENT":
      return "it";
    default:
      return "unknown";
  }
}

/** Human label for a role, for display in profile/settings headers. */
export function roleLabel(role?: string | null): string {
  if (!role) return "";
  return role
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((res) => {
        if (cancelled) return;
        setUser(res?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    user,
    loading,
    portal: portalFor(user?.role),
    roleLabel: roleLabel(user?.role),
  };
}
