"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { BookOpen, Library, Plus, RotateCw } from "lucide-react";

type Book = {
  id: string;
  createdAt: string;
  data: { title: string; author: string; isbn?: string | null; category?: string | null; copiesTotal: number; shelfLocation?: string | null };
};
type Loan = {
  id: string;
  createdAt: string;
  data: { bookId: string; borrowerName: string; borrowerType: "STUDENT" | "STAFF"; dueDate: string; returnedAt?: string | null };
};

export default function AdminLibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [stats, setStats] = useState({ titles: 0, totalCopies: 0, outLoans: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [copies, setCopies] = useState(1);
  const [shelf, setShelf] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/library", { cache: "no-store" });
      const j = await r.json();
      if (r.ok) {
        setBooks(j.books || []);
        setLoans(j.loans || []);
        setStats(j.stats);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void load(), [load]);

  async function addBook(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !author.trim()) return;
    const r = await fetch("/api/admin/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "BOOK", title: title.trim(), author: author.trim(), copiesTotal: copies, shelfLocation: shelf.trim() || null }),
    });
    if (r.ok) {
      setTitle(""); setAuthor(""); setCopies(1); setShelf("");
      void load();
    }
  }

  async function markReturned(loanId: string) {
    const r = await fetch("/api/admin/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "RETURN", loanId }),
    });
    if (r.ok) void load();
  }

  return (
    <>
      <PortalTopbar title="Library" />
      <main className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[2rem] bg-brand-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">OPERATIONS · MODULE M</p>
            <h1 className="mt-2 font-display text-4xl tracking-widest">LIBRARY CATALOGUE</h1>
            <p className="mt-2 text-sm text-white/60">Books, copies, loans and overdue tracking.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Titles", value: stats.titles },
              { label: "Total copies", value: stats.totalCopies },
              { label: "Out on loan", value: stats.outLoans },
              { label: "Overdue", value: stats.overdue },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
                <div className="font-display text-3xl text-[var(--accent-primary)]">{s.value}</div>
                <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <form onSubmit={addBook} className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
              <h2 className="flex items-center gap-2 font-display text-lg tracking-widest"><Plus size={18} /> Add a book</h2>
              <input className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-2 text-sm" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <input className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-2 text-sm" placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
              <div className="flex gap-3">
                <input type="number" min={1} className="w-24 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-2 text-sm" value={copies} onChange={(e) => setCopies(Number(e.target.value))} />
                <input className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-2 text-sm" placeholder="Shelf location" value={shelf} onChange={(e) => setShelf(e.target.value)} />
              </div>
              <button type="submit" className="rounded-full bg-[var(--accent-primary)] px-5 py-2 text-xs font-bold uppercase tracking-widest text-[var(--bg-primary)]">Add book</button>
            </form>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] lg:col-span-2">
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-5 py-3">
                <BookOpen size={16} className="text-[var(--accent-primary)]" />
                <h2 className="font-display text-lg tracking-widest">Catalogue</h2>
                <button onClick={load} className="ml-auto text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--accent-primary)]"><RotateCw size={14} className="inline" /> Refresh</button>
              </div>
              <ul className="divide-y divide-[var(--border-subtle)]">
                {loading && <li className="p-5 text-sm text-[var(--text-muted)]">Loading…</li>}
                {!loading && books.length === 0 && <li className="p-8 text-center text-sm text-[var(--text-muted)]">No books yet. Add your first title.</li>}
                {books.map((b) => (
                  <li key={b.id} className="flex items-center gap-4 px-5 py-3">
                    <Library size={18} className="text-[var(--accent-primary)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{b.data.title}</p>
                      <p className="truncate text-xs text-[var(--text-muted)]">{b.data.author}{b.data.shelfLocation ? ` · ${b.data.shelfLocation}` : ""}</p>
                    </div>
                    <span className="text-xs uppercase tracking-widest text-[var(--text-muted)]">×{b.data.copiesTotal}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
            <div className="border-b border-[var(--border-subtle)] px-5 py-3">
              <h2 className="font-display text-lg tracking-widest">Active loans</h2>
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {loans.filter((l) => !l.data.returnedAt).length === 0 && <li className="p-8 text-center text-sm text-[var(--text-muted)]">No active loans.</li>}
              {loans.filter((l) => !l.data.returnedAt).map((l) => {
                const book = books.find((b) => b.id === l.data.bookId);
                const overdue = new Date(l.data.dueDate) < new Date();
                return (
                  <li key={l.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{book?.data.title ?? "(deleted book)"}</p>
                      <p className="text-xs text-[var(--text-muted)]">{l.data.borrowerName} · due {new Date(l.data.dueDate).toLocaleDateString()}</p>
                    </div>
                    {overdue && <span className="rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-red-500">Overdue</span>}
                    <button onClick={() => markReturned(l.id)} className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs font-bold uppercase tracking-widest hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]">Return</button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
