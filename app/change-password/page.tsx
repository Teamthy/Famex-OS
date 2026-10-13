"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
export default function ChangePassword() {
  const router = useRouter(),
    [currentPassword, setCurrent] = useState(""),
    [newPassword, setNew] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    const r = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Unable to change password.");
      setBusy(false);
      return;
    }
    router.replace("/portal");
  }
  return (
    <main className="grid min-h-screen place-items-center bg-brand-navy p-5">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[#2b8a2b]">
          Security required
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-widest text-brand-navy">SET PASSWORD</h1>
        <p className="mt-3 text-sm text-slate-500">
          You must replace your temporary password before opening the portal.
        </p>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {[
          ["Current password", currentPassword, setCurrent],
          ["New password", newPassword, setNew],
          ["Confirm new password", confirm, setConfirm],
        ].map(([label, value, setter]) => (
          <label
            key={String(label)}
            className="mt-4 block text-xs font-bold uppercase tracking-widest"
          >
            {String(label)}
            <input
              required
              type="password"
              value={String(value)}
              onChange={(e) => (setter as (_v: string) => void)(e.target.value)}
              className="mt-2 w-full rounded-xl border p-3 text-sm"
            />
          </label>
        ))}
        <button
          disabled={busy}
          className="mt-6 w-full rounded-full bg-brand-green py-3 text-xs font-bold uppercase tracking-widest text-brand-navy"
        >
          {busy ? "Saving…" : "Save secure password"}
        </button>
      </form>
    </main>
  );
}
