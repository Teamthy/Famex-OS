"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

const SEARCHABLE = [
  { title: "Homepage", desc: "Ykay College main page", url: "/", type: "Page" },
  { title: "About Us", desc: "School history and vision", url: "/about", type: "Page" },
  {
    title: "Director's Message",
    desc: "From Mr. Adeyinka Oladimeji",
    url: "/director",
    type: "Page",
  },
  { title: "Academics", desc: "JSS and SS programmes", url: "/academics", type: "Page" },
  { title: "Admissions", desc: "Apply online", url: "/admissions", type: "Page" },
  { title: "Campus Life", desc: "Clubs and activities", url: "/campus-life", type: "Page" },
  { title: "Gallery", desc: "School photos", url: "/gallery", type: "Page" },
  { title: "Contact", desc: "Get in touch", url: "/contact", type: "Page" },
  { title: "Portal Hub", desc: "All portals", url: "/portal", type: "Page" },
  { title: "Admin Dashboard", desc: "School administration", url: "/admin", type: "Portal" },
  { title: "Teacher Dashboard", desc: "Teacher portal", url: "/teacher/dashboard", type: "Portal" },
  { title: "Student Dashboard", desc: "Student portal", url: "/student/dashboard", type: "Portal" },
  { title: "Parent Dashboard", desc: "Parent portal", url: "/parent/dashboard", type: "Portal" },
  { title: "CBT Exams", desc: "Take online exams", url: "/student/exams", type: "Feature" },
  { title: "Fee Management", desc: "Admin fees", url: "/admin/fees", type: "Feature" },
  { title: "Report Cards", desc: "Term reports", url: "/parent/report-cards", type: "Feature" },
  { title: "Attendance", desc: "Student attendance", url: "/student/attendance", type: "Feature" },
  { title: "FAQ", desc: "Frequently asked questions", url: "/faq", type: "Page" },
  { title: "Alumni", desc: "Alumni network", url: "/alumni", type: "Page" },
  { title: "Careers", desc: "Job openings", url: "/careers", type: "Page" },
  { title: "Testimonials", desc: "Parent & student stories", url: "/testimonials", type: "Page" },
];

export default function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const filtered = query
    ? SEARCHABLE.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.desc.toLowerCase().includes(query.toLowerCase()),
      )
    : SEARCHABLE.slice(0, 6);

  const handleSelect = (url: string) => {
    setOpen(false);
    setQuery("");
    router.push(url);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-full text-[var(--nav-text)] hover:bg-[var(--surface-card-hover)] hover:text-brand-green transition-all"
        title="Search (Cmd+K)"
      >
        <Search size={18} />
      </button>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-[9999] flex items-start justify-center pt-24 px-6"
          onClick={() => setOpen(false)}
        >
          {/* SOLID BACKDROP — blocks everything underneath */}
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md" />

          {/* Modal — on top of backdrop */}
          <div
            className="relative w-full max-w-2xl bg-brand-navy border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ zIndex: 10000, animation: "scaleIn 0.25s ease-out both" }}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-brand-navy">
              <Search size={18} className="text-brand-green shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages, portals, features..."
                className="flex-1 bg-transparent outline-none text-white placeholder:text-white/50 text-base"
              />
              <button
                onClick={() => setOpen(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Results — SOLID background */}
            <div className="max-h-[400px] overflow-y-auto bg-brand-navy p-2">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <button
                    key={item.url}
                    onClick={() => handleSelect(item.url)}
                    className="w-full text-left p-3 rounded-lg hover:bg-brand-green/10 transition-colors group flex items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white group-hover:text-brand-green transition-colors">
                        {item.title}
                      </div>
                      <div className="text-xs text-white/60 mt-0.5">{item.desc}</div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 uppercase tracking-wider font-bold shrink-0">
                      {item.type}
                    </span>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-white/60">
                  No results found for &ldquo;{query}&rdquo;
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/10 text-[10px] text-white/60 flex justify-between items-center bg-brand-navy">
              <span>Search anything on Ykay College</span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-mono">⌘</kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-mono">K</kbd>
                <span className="ml-1">to open</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
