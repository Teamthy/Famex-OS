import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { resolveSchoolForRequest } from "@/lib/school-resolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public academic calendar as an iCal feed (the "Subscribe (iCal)" link on
 * /academics/calendar). Same public data as /api/public/calendar — term
 * windows plus published news/events — rendered as all-day VEVENTs so
 * parents can subscribe from Google/Apple Calendar. No private scheduling
 * is ever exposed here.
 */

type IcsTerm = { label: string; startsOn: Date | null; endsOn: Date | null };
type IcsEvent = { id: string; title: string; publishedAt: Date | null; slug: string };

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function formatIcsDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatIcsTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * Build the VCALENDAR document. Pure so tests can pin the format: all-day
 * DTEND is exclusive in iCalendar, so a term ending 12 Dec emits DTEND
 * 13 Dec or every calendar app shows it finishing a day early.
 */
export function buildICalendar(input: {
  calName: string;
  sessionLabel: string;
  terms: IcsTerm[];
  events: IcsEvent[];
  now?: Date;
}): string {
  const stamp = formatIcsTimestamp(input.now ?? new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Famex OS//Public Academic Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(input.calName)}`,
  ];

  for (const term of input.terms) {
    if (!term.startsOn || !term.endsOn) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:term-${term.label.replace(/\s+/g, "-").toLowerCase()}-${input.sessionLabel.replace(/\s+/g, "-")}@famex-os`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${formatIcsDate(term.startsOn)}`,
      `DTEND;VALUE=DATE:${formatIcsDate(addUtcDays(term.endsOn, 1))}`,
      `SUMMARY:${escapeIcsText(`${term.label} (${input.sessionLabel})`)}`,
      "END:VEVENT",
    );
  }

  for (const event of input.events) {
    if (!event.publishedAt) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:event-${event.id}@famex-os`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${formatIcsDate(event.publishedAt)}`,
      `DTEND;VALUE=DATE:${formatIcsDate(addUtcDays(event.publishedAt, 1))}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `URL:/news-events/${event.slug}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export async function GET() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const resolved = await resolveSchoolForRequest(host);
  const calName = resolved.school?.name ?? "Famex International Schools";

  let sessionLabel = "";
  let terms: IcsTerm[] = [];
  let events: IcsEvent[] = [];

  if (resolved.school) {
    const currentSession = await prisma.academicSession.findFirst({
      where: { schoolId: resolved.school.id, isCurrent: true },
      select: { id: true, label: true },
    });
    if (currentSession) {
      sessionLabel = currentSession.label;
      terms = await prisma.term.findMany({
        where: { sessionId: currentSession.id },
        select: { label: true, startsOn: true, endsOn: true },
        orderBy: { index: "asc" },
      });
      events = await prisma.newsPost.findMany({
        where: {
          schoolId: resolved.school.id,
          isPublished: true,
          publishedAt: {
            gte: terms[0]?.startsOn ?? new Date(Date.now() - 30 * 86400_000),
            lte: terms[terms.length - 1]?.endsOn ?? new Date(Date.now() + 365 * 86400_000),
          },
        },
        select: { id: true, title: true, slug: true, publishedAt: true },
        orderBy: { publishedAt: "asc" },
        take: 200,
      });
    }
  }

  const calendar = buildICalendar({ calName, sessionLabel, terms, events });
  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="academic-calendar.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
