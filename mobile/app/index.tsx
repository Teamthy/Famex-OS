import { Redirect } from "expo-router";
import { getMe, type SessionUser } from "@/lib/api";
import { getPref } from "@/lib/prefs";
import { useEffect, useState } from "react";
import { SplashBrand } from "@/components/SplashBrand";

/**
 * Entry router.
 *
 * Three outcomes:
 *   signed in            -> that role's dashboard
 *   signed out, 1st run  -> the 3-page welcome wizard
 *   signed out, returning-> straight to sign in
 *
 * The wizard is gated on a persisted flag rather than shown every time, so a
 * returning user who simply logged out is not made to swipe through it again.
 */
export default function Home() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [seenOnboarding, setSeenOnboarding] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [res, seen] = await Promise.all([
        getMe().catch(() => null),
        getPref("seenOnboarding").catch(() => true),
      ]);
      if (cancelled) return;
      setUser(res?.user ?? null);
      setSeenOnboarding(seen);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <SplashBrand />;

  if (!user) return <Redirect href={seenOnboarding ? "/login" : "/onboarding"} />;

  const role = user.role;
  const href =
    role === "TEACHER" || role === "HOD"
      ? "/(teacher)/dashboard"
      : role === "PARENT"
        ? "/(parent)/dashboard"
        : role === "ADMIN"
          ? "/(admin)/dashboard"
          : "/(student)/dashboard";

  return <Redirect href={href} />;
}
