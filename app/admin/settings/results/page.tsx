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
 * Result Settings (F0-18, W2) — the grading half of the settings framework.
 *
 * Two things a school must be able to answer before any result is computed:
 *   • Which bands does each stage use? (WAEC A1–F9 for secondary, letters for
 *     primary, developmental descriptors for early years.)
 *   • What is the result policy? (positions, cumulative, release.)
 *
 * The bands are validated server-side to cover the whole scale with no gaps
 * and no overlaps — a gap drops every score inside it out of the broadsheet,
 * which a school only notices when a parent asks.
 */

type Band = {
  grade: string;
  minScore: number;
  maxScore: number;
  remark: string;
  points: number | null;
  order: number;
};

type Payload = {
  stage: string;
  bands: Band[];
  results: { showPositions: boolean; showCumulative: boolean; releaseRequired: boolean };
};

type StageView = {
  stage: string;
  label: string;
  isOffered: boolean;
  gradingMode: "PERCENTAGE" | "DESCRIPTOR";
  maxScore: number;
  passMark: number;
};

const SETTINGS_TABS = [
  { href: "/admin/settings", label: "School", active: false },
  { href: "/admin/settings/academic", label: "Academic & stages", active: false },
  { href: "/admin/settings/results", label: "Grading & results", active: true },
];

const STAGE_OPTIONS = [
  { value: "EARLY_YEARS", label: "Early Years" },
  { value: "PRIMARY", label: "Primary" },
  { value: "JUNIOR_SECONDARY", label: "Junior Secondary" },
  { value: "SENIOR_SECONDARY", label: "Senior Secondary" },
];

