"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { HeartPulse, Stethoscope, Plus } from "lucide-react";

type Visit = {
  id: string;
  createdAt: string;
  data: {
    personName: string;
    personType: "STUDENT" | "STAFF";
    complaints: string;
    treatment?: string | null;
    medicationGiven?: string | null;
    referredOut: boolean;
    parentNotified: boolean;
    presentedAt: string;
  };
};
type Alert = { id: string; data: { personName: string; condition: string } };

export default function AdminClinicPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState({ total: 0, today: 0, referred: 0 });
  const [personName, setPersonName] = useState("");
  const [complaints, setComplaints] = useState("");
  const [treatment, setTreatment] = useState("");
  const [medication, setMedication] = useState("");
  const [referred, setReferred] = useState(false);
  const [notified, setNotified] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/clinic", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      setVisits(j.visits || []);
      setAlerts(j.alerts || []);
      setStats(j.stats);
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!personName.trim() || !complaints.trim()) return;
    const r = await fetch("/api/admin/clinic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "VISIT",
        personType: "STUDENT",
        personName: personName.trim(),
        personId: "manual",
        presentedAt: new Date().toISOString(),
        complaints: complaints.trim(),
        treatment: treatment.trim() || null,
        medicationGiven: medication.trim() || null,
        referredOut: referred,
        parentNotified: notified,
      }),
    });
    if (r.ok) {
      setPersonName("");
      setComplaints("");
      setTreatment("");
      setMedication("");
      setReferred(false);
      setNotified(false);
      void load();
    }
  }

  return (
    <>
      <PortalTopbar title="Clinic / Health Records" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              OPERATIONS · MODULE M
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">CLINIC &amp; HEALTH</h1>
            <p className="mt-2 text-sm text-white/60">
              Restricted student health records, first-aid visits and medical alerts. Access is
              audited.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <KPI label="Total visits" value={stats.total} />
            <KPI label="Today" value={stats.today} />
            <KPI label="Referred out" value={stats.referred} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <form
              onSubmit={submit}
              className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6"
            >
              <h2 className="flex items-center gap-2 font-display text-lg tracking-widest">
                <Plus size={18} /> Record visit
              </h2>
              <input
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-2 text-sm"
                placeholder="Student / Staff name"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
              />
              <textarea
                className="h-20 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-2 text-sm"
                placeholder="Complaints presented"
                value={complaints}
                onChange={(e) => setComplaints(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-2 text-sm"
                placeholder="Treatment"
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-2 text-sm"
                placeholder="Medication given"
                value={medication}
                onChange={(e) => setMedication(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={referred}
                  onChange={(e) => setReferred(e.target.checked)}
                />{" "}
                Referred to hospital
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notified}
                  onChange={(e) => setNotified(e.target.checked)}
                />{" "}
                Parent/guardian notified
              </label>
              <button
                type="submit"
                className="rounded-full bg-[var(--accent-primary)] px-5 py-2 text-xs font-bold uppercase tracking-widest text-[var(--bg-primary)]"
              >
                Save visit
              </button>
            </form>

            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-5 py-3">
                  <HeartPulse size={16} className="text-red-500" />
                  <h2 className="font-display text-lg tracking-widest">Medical alerts</h2>
                </div>
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {alerts.length === 0 && (
                    <li className="p-6 text-center text-sm text-[var(--text-muted)]">
                      No alerts recorded.
                    </li>
                  )}
                  {alerts.map((a) => (
                    <li key={a.id} className="flex items-center gap-4 px-5 py-3">
                      <Stethoscope size={16} className="text-red-500" />
                      <p className="min-w-0 flex-1 text-sm">
                        <strong>{a.data.personName}</strong> — {a.data.condition}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
                <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-5 py-3">
                  <Stethoscope size={16} className="text-[var(--accent-primary)]" />
                  <h2 className="font-display text-lg tracking-widest">Recent visits</h2>
                </div>
                <ul className="divide-y divide-[var(--border-subtle)] max-h-[500px] overflow-y-auto">
                  {visits.length === 0 && (
                    <li className="p-6 text-center text-sm text-[var(--text-muted)]">
                      No visits recorded.
                    </li>
                  )}
                  {visits.slice(0, 50).map((v) => (
                    <li key={v.id} className="px-5 py-3">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                        {v.data.personName}
                        {v.data.referredOut && (
                          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-500">
                            Referred
                          </span>
                        )}
                        {v.data.parentNotified && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                            Parent notified
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {new Date(v.data.presentedAt).toLocaleString()}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {v.data.complaints}
                      </p>
                      {v.data.treatment && (
                        <p className="text-xs text-[var(--text-muted)]">
                          <em>Tx:</em> {v.data.treatment}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function KPI({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
      <div className="font-display text-3xl text-[var(--accent-primary)]">{value}</div>
      <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">{label}</div>
    </div>
  );
}
