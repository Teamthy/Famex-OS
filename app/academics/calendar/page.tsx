import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { AnimatedText } from "@/components/AnimatedText";
import { CalendarDays, Download } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Academic Calendar — Term Dates & Events",
  description:
    "Term dates, mid-term breaks, examination periods and school events for the current academic session.",
};

async function fetchCalendar() {
  try {
    const proto = process.env.NODE_ENV === "production" ? "https" : "http";
    const host = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_SITE_URL || "localhost:3000";
    const r = await fetch(`${proto}://${host}/api/public/calendar`, { next: { revalidate: 600 } });
    if (!r.ok) return { session: null, terms: [], events: [] };
    return (await r.json()) as { session: string | null; terms: any[]; events: any[] };
  } catch {
    return { session: null, terms: [], events: [] };
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "TBC";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function AcademicCalendarPage() {
  const cal = await fetchCalendar();
  return (
    <>
      <Header />
      <main className="theme-transition min-h-screen bg-[var(--bg-primary)]">
        <Reveal>
          <section className="w-full overflow-hidden bg-[var(--bg-primary)] pt-32 pb-12 md:pt-40 md:pb-16">
            <div className="mx-auto max-w-7xl px-6">
              <nav
                aria-label="Breadcrumb"
                className="mb-6 text-xs uppercase tracking-widest text-[var(--text-muted)]"
              >
                <ol className="flex gap-2">
                  <li>
                    <Link href="/academics" className="hover:text-[var(--accent-primary)]">
                      Academics
                    </Link>
                  </li>
                  <li aria-hidden>/</li>
                  <li className="text-[var(--accent-primary)]">Calendar</li>
                </ol>
              </nav>
              <p className="mb-4 font-body text-xs font-bold uppercase tracking-[0.25em] text-[var(--accent-primary)]">
                {cal.session ?? "Current session"}
              </p>
              <AnimatedText
                as="h1"
                heavy
                stagger={0.03}
                className="font-display text-[clamp(2.4rem,8vw,7rem)] leading-[0.86] tracking-[-0.01em] text-[var(--text-primary)] mb-6"
                text="ACADEMIC CALENDAR"
              />
              <p className="max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] md:text-xl">
                Term dates, holidays, exam weeks and school events. Subscribe below to add the
                calendar to your phone so you never miss a resumption or visiting day.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="/api/public/calendar.ics"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-primary)] px-5 py-3 text-xs font-bold uppercase tracking-widest text-[var(--bg-primary)] transition hover:opacity-90"
                >
                  <Download size={14} /> Subscribe (iCal)
                </a>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="w-full bg-[var(--bg-secondary)] py-12 md:py-20">
            <div className="mx-auto max-w-7xl px-6">
              <h2 className="mb-8 font-display text-[28px] tracking-[2px] text-[var(--text-primary)] md:text-[36px]">
                TERMS
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                {cal.terms.length === 0 && (
                  <div className="col-span-full rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-[var(--text-muted)]">
                    Term dates for this session are being finalised by the school administration.
                  </div>
                )}
                {cal.terms.map((t) => (
                  <div
                    key={t.name}
                    className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8"
                  >
                    <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                      <CalendarDays size={22} />
                    </div>
                    <h3 className="font-display text-xl tracking-widest text-[var(--text-primary)]">
                      {t.name}
                    </h3>
                    <p className="mt-3 text-sm text-[var(--text-secondary)]">
                      <span className="block">Resumes: {fmtDate(t.startsAt)}</span>
                      <span className="block">Closes: {fmtDate(t.endsAt)}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="w-full bg-[var(--bg-primary)] py-12 md:py-20">
            <div className="mx-auto max-w-4xl px-6">
              <h2 className="mb-8 font-display text-[28px] tracking-[2px] text-[var(--text-primary)] md:text-[36px]">
                UPCOMING EVENTS
              </h2>
              <ol className="space-y-3">
                {cal.events.length === 0 && (
                  <li className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-[var(--text-muted)]">
                    No public events published yet — check back soon.
                  </li>
                )}
                {cal.events.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5"
                  >
                    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                      <span className="text-xs uppercase">
                        {new Date(e.date).toLocaleString("en-GB", { month: "short" })}
                      </span>
                      <span className="font-display text-xl">{new Date(e.date).getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
                        {e.category}
                      </p>
                      <h3 className="truncate font-display text-lg tracking-wider text-[var(--text-primary)]">
                        {e.title}
                      </h3>
                    </div>
                    <Link
                      href={e.link}
                      className="text-xs font-bold uppercase tracking-widest text-[var(--accent-primary)] hover:opacity-80"
                    >
                      Details →
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
