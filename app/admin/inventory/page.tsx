"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { Boxes, Package, Plus } from "lucide-react";

type Asset = {
  id: string;
  data: {
    name: string;
    category?: string | null;
    code?: string | null;
    location?: string | null;
    assignedTo?: string | null;
    condition: "GOOD" | "FAIR" | "DAMAGED" | "DISPOSED";
    valueNaira: number;
  };
};

export default function AdminInventoryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    totalValue: 0,
    byCondition: { GOOD: 0, FAIR: 0, DAMAGED: 0, DISPOSED: 0 },
  });
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [code, setCode] = useState("");
  const [location, setLocation] = useState("");
  const [value, setValue] = useState(0);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/inventory", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      setAssets(j.assets || []);
      setStats(j.stats);
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const r = await fetch("/api/admin/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "ASSET",
        name: name.trim(),
        category: category.trim() || null,
        code: code.trim() || null,
        location: location.trim() || null,
        valueNaira: value,
      }),
    });
    if (r.ok) {
      setName("");
      setCategory("");
      setCode("");
      setLocation("");
      setValue(0);
      void load();
    }
  }

  return (
    <>
      <PortalTopbar title="Inventory & Assets" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              OPERATIONS · MODULE M
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">INVENTORY &amp; ASSETS</h1>
            <p className="mt-2 text-sm text-white/60">
              Track school property, assignment and condition.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            <Stat label="Assets" value={stats.total} />
            <Stat label="Good" value={stats.byCondition.GOOD} />
            <Stat label="Fair" value={stats.byCondition.FAIR} />
            <Stat label="Damaged" value={stats.byCondition.DAMAGED} />
            <Stat label="Value (₦)" value={stats.totalValue.toLocaleString()} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <form
              onSubmit={submit}
              className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6"
            >
              <h2 className="flex items-center gap-2 font-display text-lg tracking-widest">
                <Plus size={18} /> Add asset
              </h2>
              <input
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-2 text-sm"
                placeholder="Name (e.g. Dell Optiplex 3080)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-2 text-sm"
                placeholder="Category (ICT, Furniture…)"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <div className="flex gap-3">
                <input
                  className="w-1/2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-2 text-sm"
                  placeholder="Asset code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <input
                  className="w-1/2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-2 text-sm"
                  placeholder="Location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <input
                type="number"
                min={0}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-2 text-sm"
                placeholder="Value (₦)"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
              />
              <button
                type="submit"
                className="rounded-full bg-[var(--accent-primary)] px-5 py-2 text-xs font-bold uppercase tracking-widest text-[var(--bg-primary)]"
              >
                Add asset
              </button>
            </form>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] lg:col-span-2">
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-5 py-3">
                <Boxes size={16} className="text-[var(--accent-primary)]" />
                <h2 className="font-display text-lg tracking-widest">Register</h2>
              </div>
              <ul className="divide-y divide-[var(--border-subtle)] max-h-[600px] overflow-y-auto">
                {assets.length === 0 && (
                  <li className="p-8 text-center text-sm text-[var(--text-muted)]">
                    No assets yet.
                  </li>
                )}
                {assets.map((a) => (
                  <li key={a.id} className="flex items-center gap-4 px-5 py-3">
                    <Package size={18} className="text-[var(--accent-primary)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{a.data.name}</p>
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        {a.data.category ?? "General"} · {a.data.location ?? "Unassigned"}
                        {a.data.code ? ` · ${a.data.code}` : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                        a.data.condition === "GOOD"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : a.data.condition === "FAIR"
                            ? "bg-yellow-500/15 text-yellow-600"
                            : a.data.condition === "DAMAGED"
                              ? "bg-red-500/15 text-red-500"
                              : "bg-gray-500/15 text-gray-400"
                      }`}
                    >
                      {a.data.condition}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      ₦{(a.data.valueNaira || 0).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
      <div className="font-display text-3xl text-[var(--accent-primary)]">{value}</div>
      <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">{label}</div>
    </div>
  );
}
