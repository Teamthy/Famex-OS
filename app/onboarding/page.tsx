"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Palette, ArrowRight, School } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: fd.get("address"),
          phone: fd.get("phone"),
          motto: fd.get("motto"),
          primaryColor: fd.get("primaryColor"),
          accentColor: fd.get("accentColor"),
          displayName: fd.get("displayName"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      router.push(data.redirect || "/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-brand-navy)] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-brand-green)]/20 mb-4">
            <School className="text-[var(--color-brand-green)]" size={28} />
          </div>
          <h1 className="font-display text-3xl text-white tracking-widest mb-2">WELCOME</h1>
          <p className="text-white/50 text-sm">
            Let's set up your school. This takes less than 2 minutes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl p-8 space-y-6">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--color-brand-green)] text-white flex items-center justify-center text-xs font-bold">
                ✓
              </div>
              <span className="text-xs text-gray-400 font-medium">School Created</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-200"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--color-brand-green)] text-white flex items-center justify-center text-xs font-bold">
                2
              </div>
              <span className="text-xs text-gray-600 font-bold">School Profile</span>
            </div>
          </div>

          {/* School profile */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-500">
              <Building2 size={14} /> School Details
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                Display Name (shown on portal)
              </label>
              <input
                name="displayName"
                placeholder="e.g. Greenfield Academy"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[var(--color-brand-green)] focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                  Address
                </label>
                <input
                  name="address"
                  placeholder="123 Education Road"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                  Phone
                </label>
                <input
                  name="phone"
                  placeholder="+234 ..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                Motto / Tagline
              </label>
              <input
                name="motto"
                placeholder="Excellence in Education"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Branding */}
          <div className="space-y-4 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-500">
              <Palette size={14} /> Brand Colours
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                  Primary (dark)
                </label>
                <input
                  name="primaryColor"
                  type="color"
                  defaultValue="#0c1824"
                  className="w-full h-12 rounded-xl border border-gray-200 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                  Accent (green)
                </label>
                <input
                  name="accentColor"
                  type="color"
                  defaultValue="#4ec54d"
                  className="w-full h-12 rounded-xl border border-gray-200 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[var(--color-brand-green)] text-white font-bold uppercase tracking-widest text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? "Saving..." : "Complete Setup"} {!loading && <ArrowRight size={16} />}
          </button>
          <p className="text-center text-xs text-gray-400">
            You can change these settings anytime from the admin panel.
          </p>
        </form>
      </div>
    </div>
  );
}