export default function ResultSettingsPage() {
  const [stage, setStage] = useState("JUNIOR_SECONDARY");
  const [stages, setStages] = useState<StageView[]>([]);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const loadStages = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/stages", { cache: "no-store" });
      if (res.ok) setStages(((await res.json()) as { stages: StageView[] }).stages);
    } catch {
      // The stage list only powers the picker's hints; the bands below are the
      // real content and load separately.
    }
  }, []);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/settings/grading?stage=${target}`, { cache: "no-store" });
      if (res.status === 401) {
        setError("Your session has expired. Sign in again to continue.");
        return;
      }
      if (res.status === 403) {
        setError("Your role cannot change result settings.");
        return;
      }
      if (!res.ok) {
        setError("Could not load grading settings. Please try again.");
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
    void loadStages();
  }, [loadStages]);

  useEffect(() => {
    void load(stage);
  }, [load, stage]);

  async function saveBands(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setBusy(true);
    setError(null);
    setSaved(null);

    const form = new FormData(event.currentTarget);
    const bands: Band[] = [];
    for (let index = 0; index < data.bands.length; index += 1) {
      const key = (suffix: string) => `${suffix}-${index}`;
      bands.push({
        grade: String(form.get(key("grade")) ?? "").trim(),
        minScore: Number(form.get(key("min"))),
        maxScore: Number(form.get(key("max"))),
        remark: String(form.get(key("remark")) ?? "").trim(),
        points: form.get(key("points")) === "" ? null : Number(form.get(key("points"))),
        order: index + 1,
      });
    }

    try {
      const res = await fetch("/api/admin/settings/grading", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, bands }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not save these bands.");
        return;
      }
      setSaved("Grade bands saved. Every score now lands in exactly one band.");
      await load(stage);
    } catch {
      setError("Could not reach the server. Your changes were not saved.");
    } finally {
      setBusy(false);
    }
  }

  async function savePolicy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(null);
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/admin/settings/grading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results: {
            showPositions: form.get("showPositions") === "on",
            showCumulative: form.get("showCumulative") === "on",
            releaseRequired: form.get("releaseRequired") === "on",
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not save the result policy.");
        return;
      }
      setSaved("Result policy saved.");
      await load(stage);
    } catch {
      setError("Could not reach the server. Your changes were not saved.");
    } finally {
      setBusy(false);
    }
  }

  const stageInfo = stages.find((entry) => entry.stage === stage);

  return (
    <SettingsShell
      title="Grading"
      accent="& results"
      badge="Settings · F0-18"
      description="Grade bands are per stage: descriptors for early years, letters for primary, WAEC A1–F9 for secondary. Bands must cover the whole scale — a gap silently drops scores from the broadsheet."
      tabs={SETTINGS_TABS}
    >
      {error ? <SettingsNotice kind="error">{error}</SettingsNotice> : null}
      {saved ? <SettingsNotice kind="success">{saved}</SettingsNotice> : null}

      <SettingsCard
        title="Stage"
        note="Grading is configured per stage, because a pre-school and SS3 in the same building cannot be graded the same way."
      >
        <Field label="Configuring bands for">
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            className={inputClass}
          >
            {STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        {stageInfo ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {stageInfo.gradingMode === "PERCENTAGE"
              ? `Scored 0–${stageInfo.maxScore}, pass mark ${stageInfo.passMark}.`
              : `Descriptor ratings 1–${stageInfo.maxScore} (narrative reporting).`}
          </p>
        ) : null}
      </SettingsCard>

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-[var(--text-secondary)]">
          <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading grade bands…
        </div>
      ) : data ? (
        <>
          <form onSubmit={saveBands}>
            <SettingsCard
              title="Grade bands"
              note="Each row is inclusive. The server refuses bands that overlap or leave a score uncovered."
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                      <th className="pb-2">Grade</th>
                      <th className="pb-2">From</th>
                      <th className="pb-2">To</th>
                      <th className="pb-2">Remark</th>
                      <th className="pb-2">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bands.map((band, index) => (
                      <tr
                        key={`${band.grade}-${index}`}
                        className="border-t border-[var(--border-subtle)]"
                      >
                        <td className="py-2 pr-2">
                          <input
                            name={`grade-${index}`}
                            defaultValue={band.grade}
                            aria-label={`Grade label ${index + 1}`}
                            className="w-20 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-2 text-sm"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            name={`min-${index}`}
                            type="number"
                            min={0}
                            defaultValue={band.minScore}
                            aria-label={`Minimum score for ${band.grade}`}
                            className="w-20 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-2 text-sm"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            name={`max-${index}`}
                            type="number"
                            min={0}
                            defaultValue={band.maxScore}
                            aria-label={`Maximum score for ${band.grade}`}
                            className="w-20 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-2 text-sm"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            name={`remark-${index}`}
                            defaultValue={band.remark}
                            aria-label={`Remark for ${band.grade}`}
                            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-2 text-sm"
                          />
                        </td>
                        <td className="py-2">
                          <input
                            name={`points-${index}`}
                            type="number"
                            min={0}
                            defaultValue={band.points ?? ""}
                            aria-label={`Points for ${band.grade}`}
                            className="w-16 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-2 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="mt-4 rounded-xl bg-brand-green px-5 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save grade bands"}
              </button>
            </SettingsCard>
          </form>

          <form onSubmit={savePolicy}>
            <SettingsCard
              title="Result policy"
              note="Rule 6 and §6: a result is released deliberately, with a named approver, and parents only see it after release."
            >
              <div className="space-y-3 text-sm">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="showPositions"
                    defaultChecked={data.results.showPositions}
                    className="h-4 w-4"
                  />
                  <span className="text-[var(--text-secondary)]">
                    Compute and print class positions
                  </span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="showCumulative"
                    defaultChecked={data.results.showCumulative}
                    className="h-4 w-4"
                  />
                  <span className="text-[var(--text-secondary)]">
                    Show session cumulative beside the term result
                  </span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="releaseRequired"
                    defaultChecked={data.results.releaseRequired}
                    className="h-4 w-4"
                  />
                  <span className="text-[var(--text-secondary)]">
                    Parents see a result only after an admin releases it
                  </span>
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-brand-green px-5 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save result policy"}
                </button>
                <Link
                  href="/admin/report-cards"
                  className="text-xs font-semibold text-brand-green hover:underline"
                >
                  Report cards →
                </Link>
                <Link
                  href="/admin/broadsheet"
                  className="text-xs font-semibold text-brand-green hover:underline"
                >
                  Broadsheet →
                </Link>
              </div>
            </SettingsCard>
          </form>
        </>
      ) : null}
    </SettingsShell>
  );
}
