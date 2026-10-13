"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PortalTopbar from "@/components/PortalTopbar";
import {
  LoaderCircle,
  Users,
  GraduationCap,
  School,
  BookOpen,
  Globe,
  ArrowLeft,
} from "lucide-react";

type SchoolRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  email: string | null;
  phone: string;
  address: string;
  customDomain: string | null;
  createdAt: string;
  students: number;
  users: number;
  teachers: number;
  classes: number;
};

export default function SuperAdminSchoolsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/super-admin/schools", { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Unable to load schools.");
        setSchools(j.schools || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load schools.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totals = schools.reduce(
    (acc, s) => ({
      students: acc.students + s.students,
      teachers: acc.teachers + s.teachers,
      users: acc.users + s.users,
      classes: acc.classes + s.classes,
    }),
    { students: 0, teachers: 0, users: 0, classes: 0 },
  );

  return (
    <>
      <PortalTopbar title="Schools overview" />
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
          <Link
            href="/super-admin/portals"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-green"
          >
            <ArrowLeft size={12} /> Portal Hub
          </Link>
          <h1 className="font-display text-4xl tracking-widest">
            SCHOOLS <span className="text-brand-green">OVERVIEW</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/65">
            Multi-tenant visibility — every school on the platform with live student, staff, and
            class counts.
          </p>
        </div>

        {/* Platform totals */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Schools", value: schools.length, icon: School, color: "text-brand-green" },
            {
              label: "Students",
              value: totals.students,
              icon: GraduationCap,
              color: "text-brand-orange",
            },
            { label: "Staff", value: totals.teachers, icon: Users, color: "text-blue-500" },
            { label: "Classes", value: totals.classes, icon: BookOpen, color: "text-brand-green" },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5"
            >
              <c.icon className={`mb-2 ${c.color}`} size={18} />
              <div className="font-display text-2xl">{c.value}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                {c.label}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* School cards */}
        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 p-10 text-[var(--text-muted)]">
              <LoaderCircle className="animate-spin" size={18} /> Loading schools…
            </div>
          ) : (
            schools.map((s) => (
              <div
                key={s.id}
                className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-navy text-brand-green">
                      <School size={22} />
                    </span>
                    <div>
                      <h2 className="font-display text-xl tracking-wide">{s.name}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                        <span className="font-mono">{s.slug}</span>
                        {s.customDomain && (
                          <span className="inline-flex items-center gap-1">
                            <Globe size={11} /> {s.customDomain}
                          </span>
                        )}
                        <span>{s.address}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${s.status === "ACTIVE" ? "bg-brand-green/15 text-brand-green" : "bg-brand-orange/15 text-brand-orange"}`}
                    >
                      {s.status}
                    </span>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Students", value: s.students, icon: GraduationCap },
                    { label: "Staff", value: s.teachers, icon: Users },
                    { label: "Users", value: s.users, icon: Users },
                    { label: "Classes", value: s.classes, icon: BookOpen },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-xl bg-[var(--surface-disabled)] p-3 text-center"
                    >
                      <m.icon size={14} className="mx-auto mb-1 text-brand-green" />
                      <div className="font-display text-lg">{m.value}</div>
                      <div className="text-[9px] uppercase tracking-widest text-[var(--text-muted)]">
                        {m.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          {!loading && !schools.length && (
            <p className="p-10 text-center text-sm text-[var(--text-muted)]">No schools found.</p>
          )}
        </div>
      </main>
    </>
  );
}
