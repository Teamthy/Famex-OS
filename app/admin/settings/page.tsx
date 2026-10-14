"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import {
  Field,
  SettingsCard,
  SettingsNotice,
  SettingsShell,
  inputClass,
} from "@/components/settings/SettingsShell";

/**
 * School Settings (F0-18, W2) — identity, branding and the school-wide
 * defaults that used to live in environment variables and scattered forms.
 *
 * Everything here is written through /api/admin/settings (ADMIN/DIRECTOR):
 * this screen asks, the server decides (Rule 3). School name and colours are
 * brand tokens (F0-21) — they drive the chrome, the report cards and the PWA
 * manifest, never a literal in a component.
 */

type SchoolSettingsPayload = {
  school: {
    name: string;
    slug: string;
    address: string;
    phone: string;
    email: string;
    motto: string;
    status: string | null;
    displayName: string | null;
    primaryColor: string | null;
    accentColor: string | null;
  };
  settings: {
    academic: { termsPerSession: number; weekStartsOn: "MONDAY" | "SUNDAY" };
    results: { showPositions: boolean; showCumulative: boolean; releaseRequired: boolean };
    fees: { currency: "NGN"; invoiceDueDays: number };
  };
};

const SETTINGS_TABS = [
  { href: "/admin/settings", label: "School", active: true },
  { href: "/admin/settings/academic", label: "Academic & stages", active: false },
  { href: "/admin/settings/results", label: "Grading & results", active: false },
];

export default function SchoolSettingsPage() {
  const [data, setData] = useState<SchoolSettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      if (res.status === 401) {
        setError("Your session has expired. Sign in again to continue.");
        return;
      }
      if (res.status === 403) {
        setError("Your role cannot change school settings.");
        return;
      }
      if (!res.ok) {
        setError("Could not load settings. Please try again.");
        return;
      }
      setData((await res.json()) as SchoolSettingsPayload);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setSaving(true);
    setError(null);
    setSaved(null);

    const form = new FormData(event.currentTarget);
    const asString = (key: string) => String(form.get(key) ?? "").trim();

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school: {
            name: asString("name"),
            address: asString("address"),
            phone: asString("phone"),
            email: asString("email"),
            motto: asString("motto"),
            displayName: asString("displayName"),
            primaryColor: asString("primaryColor"),
            accentColor: asString("accentColor"),
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not save. Please try again.");
        return;
      }
      setSaved("Saved. The portal, report cards and PWA icons now use these details.");
      await load();
    } catch {
      setError("Could not reach the server. Your changes were not saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsShell
      title="School"
      accent="settings"
      badge="Settings · F0-18"
      description="Who the school is: name, contacts and colours. These are brand tokens — they drive the portal, report cards and the installable app, never a hard-coded literal."
      tabs={SETTINGS_TABS}
    >
      {error ? <SettingsNotice kind="error">{error}</SettingsNotice> : null}
      {saved ? <SettingsNotice kind="success">{saved}</SettingsNotice> : null}

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-[var(--text-secondary)]">
          <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading settings…
        </div>
      ) : data ? (
        <form onSubmit={save} className="space-y-6">
          <SettingsCard
            title="Identity"
            note="The confirmed address is what appears on receipts, ID cards and the public site. Leave it blank until the school has confirmed it — nothing is printed meanwhile."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="School name">
                <input
                  name="name"
                  defaultValue={data.school.name}
                  required
                  minLength={2}
                  className={inputClass}
                />
              </Field>
              <Field
                label="Display name on portal"
                hint="Falls back to the school name when blank."
              >
                <input
                  name="displayName"
                  defaultValue={data.school.displayName ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Address">
                <input name="address" defaultValue={data.school.address} className={inputClass} />
              </Field>
              <Field label="Phone">
                <input name="phone" defaultValue={data.school.phone} className={inputClass} />
              </Field>
              <Field label="Email">
                <input
                  name="email"
                  type="email"
                  defaultValue={data.school.email}
                  className={inputClass}
                />
              </Field>
              <Field label="Motto / tagline">
                <input name="motto" defaultValue={data.school.motto} className={inputClass} />
              </Field>
              <Field label="Brand colour (dark)">
                <input
                  name="primaryColor"
                  type="color"
                  defaultValue={data.school.primaryColor ?? "#0c1824"}
                  className="mt-1.5 h-11 w-full cursor-pointer rounded-xl border border-[var(--border-subtle)]"
                />
              </Field>
              <Field label="Accent colour">
                <input
                  name="accentColor"
                  type="color"
                  defaultValue={data.school.accentColor ?? "#4ec54d"}
                  className="mt-1.5 h-11 w-full cursor-pointer rounded-xl border border-[var(--border-subtle)]"
                />
              </Field>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Current settings"
            note="Academic, grading and fee policy live on their own screens so each one is saved deliberately."
          >
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  Terms per session
                </dt>
                <dd className="font-semibold text-[var(--text-primary)]">
                  {data.settings.academic.termsPerSession}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  Week starts
                </dt>
                <dd className="font-semibold text-[var(--text-primary)]">
                  {data.settings.academic.weekStartsOn}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  Class positions
                </dt>
                <dd className="font-semibold text-[var(--text-primary)]">
                  {data.settings.results.showPositions ? "Shown" : "Hidden"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  Results release
                </dt>
                <dd className="font-semibold text-[var(--text-primary)]">
                  {data.settings.results.releaseRequired
                    ? "Admins release per term"
                    : "Visible when generated"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  Invoice due
                </dt>
                <dd className="font-semibold text-[var(--text-primary)]">
                  {data.settings.fees.invoiceDueDays} days after issue
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  Currency
                </dt>
                <dd className="font-semibold text-[var(--text-primary)]">
                  {data.settings.fees.currency} (integer kobo)
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <Link
                href="/admin/settings/academic"
                className="font-semibold text-brand-green hover:underline"
              >
                Academic & stages →
              </Link>
              <Link
                href="/admin/settings/results"
                className="font-semibold text-brand-green hover:underline"
              >
                Grading & results →
              </Link>
              <Link
                href="/admin/licence"
                className="font-semibold text-brand-green hover:underline"
              >
                Licence & module switches →
              </Link>
              <Link href="/onboarding" className="font-semibold text-brand-green hover:underline">
                Setup wizard →
              </Link>
            </div>
          </SettingsCard>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-green px-5 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save settings"}
            </button>
            {data.school.status ? (
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
                School status: {data.school.status}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </SettingsShell>
  );
}
