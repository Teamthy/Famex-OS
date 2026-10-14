"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Circle,
  GraduationCap,
  Layers,
  LoaderCircle,
  Mail,
  ToggleRight,
} from "lucide-react";
import { MODULE_KEYS, MODULES, type ModuleKey } from "@/lib/module-registry";
import {
  STAGES,
  STAGE_SUBJECT_TEMPLATES,
  levelsForStage,
  suggestedModulesForStages,
} from "@/lib/stages";
import type { StageKey } from "@/lib/stage-types";

/**
 * First-run provisioning wizard (F0-22, W2 exit criterion).
 *
 * A new school is usable end to end when this finishes: identity, academic
 * year with its terms, the stages it runs, classes, a starting subject
 * catalogue, module switches and the first staff invitations — no developer,
 * no database edit.
 *
 * Two things make it usable on the connection it will actually meet:
 *
 *   • ONE step per request. A half-applied mega-POST is the worst failure
 *     mode on a school-office 3G link; each step is independently retryable,
 *     and every step is idempotent server-side.
 *   • RESUMABLE. It loads what already exists and starts where the school
 *     left off, so closing the tab is not a disaster.
 */

type StepKey = "identity" | "academic" | "stages" | "classes" | "subjects" | "modules" | "staff";

const STEPS: { key: StepKey; label: string; icon: typeof Building2 }[] = [
  { key: "identity", label: "School", icon: Building2 },
  { key: "academic", label: "Academic year", icon: CalendarDays },
  { key: "stages", label: "Stages", icon: Layers },
  { key: "classes", label: "Classes", icon: GraduationCap },
  { key: "subjects", label: "Subjects", icon: GraduationCap },
  { key: "modules", label: "Modules", icon: ToggleRight },
  { key: "staff", label: "Staff", icon: Mail },
];

