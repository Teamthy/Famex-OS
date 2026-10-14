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
 * Academic Settings (F0-18, W2) — which stages this school runs and how the
 * academic year is shaped.
 *
 * 10-scope-additions §4: Famex runs pre-school → SS3 and the base was
 * secondary-only. The stage ladder is the setting that repairs that: switching
 * a stage on or off changes what the wizard offers, how classes are created,
 * and (from W6) which report template a class gets.
 */

type StageView = {
  stage: string;
  label: string;
  order: number;
  isOffered: boolean;
  gradingMode: "PERCENTAGE" | "DESCRIPTOR";
  maxScore: number;
  passMark: number;
  usesPositions: boolean;
  usesCbt: boolean;
  assessmentSummary: string;
  bandCount: number;
};

type Payload = {
  stages: StageView[];
  academic: { termsPerSession: number; weekStartsOn: "MONDAY" | "SUNDAY" };
};

const SETTINGS_TABS = [
  { href: "/admin/settings", label: "School", active: false },
  { href: "/admin/settings/academic", label: "Academic & stages", active: true },
  { href: "/admin/settings/results", label: "Grading & results", active: false },
];

export default function AcademicSettingsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/stages", { cache: "no-store" });
      if (res.status === 401) {
        setError("Your session has expired. Sign in again to continue.");
        return;
      }
      if (res.status === 403) {
        setError("Your role cannot change academic settings.");
        return;
      }
      if (!res.ok) {
        setError("Could not load academic settings. Please try again.");
        return;
      }
      setData((await res.json()) as Payload);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStage(stage: string, patch: Record<string, unknown>) {
    setBusy(stage);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/admin/settings/stages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, patch }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not save that stage. Please try again.");
        return;
      }
      setSaved("Saved. The class pickers and the wizard now follow this ladder.");
      await load();
    } catch {
      setError("Could not reach the server. Your change was not saved.");
    } finally {
      setBusy(null);
    }
  }

  async function saveAcademic(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("academic");
    setError(null);
    setSaved(null);
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/admin/settings/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academic: {
            termsPerSession: Number(form.get("termsPerSession")),
            weekStartsOn: String(form.get("weekStartsOn")),
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not save the academic settings.");
        return;
      }
      setSaved("Academic settings saved.");
      await load();
    } catch {
      setError("Could not reach the server. Your change was not saved.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SettingsShell
      title="Academic"
      accent="settings"
      badge="Settings · F0-18"
      description="The stage ladder decides what a class means: early years is graded with descriptors, secondary with WAEC bands. Switch off a stage the school does not run."
      tabs={SETTINGS_TABS}
    >
      {error ? <SettingsNotice kind="error">{error}</SettingsNotice> : null}
      {saved ? <SettingsNotice kind="success">{saved}</SettingsNotice> : null}

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-[var(--text-secondary)]">
          <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading stages…
        </div>
      ) : data ? (
        <>
          <SettingsCard
            title="Stages we run"
            note="Youngest first. A stage that is switched off is hidden from class creation and the setup wizard — its history is kept, never deleted."
          >
            <ul className="space-y-3">
              {data.stages.map((stage) => (
                <li
                  key={stage.stage}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-disabled)] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[var(--text-primary)]">
                        {stage.label}
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {stage.assessmentSummary}
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                        {stage.gradingMode === "PERCENTAGE"
                          ? `Scored 0–${stage.maxScore} · pass mark ${stage.passMark}`
                          : `Descriptor ratings 1–${stage.maxScore}`}
                        {stage.usesCbt ? " · CBT on" : " · CBT off"}
                        {` · ${stage.bandCount} grade band${stage.bandCount === 1 ? "" : "s"}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {stage.usesCbt ? (
                        <button
                          type="button"
                          disabled={busy === stage.stage}
                          onClick={() => void updateStage(stage.stage, { usesCbt: false })}
                          className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)] disabled:opacity-50"
                        >
                          Turn CBT off
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy === stage.stage}
                          onClick={() => void updateStage(stage.stage, { usesCbt: true })}
                          className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)] disabled:opacity-50"
                        >
                          Turn CBT on
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy === stage.stage}
                        onClick={() =>
                          void updateStage(stage.stage, { isOffered: !stage.isOffered })
                        }
                        className={`rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-widest disabled:opacity-50 ${
                          stage.isOffered
                            ? "bg-brand-green/15 text-brand-green"
                            : "border border-[var(--border-subtle)] text-[var(--text-muted)]"
                        }`}
                      >
                        {busy === stage.stage
                          ? "Saving…"
                          : stage.isOffered
                            ? "Offered"
                            : "Not offered"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </SettingsCard>

          <form onSubmit={saveAcademic}>
            <SettingsCard
              title="Academic year"
              note="How a session is split into terms. The session and term dates themselves live in Sessions & Terms."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Terms per session">
                  <input
                    name="termsPerSession"
                    type="number"
                    min={1}
                    max={6}
                    defaultValue={data.academic.termsPerSession}
                    className={inputClass}
                  />
                </Field>
                <Field label="Week starts on">
                  <select
                    name="weekStartsOn"
                    defaultValue={data.academic.weekStartsOn}
                    className={inputClass}
                  >
                    <option value="MONDAY">Monday</option>
                    <option value="SUNDAY">Sunday</option>
                  </select>
                </Field>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={busy === "academic"}
                  className="rounded-xl bg-brand-green px-5 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
                >
                  {busy === "academic" ? "Saving…" : "Save academic year"}
                </button>
                <Link
                  href="/admin/sessions"
                  className="text-xs font-semibold text-brand-green hover:underline"
                >
                  Sessions & terms →
                </Link>
                <Link
                  href="/admin/class-manager"
                  className="text-xs font-semibold text-brand-green hover:underline"
                >
                  Classes & streams →
                </Link>
                <Link
                  href="/admin/subjects"
                  className="text-xs font-semibold text-brand-green hover:underline"
                >
                  Subjects →
                </Link>
              </div>
            </SettingsCard>
          </form>
        </>
      ) : null}
    </SettingsShell>
  );
}
