"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { KeyRound, Mail, RotateCcw, Trash2, UserPlus, Users, X } from "lucide-react";

type Staff = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isSuspended: boolean;
  teacherProfile: { id: string; roleLabel: string | null } | null;
};
type Invite = { id: string; name: string; email: string; role: string; expiresAt: string };

const roles = ["ADMIN", "DIRECTOR", "BURSAR", "COORDINATOR", "HOD", "TEACHER"];

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busyInvite, setBusyInvite] = useState<string | null>(null);
  const [mode, setMode] = useState<"invite" | "direct" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/staff/invites", { cache: "no-store" });
    const j = await r.json();
    if (r.ok) {
      setStaff(j.staff);
      setInvites(j.invites);
    } else setError(j.error || "Could not load staff.");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/admin/staff/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Unable to create invitation.");
      return;
    }
    setMode(null);
    const activation = `${window.location.origin}/staff/activate?token=${j.activationToken}`;
    setNotice(
      `Invitation created for ${j.invite.email}. Copy this one-time activation link now: ${activation}`,
    );
    await load();
  }

  /** Revoke a pending invitation — kills the activation token immediately. */
  async function revokeInvite(id: string, email: string) {
    if (!window.confirm(`Revoke the invitation for ${email}? Their activation link stops working.`))
      return;
    setError("");
    setBusyInvite(id);
    try {
      const r = await fetch(`/api/admin/staff/invites/${id}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to revoke.");
      setNotice(`Invitation for ${email} revoked.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to revoke.");
    } finally {
      setBusyInvite(null);
    }
  }

  /** Reissue: new token, fresh 7-day expiry, email resent. Old link dies. */
  async function resendInvite(id: string, email: string) {
    setError("");
    setBusyInvite(id);
    try {
      const r = await fetch(`/api/admin/staff/invites/${id}`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to resend.");
      const link = `${window.location.origin}/staff/activate?token=${j.activationToken}`;
      setNotice(
        j.emailSent
          ? `New invitation emailed to ${email}. The previous link no longer works. Backup link: ${link}`
          : `Email could not be sent. Share this new link with ${email}: ${link}`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resend.");
    } finally {
      setBusyInvite(null);
    }
  }

  async function submitDirect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/admin/staff/direct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Unable to create staff account.");
      return;
    }
    setMode(null);
    setNotice(
      `Account created for ${j.user.email}. Temporary password (copy now): ${j.temporaryPassword}. They must change it on first login.`,
    );
    await load();
  }

  return (
    <>
      <PortalTopbar title="Staff accounts" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Controlled access
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">
              STAFF <span className="text-brand-green">ACCOUNTS</span>
            </h1>
            <p className="mt-3 text-sm text-white/65">
              Staff accounts are created only by school administration. There is no staff
              self-registration. Use an invitation link or create an account with a one-time
              temporary password.
            </p>
          </div>

          {notice && (
            <div className="mt-5 break-all rounded-2xl border border-brand-orange/30 bg-brand-orange/10 p-4 text-sm">
              {notice}
            </div>
          )}
          {error && (
            <p className="mt-5 rounded-2xl bg-red-500/10 p-4 text-sm text-red-600">{error}</p>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              onClick={() => setMode("direct")}
              className="inline-flex items-center gap-2 rounded-full border border-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-green"
            >
              <KeyRound size={15} /> Create account + password
            </button>
            <button
              onClick={() => setMode("invite")}
              className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy"
            >
              <UserPlus size={15} /> Invite staff
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
              <h2 className="flex items-center gap-2 border-b border-[var(--border-subtle)] p-5 font-display text-xl">
                <Users size={18} className="text-brand-green" /> Active staff
              </h2>
              {staff.map((s) => (
                <div className="border-b border-[var(--border-subtle)] p-4" key={s.id}>
                  <b>{s.name}</b>
                  <span className="float-right rounded-full bg-brand-green/10 px-2 py-1 text-[9px] font-bold text-brand-green">
                    {s.role.replaceAll("_", " ")}
                  </span>
                  <small className="mt-1 block text-[var(--text-muted)]">
                    {s.email}
                    {s.isSuspended ? " · Suspended" : ""}
                  </small>
                </div>
              ))}
              {!staff.length && (
                <p className="p-6 text-sm text-[var(--text-muted)]">No staff accounts yet.</p>
              )}
            </div>
            <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
              <h2 className="flex items-center gap-2 border-b border-[var(--border-subtle)] p-5 font-display text-xl">
                <Mail size={18} className="text-brand-orange" /> Pending invitations
              </h2>
              {invites.map((i) => (
                <div className="border-b border-[var(--border-subtle)] p-4" key={i.id}>
                  <b>{i.name}</b>
                  <span className="float-right text-[10px] font-bold text-brand-orange">
                    {i.role}
                  </span>
                  <small className="mt-1 block text-[var(--text-muted)]">
                    {i.email} · expires {new Date(i.expiresAt).toLocaleDateString()}
                  </small>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void resendInvite(i.id, i.email)}
                      disabled={busyInvite === i.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                    >
                      <RotateCcw size={12} /> Resend
                    </button>
                    <button
                      type="button"
                      onClick={() => void revokeInvite(i.id, i.email)}
                      disabled={busyInvite === i.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-[11px] font-bold text-red-500 disabled:opacity-50"
                    >
                      <Trash2 size={12} /> Revoke
                    </button>
                  </div>
                </div>
              ))}
              {!invites.length && (
                <p className="p-6 text-sm text-[var(--text-muted)]">No pending invitations.</p>
              )}
            </div>
          </div>
        </section>
      </main>

      {mode && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
          <form
            onSubmit={mode === "invite" ? submitInvite : submitDirect}
            className="w-full max-w-lg rounded-3xl bg-[var(--bg-primary)] p-7"
          >
            <div className="flex justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
                  Admin only
                </p>
                <h2 className="font-display text-3xl">
                  {mode === "invite" ? "INVITE STAFF" : "CREATE STAFF"}
                </h2>
              </div>
              <button type="button" onClick={() => setMode(null)} aria-label="Close">
                <X />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider">
                Full name
                <input
                  name="name"
                  required
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider">
                Work email
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider">
                Role
                <select
                  name="role"
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                >
                  {roles.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              {mode === "direct" && (
                <label className="block text-xs font-bold uppercase tracking-wider">
                  Phone (optional)
                  <input
                    name="phone"
                    className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm normal-case"
                  />
                </label>
              )}
            </div>
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              {mode === "invite"
                ? "The activation token is displayed once and expires after seven days."
                : "A strong temporary password is shown once. The staff member must change it on first login."}
            </p>
            <button className="mt-6 w-full rounded-full bg-brand-green py-3 text-xs font-bold uppercase tracking-widest text-brand-navy">
              {mode === "invite" ? "Create secure invitation" : "Create account now"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
