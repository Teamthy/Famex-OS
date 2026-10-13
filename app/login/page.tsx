"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { LockKeyhole, ShieldCheck, AlertCircle, GraduationCap, User, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const destinations: Record<string, string> = {
  SUPER_ADMIN: "/super-admin",
  ADMIN: "/admin",
  DIRECTOR: "/admin",
  COORDINATOR: "/admin-admissions",
  BURSAR: "/admin/fees",
  HOD: "/teacher/dashboard",
  TEACHER: "/teacher/dashboard",
  PARENT: "/parent/dashboard",
  STUDENT: "/student/dashboard",
  IT_STUDENT: "/it-portal/dashboard",
};

const portalContext: Record<string, { heading: string; sub: string; icon: typeof GraduationCap }> =
  {
    staff: {
      heading: "STAFF SIGN IN",
      sub: "For teachers, form masters, and school administrators. Admins are routed to the admin console automatically.",
      icon: GraduationCap,
    },
    student: {
      heading: "STUDENT SIGN IN",
      sub: "Sign in with the student credentials issued by Ykay College.",
      icon: User,
    },
    parent: {
      heading: "PARENT SIGN IN",
      sub: "Sign in to monitor your child's attendance, results, and fees.",
      icon: Users,
    },
  };

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const portal = searchParams.get("portal") || "";
  const context = portalContext[portal] || {
    heading: "SIGN IN",
    sub: "Use your registered school email address.",
    icon: ShieldCheck,
  };
  const ContextIcon = context.icon;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await refresh();
      // Only same-site paths are honoured; anything else falls back to the role's home page.
      const next = safeNextPath(searchParams.get("next"), window.location.origin);
      router.replace(next ?? destinations[body.user.role] ?? "/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-brand-navy p-6">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl md:grid-cols-2">
        <section className="relative hidden min-h-[520px] overflow-hidden text-white md:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/home/ykay-students.png"
            alt="Ykay College students"
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-navy via-brand-navy/85 to-brand-navy/45" />
          <div className="relative z-10 flex h-full flex-col justify-between p-9 md:p-12">
            <Link
              href="/portal"
              className="text-xs font-bold uppercase tracking-widest text-brand-green"
            >
              ← All Portals
            </Link>
            <div>
              <ContextIcon className="text-brand-green" size={42} />
              <h1 className="mt-5 font-display text-4xl tracking-widest text-white">
                EDUPORTAL
                <br />
                <span className="text-brand-green">SECURE ACCESS</span>
              </h1>
              <p className="mt-5 max-w-sm text-sm leading-7 text-white/85">
                Sign in with the credentials issued to you by Ykay College. For account help,
                contact the school administration.
              </p>
              <p className="mt-8 max-w-sm rounded-2xl border border-white/15 bg-black/35 p-4 text-xs leading-6 text-white/85">
                New to Ykay College?{" "}
                <Link href="/admissions" className="font-bold text-brand-orange hover:underline">
                  Apply for admission
                </Link>{" "}
                — no account needed. Already applied?{" "}
                <Link
                  href="/admissions/status"
                  className="font-bold text-brand-orange hover:underline"
                >
                  Track your application
                </Link>{" "}
                with your Application ID.
              </p>
              <p className="mt-4 max-w-sm rounded-2xl border border-white/15 bg-black/35 p-4 text-xs leading-6 text-white/85">
                YK-Virtual uses these same College credentials. After you sign in here,{" "}
                <Link href="/sso/virtual" className="font-bold text-brand-green hover:underline">
                  continue to YK-Virtual
                </Link>{" "}
                — or tap “Continue with Ykay College” on the Virtual login page.
              </p>
            </div>
          </div>
        </section>

        <section data-theme="light" className="bg-white p-9 md:p-12">
          <Link
            href="/portal"
            className="mb-8 inline-block text-xs font-bold uppercase tracking-widest text-green-800 md:hidden"
          >
            ← All Portals
          </Link>
          <h2 className="font-display text-3xl tracking-widest text-brand-navy">
            {context.heading}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-600">{context.sub}</p>
          {error && (
            <p
              role="alert"
              className="mt-5 flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertCircle size={17} /> {error}
            </p>
          )}
          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block text-xs font-bold uppercase tracking-widest text-green-800">
              Email
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="login-field mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-green/30"
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-widest text-green-800">
              Password
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="login-field mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-green/30"
              />
            </label>
            <button
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-green px-5 py-4 text-sm font-bold uppercase tracking-widest text-brand-navy transition hover:bg-brand-green-dark disabled:opacity-50"
            >
              <LockKeyhole size={16} /> {loading ? "Signing in" : "Sign in"}
            </button>
          </form>
          <Link
            href="/reset-password"
            className="mt-6 block text-center text-sm font-semibold text-green-800 hover:text-green-900 hover:underline"
          >
            Forgot password?
          </Link>
          <p className="mt-8 text-center text-xs leading-5 text-ink-500 md:hidden">
            New here?{" "}
            <Link href="/admissions" className="font-bold text-green-800 hover:underline">
              Apply for admission
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-brand-navy" />}>
      <LoginForm />
    </Suspense>
  );
}
