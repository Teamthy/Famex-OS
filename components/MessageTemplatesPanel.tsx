"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, LoaderCircle, Plus, Save, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/Toast";

/**
 * Governed message templates + consent coverage (W4) — panel on the
 * notifications screen. Every save increments the template version; sends
 * record key+version so any message can be traced to its exact wording.
 * Consent coverage shows, before a broadcast, how many recorded opt-ins and
 * opt-outs exist per channel/kind.
 */

type Template = {
  id: string;
  key: string;
  kind: string;
  channel: string;
  subject: string;
  body: string;
  variables: string[];
  version: number;
  isActive: boolean;
};

type Coverage = { channel: string; kind: string; optedIn: boolean; count: number };

const KINDS = [
  "ATTENDANCE_ALERT",
  "FEE_REMINDER",
  "REPORT_RELEASED",
  "BROADCAST",
  "ADMISSION_UPDATE",
  "SYSTEM",
  "CLOCK_IN",
  "CLOCK_IN_LATE",
  "CLOCK_OUT",
] as const;
const CHANNELS = ["EMAIL", "SMS", "WHATSAPP"] as const;

const inputClass =
  "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]";

export default function MessageTemplatesPanel() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [missingDefaults, setMissingDefaults] = useState(0);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [kind, setKind] = useState<string>("FEE_REMINDER");
  const [channel, setChannel] = useState<string>("EMAIL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tplRes, consentRes] = await Promise.all([
        fetch("/api/admin/notifications/templates", { cache: "no-store" }),
        fetch("/api/admin/notifications/consent", { cache: "no-store" }),
      ]);
      const tplBody = (await tplRes.json()) as {
        templates?: Template[];
        missingDefaultCount?: number;
        error?: string;
      };
      if (!tplRes.ok) throw new Error(tplBody.error || "Unable to load templates.");
      setTemplates(tplBody.templates ?? []);
      setMissingDefaults(tplBody.missingDefaultCount ?? 0);
      if (consentRes.ok) {
        const consentBody = (await consentRes.json()) as { coverage?: Coverage[] };
        setCoverage(consentBody.coverage ?? []);
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to load templates.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function select(template: Template) {
    setSelectedId(template.id);
    setKey(template.key);
    setKind(template.kind);
    setChannel(template.channel);
    setSubject(template.subject);
    setBody(template.body);
  }

  function startNew() {
    setSelectedId(null);
    setKey("");
    setKind("FEE_REMINDER");
    setChannel("EMAIL");
    setSubject("");
    setBody("");
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/notifications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT",
          key: key.trim(),
          kind,
          channel,
          subject,
          body,
        }),
      });
      const result = (await response.json()) as { error?: string; template?: Template };
      if (!response.ok) throw new Error(result.error || "The template could not be saved.");
      toast(`Template saved (version ${result.template?.version ?? "—"}).`, "success");
      await load();
      if (result.template) setSelectedId(result.template.id);
    } catch (error) {
      toast(error instanceof Error ? error.message : "The template could not be saved.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(template: Template, isActive: boolean) {
    try {
      const response = await fetch("/api/admin/notifications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_ACTIVE", templateId: template.id, isActive }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "The change could not be saved.");
      toast(isActive ? "Template switched on." : "Template switched off.", "success");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "The change could not be saved.", "error");
    }
  }

  async function seedDefaults() {
    setSeeding(true);
    try {
      const response = await fetch("/api/admin/notifications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SEED_DEFAULTS" }),
      });
      const result = (await response.json()) as { error?: string; created?: number };
      if (!response.ok) throw new Error(result.error || "Starter templates could not be created.");
      toast(
        `${result.created ?? 0} starter template(s) created. Edit the wording any time.`,
        "success",
      );
      await load();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Starter templates could not be created.",
        "error",
      );
    } finally {
      setSeeding(false);
    }
  }

  const editingExisting = templates.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="mt-8 rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl tracking-widest">
          <FileText size={20} className="text-brand-green" /> MESSAGE TEMPLATES
        </h2>
        <div className="flex gap-2">
          {missingDefaults > 0 ? (
            <button
              type="button"
              disabled={seeding}
              onClick={() => void seedDefaults()}
              className="rounded-full bg-brand-orange px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50"
            >
              {seeding ? "Creating…" : `Add ${missingDefaults} starter template(s)`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-disabled)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
          >
            <Plus size={12} /> New template
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        The exact wording parents receive, per channel. Use {"{{variables}}"} like{" "}
        {"{{studentName}}"} — a send that is missing a variable fails safely instead of sending a
        half-written message.
      </p>

      {loading ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <LoaderCircle size={16} className="animate-spin" /> Loading templates…
        </p>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <ul className="space-y-2">
            {templates.map((template) => (
              <li
                key={template.id}
                className={`rounded-2xl p-3 text-sm ${
                  selectedId === template.id ? "bg-brand-green/10" : "bg-[var(--surface-disabled)]"
                }`}
              >
                <button type="button" className="w-full text-left" onClick={() => select(template)}>
                  <b>{template.key}</b> · {template.channel} · v{template.version}
                  <span className="block truncate text-xs text-[var(--text-muted)]">
                    {template.subject}
                  </span>
                </button>
                <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span
                    className={template.isActive ? "text-brand-green" : "text-[var(--text-muted)]"}
                  >
                    {template.isActive ? "Active" : "Off"}
                  </span>
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={() => void setActive(template, !template.isActive)}
                  >
                    {template.isActive ? "Switch off" : "Switch on"}
                  </button>
                </div>
              </li>
            ))}
            {!templates.length ? (
              <p className="text-sm text-[var(--text-muted)]">
                No templates yet. Add the starter set above, then tailor the wording.
              </p>
            ) : null}
          </ul>

          <div className="rounded-2xl bg-[var(--surface-disabled)] p-4">
            <div className="grid gap-2 md:grid-cols-3">
              <input
                className={inputClass}
                placeholder="key e.g. fee_reminder"
                value={key}
                disabled={Boolean(editingExisting)}
                onChange={(e) => setKey(e.target.value)}
              />
              <select
                className={inputClass}
                value={kind}
                disabled={Boolean(editingExisting)}
                onChange={(e) => setKind(e.target.value)}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={channel}
                disabled={Boolean(editingExisting)}
                onChange={(e) => setChannel(e.target.value)}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <input
              className={`${inputClass} mt-2`}
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <textarea
              className={`${inputClass} mt-2 min-h-36`}
              placeholder={
                "Message body — e.g. Dear {{parentName}}, {{studentName}} has a balance of {{balance}}…"
              }
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            {editingExisting?.variables.length ? (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Variables: {editingExisting.variables.map((v) => `{{${v}}}`).join(" ")}
              </p>
            ) : null}
            <button
              type="button"
              disabled={saving || !key.trim() || !subject.trim() || !body.trim()}
              onClick={() => void save()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
            >
              <Save size={14} />{" "}
              {saving ? "Saving…" : editingExisting ? "Save new version" : "Create template"}
            </button>
          </div>
        </div>
      )}

      <h3 className="mt-7 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-green">
        <ShieldCheck size={14} /> Communication consent coverage
      </h3>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Recorded opt-ins/opt-outs per channel. Broadcasts only reach people with a recorded opt-in;
        an opt-out here always wins over notification preferences.
      </p>
      {coverage.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {coverage.map((row) => (
            <span
              key={`${row.channel}-${row.kind}-${row.optedIn}`}
              className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
                row.optedIn ? "bg-brand-green/10 text-brand-green" : "bg-red-500/10 text-red-500"
              }`}
            >
              {row.channel} · {row.kind} · {row.optedIn ? "opted in" : "opted out"}: {row.count}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--text-muted)]">No consent decisions recorded yet.</p>
      )}
    </div>
  );
}
