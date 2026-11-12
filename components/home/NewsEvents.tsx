import { ArrowUpRight } from "lucide-react";
import { resolveSiteUrl } from "@/lib/site-url";
import { SERIF } from "./theme";

type PublicCalendar = {
  session?: string | null;
  terms?: { name: string; startsAt: string | null; endsAt: string | null }[];
  events?: { id: string; title: string; slug: string; publishedAt: string; category: string }[];
};

async function fetchCalendar(): Promise<PublicCalendar> {
  try {
    const base = resolveSiteUrl() || "http://localhost:3000";
    const response = await fetch(`${base}/api/public/calendar`, { next: { revalidate: 600 } });
    if (!response.ok) return {};
    return (await response.json()) as PublicCalendar;
  } catch {
    return {};
  }
}

/** Public journal and event cards, sourced only from published school calendar data. */
export default async function NewsEvents() {
  const calendar = await fetchCalendar();
  const events = (calendar.events ?? []).slice(0, 4);
  return (
    <section
      id="news"
      className="home-below-fold mx-auto max-w-[1320px] px-5 pb-16 sm:px-8 sm:pb-24 lg:px-12"
    >
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[var(--home-dark-soft)]">
            Notes from school
          </p>
          <h2
            className={`${SERIF} text-[clamp(2.7rem,5vw,4.6rem)] uppercase leading-[.9] text-[var(--home-dark)]`}
          >
            The school journal
          </h2>
        </div>
        <a
          href="/news-events"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--home-line)] bg-white px-5 py-3 text-xs font-bold text-[var(--home-dark)] transition hover:bg-[var(--home-dark)] hover:text-white"
        >
          All news &amp; events <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
      {calendar.session ? (
        <p className="mt-4 text-xs text-[var(--home-muted)]">
          Current session:{" "}
          <span className="font-bold text-[var(--home-dark)]">{calendar.session}</span>
          {(calendar.terms ?? []).length > 0 && (
            <> · {(calendar.terms ?? []).map((term) => term.name).join(" · ")}</>
          )}
        </p>
      ) : null}
      {events.length ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {events.map((event, i) => (
            <a
              key={event.id}
              href={`/news-events/${event.slug}`}
              className={`group flex min-h-[220px] flex-col rounded-[21px] p-5 transition hover:-translate-y-1 ${i === 1 ? "bg-[var(--home-lime)]" : "bg-white shadow-[0_8px_30px_rgba(8,45,32,.06)]"}`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[var(--home-dark)]/[.07] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-[var(--home-dark)]">
                  {event.category}
                </span>
                <ArrowUpRight
                  className="h-4 w-4 text-[var(--home-dark)] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </div>
              <h3
                className={`${SERIF} mt-6 text-[1.5rem] uppercase leading-[.98] text-[var(--home-dark)]`}
              >
                {event.title}
              </h3>
              <p className="mt-auto pt-5 text-[10px] font-semibold uppercase tracking-wider text-[var(--home-muted)]">
                {new Date(event.publishedAt).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </a>
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-[21px] border border-dashed border-[var(--home-line)] bg-white/60 p-8 text-center text-sm leading-6 text-[var(--home-muted)]">
          The school journal and session calendar will appear here when published by the school.
        </p>
      )}
    </section>
  );
}
