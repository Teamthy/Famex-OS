"use client";
import { FormEvent, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
export default function Activate() {
  const params = useSearchParams(),
    router = useRouter(),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const r = await fetch("/api/staff/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.get("token"), password }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Activation failed.");
      setLoading(false);
      return;
    }
    router.replace("/login");
  }
  return (
    <main className="grid min-h-screen place-items-center bg-brand-navy p-5">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-8">
        <Link href="/" className="text-xs font-bold uppercase tracking-widest text-[#2b8a2b]">
          Ykay EduPortal
        </Link>
        <h1 className="mt-4 font-display text-4xl tracking-widest text-brand-navy">
          ACTIVATE ACCOUNT
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Set a strong password to activate your staff account.
        </p>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <label className="mt-6 block text-xs font-bold uppercase tracking-widest">
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            type="password"
            minLength={12}
            className="mt-2 w-full rounded-xl border p-3 text-sm"
          />
        </label>
        <label className="mt-4 block text-xs font-bold uppercase tracking-widest">
          Confirm password
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            type="password"
            className="mt-2 w-full rounded-xl border p-3 text-sm"
          />
        </label>
        <button
          disabled={loading}
          className="mt-6 w-full rounded-full bg-brand-green py-3 text-xs font-bold uppercase tracking-widest text-brand-navy"
        >
          {loading ? "Activating…" : "Activate account"}
        </button>
      </form>
    </main>
  );
}
