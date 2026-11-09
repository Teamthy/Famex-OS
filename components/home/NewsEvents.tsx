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

/**
 * Section 11 — the Journal: the school's REAL published calendar and public
 * news posts, server-fetched and revalidated. An unconfigured session renders
 * an honest empty state instead of invented headlines.
 */
export default async function NewsEvents() {
  const calendar = await fetchCalendar();
  const events = (calendar.events ?? []).slice(0, 4);

  return (
    <section id="news" className="home-below-fold mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h2 className={`${SERIF} text-4xl font-semibold tracking-tight sm:text-5xl`}>
          The school <em className="font-light italic text-[#5d8f4e]">journal</em>
        </h2>
        <a
          href="/news-events"
          className="rounded-full border border-[#211d19]/15 bg-white/70 px-5 py-2.5 text-sm font-medium text-[#211d19] transition hover:border-[#211d19]/35"
        >
          All news &amp; events
        </a>
      </div>

      {calendar.session ? (
        <p className="mt-4 text-sm text-[#6b6459]">
          Current session: <span className="font-semibold text-[#211d19]">{calendar.session}</span>
          {(calendar.terms ?? []).length > 0 && (
            <> · {(calendar.terms ?? []).map((term) => term.name).join(" · ")}</>
          )}
        </p>
      ) : null}

      {events.length > 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {events.map((event) => (
            <a
              key={event.id}
              href={`/news-events/${event.slug}`}
              className="rounded-3xl bg-[#fffdf8] p-6 shadow-[0_10px_40px_rgba(33,29,25,0.07)] transition duration-300 hover:-translate-y-1"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8a8175]">
                {event.category}
              </p>
              <h3 className="mt-2 text-base font-semibold text-[#211d19]">{event.title}</h3>
              <p className="mt-2 text-xs text-[#6b6459]">
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
        <p className="mt-8 rounded-3xl border border-dashed border-[#211d19]/20 bg-white/50 p-8 text-center text-sm text-[#6b6459]">
          The session calendar and journal publish here as soon as the academic session is
          configured in the admin area. Nothing is hidden — it simply has not been written yet.
        </p>
      )}
    </section>
  );
}
