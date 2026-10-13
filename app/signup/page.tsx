"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, User, Mail, Lock, ArrowRight, CheckCircle2 } from "lucide-react";

export default function SchoolSignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/platform/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: fd.get("schoolName"),
          slug: (fd.get("slug") as string)?.trim().toLowerCase().replace(/\s+/g, "-"),
          adminName: fd.get("adminName"),
          email: fd.get("email"),
          password: fd.get("password"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed.");
      router.push(data.redirect || "/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-brand-navy)] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-white tracking-widest mb-2">Ykay Platform</h1>
          <p className="text-white/50 text-sm">
            Education Operating System — start your school in minutes
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl p-8 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
              School Name
            </label>
            <div className="relative">
              <Building2
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                name="schoolName"
                required
                placeholder="e.g. Greenfield Academy"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[var(--color-brand-green)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
              School ID (your subdomain)
            </label>
            <div className="flex items-center rounded-xl border border-gray-200 focus-within:border-[var(--color-brand-green)]">
              <input
                name="slug"
                required
                placeholder="greenfield"
                className="w-full px-4 py-3 rounded-l-xl focus:outline-none"
              />
              <span className="px-3 py-3 text-gray-400 text-sm whitespace-nowrap">.ykay.app</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                Your Name
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  name="adminName"
                  required
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="admin@school.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
              Password (min 8 characters)
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none"
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[var(--color-brand-green)] text-white font-bold uppercase tracking-widest text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? "Creating your school…" : "Create School"}
            {!loading && <ArrowRight size={16} />}
          </button>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <CheckCircle2 size={14} className="text-green-500" />
            <span>Free trial — no card required. You are the school admin.</span>
          </div>

          <p className="text-center text-sm text-gray-400">
            Already have an account?{" "}
            <Link href="/login" className="text-[var(--color-brand-green)] font-bold">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