type ProvisionState = {
  school: {
    name: string;
    address: string;
    phone: string;
    email: string;
    motto: string;
    displayName: string | null;
  };
  academic: { label: string; terms: { index: number; label: string }[] } | null;
  stages: StageKey[];
  counts: { classes: number; subjects: number; staff: number };
  modules: Record<string, boolean>;
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[var(--color-brand-green)] focus:outline-none";
const labelClass = "block text-xs font-bold uppercase tracking-widest text-gray-500";

export default function OnboardingPage() {
  const router = useRouter();
  const [state, setState] = useState<ProvisionState | null>(null);
  const [step, setStep] = useState<StepKey>("identity");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Choices the later steps depend on.
  const [chosenStages, setChosenStages] = useState<StageKey[]>([
    "JUNIOR_SECONDARY",
    "SENIOR_SECONDARY",
  ]);
  const [chosenLevels, setChosenLevels] = useState<string[]>([]);
  const [arms, setArms] = useState("A,B");
  const [moduleChoice, setModuleChoice] = useState<Record<string, boolean> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/provision", { cache: "no-store" });
      if (res.status === 401) {
        setError("Sign in as an administrator to run setup.");
        return;
      }
      if (res.status === 403) {
        setError("Only the school administrator can run first-time setup.");
        return;
      }
      if (!res.ok) {
        setError("Could not read the current setup. Please try again.");
        return;
      }
      const body = (await res.json()) as ProvisionState;
      setState(body);
      if (body.stages.length > 0) setChosenStages(body.stages);
      // Resume: start where the school stopped.
      if (!body.academic) setStep("academic");
      else if (body.stages.length === 0) setStep("stages");
      else if (body.counts.classes === 0) setStep("classes");
      else if (body.counts.subjects === 0) setStep("subjects");
      else setStep("modules");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const levels = useMemo(
    () => chosenStages.flatMap((stage) => levelsForStage(stage).map((level) => level.level)),
    [chosenStages],
  );

  const suggestedModules = useMemo(() => suggestedModulesForStages(chosenStages), [chosenStages]);

  async function submitStep(body: Record<string, unknown>, next: StepKey | "done") {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/onboarding/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const response = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(response.error ?? "That step could not be saved. Please try again.");
        return;
      }
      await load();
      if (next === "done") {
        setNote("Setup complete. The school is ready to use.");
        router.push("/admin");
        return;
      }
      setStep(next);
    } catch {
      setError("Could not reach the server. That step was not saved.");
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = STEPS.findIndex((entry) => entry.key === step);

  return (
    <div className="min-h-screen bg-[var(--color-brand-navy)] px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl tracking-widest text-white">SCHOOL SETUP</h1>
          <p className="mt-2 text-sm text-white/60">
            Six short steps. You can stop at any point — the wizard remembers where you got to.
          </p>
        </div>

        <ol className="mb-6 flex flex-wrap items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest">
          {STEPS.map((entry, index) => {
            const done = index < stepIndex;
            const active = entry.key === step;
            return (
              <li key={entry.key} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${
                    active
                      ? "border-[var(--color-brand-green)] bg-[var(--color-brand-green)]/20 text-[var(--color-brand-green)]"
                      : done
                        ? "border-white/20 text-white/70"
                        : "border-white/10 text-white/40"
                  }`}
                >
                  {done ? <CheckCircle2 size={12} /> : <entry.icon size={12} />}
                  {entry.label}
                </span>
                {index < STEPS.length - 1 && <span className="h-px w-4 bg-white/20" />}
              </li>
            );
          })}
        </ol>

        <div className="rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
          {error ? (
            <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}
          {note ? (
            <p className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {note}
            </p>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-3 p-8 text-gray-500">
              <LoaderCircle className="animate-spin" size={20} /> Reading the current setup…
            </div>
          ) : !state ? null : step === "identity" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void submitStep(
                  {
                    step: "identity",
                    name: String(form.get("name") ?? "").trim(),
                    address: String(form.get("address") ?? "").trim(),
                    phone: String(form.get("phone") ?? "").trim(),
                    email: String(form.get("email") ?? "").trim(),
                    motto: String(form.get("motto") ?? "").trim(),
                    displayName: String(form.get("displayName") ?? "").trim(),
                    primaryColor: String(form.get("primaryColor") ?? ""),
                    accentColor: String(form.get("accentColor") ?? ""),
                  },
                  "academic",
                );
              }}
              className="space-y-4"
            >
              <h2 className="font-display text-lg tracking-wide text-gray-900 uppercase">
                School details
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className={labelClass}>School name</span>
                  <input
                    name="name"
                    required
                    defaultValue={state.school.name}
                    className={inputClass}
                  />
                </label>
                <label>
                  <span className={labelClass}>Address</span>
                  <input
                    name="address"
                    defaultValue={state.school.address}
                    className={inputClass}
                  />
                </label>
                <label>
                  <span className={labelClass}>Phone</span>
                  <input name="phone" defaultValue={state.school.phone} className={inputClass} />
                </label>
                <label>
                  <span className={labelClass}>Email</span>
                  <input
                    name="email"
                    type="email"
                    defaultValue={state.school.email}
                    className={inputClass}
                  />
                </label>
                <label>
                  <span className={labelClass}>Motto</span>
                  <input name="motto" defaultValue={state.school.motto} className={inputClass} />
                </label>
                <label>
                  <span className={labelClass}>Display name on portal</span>
                  <input
                    name="displayName"
                    defaultValue={state.school.displayName ?? ""}
                    className={inputClass}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className={labelClass}>Dark colour</span>
                    <input
                      name="primaryColor"
                      type="color"
                      defaultValue="#0c1824"
                      className="mt-1.5 h-11 w-full cursor-pointer rounded-xl border border-gray-200"
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Accent</span>
                    <input
                      name="accentColor"
                      type="color"
                      defaultValue="#4ec54d"
                      className="mt-1.5 h-11 w-full cursor-pointer rounded-xl border border-gray-200"
                    />
                  </label>
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-green)] py-3.5 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Continue"} {!busy && <ArrowRight size={16} />}
              </button>
            </form>
          ) : step === "academic" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void submitStep(
                  {
                    step: "academic",
                    label: String(form.get("label") ?? "").trim(),
                    startsOn: String(form.get("startsOn") ?? ""),
                    endsOn: String(form.get("endsOn") ?? ""),
                    makeCurrent: true,
                  },
                  "stages",
                );
              }}
              className="space-y-4"
            >
              <h2 className="font-display text-lg tracking-wide text-gray-900 uppercase">
                Academic year and terms
              </h2>
              {state.academic ? (
                <p className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                  {state.academic.label} already exists with{" "}
                  {state.academic.terms.map((term) => term.label).join(", ")}. Sending this step
                  again will not create a duplicate.
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  The session is split into three terms automatically — you can adjust the dates
                  afterwards in Sessions &amp; Terms.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-3">
                <label>
                  <span className={labelClass}>Session</span>
                  <input
                    name="label"
                    required
                    placeholder="2026/2027"
                    defaultValue={state.academic?.label ?? ""}
                    className={inputClass}
                  />
                </label>
                <label>
                  <span className={labelClass}>Starts</span>
                  <input name="startsOn" type="date" required className={inputClass} />
                </label>
                <label>
                  <span className={labelClass}>Ends</span>
                  <input name="endsOn" type="date" required className={inputClass} />
                </label>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-green)] py-3.5 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Continue"} {!busy && <ArrowRight size={16} />}
              </button>
            </form>
          ) : step === "stages" ? (
            <div className="space-y-4">
              <h2 className="font-display text-lg tracking-wide text-gray-900 uppercase">
                Which stages does the school run?
              </h2>
              <p className="text-sm text-gray-500">
                This decides the class list, the grading model and which modules make sense. Each
                stage gets its default grading bands when you continue.
              </p>
              <ul className="space-y-2">
                {STAGES.map((stage) => {
                  const checked = chosenStages.includes(stage.key);
                  return (
                    <li key={stage.key}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setChosenStages((prev) =>
                              event.target.checked
                                ? [...prev, stage.key]
                                : prev.filter((key) => key !== stage.key),
                            )
                          }
                          className="mt-1 h-4 w-4"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-gray-800">
                            {stage.label}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {stage.assessmentSummary}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                disabled={busy || chosenStages.length === 0}
                onClick={() => void submitStep({ step: "stages", stages: chosenStages }, "classes")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-green)] py-3.5 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Continue"} {!busy && <ArrowRight size={16} />}
              </button>
            </div>
          ) : step === "classes" ? (
            <div className="space-y-4">
              <h2 className="font-display text-lg tracking-wide text-gray-900 uppercase">
                Classes
              </h2>
              <p className="text-sm text-gray-500">
                Pick the classes to create. Streams are the arms within a level (A, B, …) — leave
                blank for a single unstreamed class per level.
              </p>
              <div>
                <span className={labelClass}>Arms / streams</span>
                <input
                  value={arms}
                  onChange={(event) => setArms(event.target.value)}
                  placeholder="A,B"
                  className={inputClass}
                />
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {levels.map((level) => {
                  const checked = chosenLevels.includes(level);
                  return (
                    <li key={level}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setChosenLevels((prev) =>
                              event.target.checked
                                ? [...prev, level]
                                : prev.filter((entry) => entry !== level),
                            )
                          }
                          className="h-4 w-4"
                        />
                        <span className="text-sm text-gray-700">{level}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setChosenLevels(levels)}
                  className="font-semibold text-[var(--color-brand-green)] hover:underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setChosenLevels([])}
                  className="font-semibold text-gray-500 hover:underline"
                >
                  Clear
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={busy || chosenLevels.length === 0}
                  onClick={() =>
                    void submitStep(
                      {
                        step: "classes",
                        levels: chosenLevels,
                        arms: arms
                          .split(",")
                          .map((arm) => arm.trim())
                          .filter(Boolean),
                      },
                      "subjects",
                    )
                  }
                  className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-green)] py-3.5 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Create classes"} {!busy && <ArrowRight size={16} />}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStep("subjects")}
                  className="rounded-xl border border-gray-200 py-3.5 text-sm font-bold uppercase tracking-widest text-gray-500"
                >
                  Skip for now
                </button>
              </div>
            </div>
          ) : step === "subjects" ? (
            <div className="space-y-4">
              <h2 className="font-display text-lg tracking-wide text-gray-900 uppercase">
                Starting subject list
              </h2>
              <p className="text-sm text-gray-500">
                A sensible catalogue per level, editable later in Subjects. Existing subjects are
                never duplicated.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                {chosenStages.map((stage) => (
                  <li key={stage} className="rounded-xl border border-gray-200 p-3">
                    <span className="font-semibold text-gray-800">
                      {STAGES.find((entry) => entry.key === stage)?.label}
                    </span>
                    <span className="mt-1 block text-xs">
                      {STAGE_SUBJECT_TEMPLATES[stage].map((subject) => subject.name).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={busy || chosenLevels.length === 0}
                  onClick={() =>
                    void submitStep({ step: "subjects", levels: chosenLevels }, "modules")
                  }
                  className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-green)] py-3.5 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Create subjects"} {!busy && <ArrowRight size={16} />}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStep("modules")}
                  className="rounded-xl border border-gray-200 py-3.5 text-sm font-bold uppercase tracking-widest text-gray-500"
                >
                  Skip for now
                </button>
              </div>
              {chosenLevels.length === 0 ? (
                <p className="text-xs text-gray-400">
                  Choose classes first (or add subjects later) — subjects are created per class
                  level.
                </p>
              ) : null}
            </div>
          ) : step === "modules" ? (
            <div className="space-y-4">
              <h2 className="font-display text-lg tracking-wide text-gray-900 uppercase">
                What does the school use?
              </h2>
              <p className="text-sm text-gray-500">
                Suggested from the stages you chose. These switches drive the sidebar, the API
                entitlements and Licence &amp; Usage together — nothing is hidden that is switched
                on, and nothing works that is switched off.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {MODULE_KEYS.map((key: ModuleKey) => {
                  const choice = moduleChoice ?? suggestedModules;
                  const checked = choice[key] === true;
                  return (
                    <li key={key}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setModuleChoice({ ...choice, [key]: event.target.checked })
                          }
                          className="mt-1 h-4 w-4"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-gray-800">
                            {MODULES[key].label}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {MODULES[key].summary}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void submitStep(
                    { step: "modules", modules: moduleChoice ?? suggestedModules },
                    "staff",
                  )
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-green)] py-3.5 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save modules"} {!busy && <ArrowRight size={16} />}
              </button>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const invites = [1, 2, 3]
                  .map((index) => ({
                    name: String(form.get(`name-${index}`) ?? "").trim(),
                    email: String(form.get(`email-${index}`) ?? "").trim(),
                    role: String(form.get(`role-${index}`) ?? "TEACHER"),
                  }))
                  .filter((invite) => invite.name.length > 1 && invite.email.includes("@"));
                void submitStep(
                  { step: "staff", invites, sendEmails: true },
                  invites.length > 0 ? "done" : "staff",
                );
              }}
              className="space-y-4"
            >
              <h2 className="font-display text-lg tracking-wide text-gray-900 uppercase">
                Invite your first staff
              </h2>
              <p className="text-sm text-gray-500">
                Each person gets an activation email — their account is created when they open it.
                You can skip this and invite people any time from Users → Staff.
              </p>
              {[1, 2, 3].map((index) => (
                <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <label>
                    <span className={labelClass}>Name</span>
                    <input name={`name-${index}`} className={inputClass} />
                  </label>
                  <label>
                    <span className={labelClass}>Email</span>
                    <input name={`email-${index}`} type="email" className={inputClass} />
                  </label>
                  <label>
                    <span className={labelClass}>Role</span>
                    <select name={`role-${index}`} defaultValue="TEACHER" className={inputClass}>
                      {["TEACHER", "HOD", "BURSAR", "COORDINATOR", "DIRECTOR", "ADMIN"].map(
                        (role) => (
                          <option key={role} value={role}>
                            {role.replaceAll("_", " ")}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>
              ))}
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-green)] py-3.5 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Send invitations"} {!busy && <ArrowRight size={16} />}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitStep({ step: "staff", invites: [] }, "done")}
                  className="rounded-xl border border-gray-200 py-3.5 text-sm font-bold uppercase tracking-widest text-gray-500"
                >
                  Finish without inviting
                </button>
              </div>
              <p className="text-center text-xs text-gray-400">
                Everything here can be changed later in{" "}
                <Link
                  href="/admin/settings"
                  className="font-semibold text-[var(--color-brand-green)]"
                >
                  School settings
                </Link>
                .
              </p>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-white/40">
          <Circle size={10} className="mr-1 inline" /> Steps are saved as you go — closing this page
          loses nothing.
        </p>
      </div>
    </div>
  );
}
