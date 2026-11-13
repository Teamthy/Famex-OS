"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { KeyRound, Mail, RotateCcw, Trash2, UserPlus, Users, X } from "lucide-react";
import { PROVISIONABLE_STAFF_ROLES, ROLE_LABELS } from "@/lib/roles";
import { useToast } from "@/components/Toast";

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

/**
 * B-06: the provisionable roles come from the same prisma-free list the
 * matrix and the staff API validate against (lib/roles.ts) — this <select>
 * used to offer six of eleven staff roles, so five could never be created.
 * Options show human labels (the enum is never shown raw to a user) while
 * submitting the enum value the API expects.
 */
const roles = PROVISIONABLE_STAFF_ROLES;

export default function StaffPage() {
  const { toast } = useToast();
  const submittingRef = useRef(false);
  const busyInviteRef = useRef<string | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busyInvite, setBusyInvite] = useState<string | null>(null);
  const [busyInviteAction, setBusyInviteAction] = useState<"resend" | "revoke" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"invite" | "direct" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/staff/invites", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Could not load staff.");
    setStaff(body.staff);
    setInvites(body.invites);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      try {
        const response = await fetch("/api/admin/staff/invites", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load staff.");
        if (!cancelled) {
          setStaff(body.staff);
          setInvites(body.invites);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load staff.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshAfterMutation() {
    try {
      await load();
    } catch {
      const message = "The account action completed, but the staff list could not refresh.";
      setError(message);
      toast(message, "warning");
    }
  }

  async function submitInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    let receivedResponse = false;
    try {
      const response = await fetch("/api/admin/staff/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
      });
      const body = await response.json();
      receivedResponse = true;
      if (!response.ok) throw new Error(body.error || "Unable to create invitation.");
      setMode(null);
      const activation = `${window.location.origin}/staff/activate?token=${body.activationToken}`;
      setNotice(
        `Invitation created for ${body.invite.email}. Copy this one-time activation link now: ${activation}`,
      );
      toast(
        `Invitation created for ${body.invite.email}. Copy the one-time link from the notice.`,
        "success",
      );
      await refreshAfterMutation();
    } catch (submitError) {
      const message = receivedResponse
        ? submitError instanceof Error
          ? submitError.message
          : "Unable to create invitation."
        : "Could not confirm invitation creation. Check pending invitations before retrying; the invite may already exist.";
      setError(message);
      toast(message, "error");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  /** Revoke a pending invitation — kills the activation token immediately. */
  async function revokeInvite(id: string, email: string) {
    if (!window.confirm(`Revoke the invitation for ${email}? Their activation link stops working.`))
      return;
    if (busyInviteRef.current) return;
    setError("");
    busyInviteRef.current = id;
    setBusyInvite(id);
    setBusyInviteAction("revoke");
    let receivedResponse = false;
    try {
      const r = await fetch(`/api/admin/staff/invites/${id}`, { method: "DELETE" });
      const j = await r.json();
      receivedResponse = true;
      if (!r.ok) throw new Error(j.error || "Unable to revoke.");
      const message = j.alreadyRevoked
        ? `Invitation for ${email} was already revoked.`
        : `Invitation for ${email} revoked.`;
      setNotice(message);
      toast(message, j.alreadyRevoked ? "info" : "success");
      await refreshAfterMutation();
    } catch (err) {
      const message = receivedResponse
        ? err instanceof Error
          ? err.message
          : "Unable to revoke."
        : "Revocation could not be confirmed. Retry is safe; revoking twice is idempotent.";
      setError(message);
      toast(message, "error");
    } finally {
      busyInviteRef.current = null;
      setBusyInvite(null);
      setBusyInviteAction(null);
    }
  }

  /** Reissue: new token, fresh 7-day expiry, email resent. Old link dies. */
  async function resendInvite(id: string, email: string) {
    if (busyInviteRef.current) return;
    setError("");
    busyInviteRef.current = id;
    setBusyInvite(id);
    setBusyInviteAction("resend");
    let receivedResponse = false;
    try {
      const r = await fetch(`/api/admin/staff/invites/${id}`, { method: "POST" });
      const j = await r.json();
      receivedResponse = true;
      if (!r.ok) throw new Error(j.error || "Unable to resend.");
      const link = `${window.location.origin}/staff/activate?token=${j.activationToken}`;
      setNotice(
        j.emailSent
          ? `The email provider accepted a new invitation request for ${email}; this does not confirm inbox delivery. The previous link no longer works. Backup link: ${link}`
          : `The email provider did not accept the request. Share this new link with ${email}: ${link}`,
      );
      toast(
        j.emailSent
          ? `Email provider accepted the resend request for ${email}; delivery is not confirmed.`
          : `Email provider did not accept the resend request for ${email}; use the backup link.`,
        j.emailSent ? "success" : "warning",
      );
      await refreshAfterMutation();
    } catch (err) {
      const message = receivedResponse
        ? err instanceof Error
          ? err.message
          : "Unable to resend."
        : "Resend could not be confirmed. The previous link may have been invalidated; retry resend to issue a current link.";
      setError(message);
      toast(message, "error");
    } finally {
      busyInviteRef.current = null;
      setBusyInvite(null);
      setBusyInviteAction(null);
    }
  }

  async function submitDirect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    let receivedResponse = false;
    try {
      const response = await fetch("/api/admin/staff/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
      });
      const body = await response.json();
      receivedResponse = true;
      if (!response.ok) throw new Error(body.error || "Unable to create staff account.");
      setMode(null);
      setNotice(
        `Account created for ${body.user.email}. Temporary password (copy now): ${body.temporaryPassword}. They must change it on first login.`,
      );
      toast(
        `Staff account created for ${body.user.email}. Copy the one-time password from the notice.`,
        "success",
      );
      await refreshAfterMutation();
    } catch (submitError) {
      const message = receivedResponse
        ? submitError instanceof Error
          ? submitError.message
          : "Unable to create staff account."
        : "Could not confirm account creation. Check the staff list before retrying; the account may already exist. The one-time password is not recoverable from a retry.";
      setError(message);
      toast(message, "error");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
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
            <p className="mt-3 text-sm text-white/85">
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
              className="inline-flex items-center gap-2 rounded-full bg-famex-lime px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-navy"
            >
              <UserPlus size={15} /> Invite staff
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
              <h2 className="flex items-center gap-2 border-b border-[var(--border-subtle)] p-5 font-display text-xl">
                <Users size={18} className="text-brand-green" /> Active staff
              </h2>
              {loading ? (
                <p className="p-6 text-sm text-[var(--text-muted)]">Loading staff accounts…</p>
              ) : (
                staff.map((s) => (
                  <div className="border-b border-[var(--border-subtle)] p-4" key={s.id}>
                    <b>{s.name}</b>
                    <span className="float-right rounded-full bg-famex-lime/10 px-2 py-1 text-[9px] font-bold text-brand-green">
                      {s.role.replaceAll("_", " ")}
                    </span>
                    <small className="mt-1 block text-[var(--text-muted)]">
                      {s.email}
                      {s.isSuspended ? " · Suspended" : ""}
                    </small>
                  </div>
                ))
              )}
              {!loading && !staff.length && (
                <p className="p-6 text-sm text-[var(--text-muted)]">No staff accounts yet.</p>
              )}
            </div>
            <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
              <h2 className="flex items-center gap-2 border-b border-[var(--border-subtle)] p-5 font-display text-xl">
                <Mail size={18} className="text-brand-orange" /> Pending invitations
              </h2>
              {loading ? (
                <p className="p-6 text-sm text-[var(--text-muted)]">Loading invitations…</p>
              ) : (
                invites.map((i) => (
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
                        disabled={busyInvite !== null}
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                      >
                        <RotateCcw size={12} />
                        {busyInvite === i.id && busyInviteAction === "resend"
                          ? "Resending…"
                          : "Resend"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void revokeInvite(i.id, i.email)}
                        disabled={busyInvite !== null}
                        className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-[11px] font-bold text-red-500 disabled:opacity-50"
                      >
                        <Trash2 size={12} />
                        {busyInvite === i.id && busyInviteAction === "revoke"
                          ? "Revoking…"
                          : "Revoke"}
                      </button>
                    </div>
                  </div>
                ))
              )}
              {!loading && !invites.length && (
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
            aria-busy={submitting}
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
              <button
                type="button"
                onClick={() => setMode(null)}
                disabled={submitting}
                aria-label="Close"
              >
                <X />
              </button>
            </div>
            <fieldset disabled={submitting} className="mt-6 space-y-4">
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
                    <option key={x} value={x}>
                      {ROLE_LABELS[x]}
                    </option>
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
            </fieldset>
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              {mode === "invite"
                ? "The activation token is displayed once and expires after seven days."
                : "A strong temporary password is shown once. The staff member must change it on first login."}
            </p>
            <button
              disabled={submitting}
              className="mt-6 w-full rounded-full bg-famex-lime py-3 text-xs font-bold uppercase tracking-widest text-brand-navy disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? mode === "invite"
                  ? "Creating invitation…"
                  : "Creating account…"
                : mode === "invite"
                  ? "Create secure invitation"
                  : "Create account now"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
