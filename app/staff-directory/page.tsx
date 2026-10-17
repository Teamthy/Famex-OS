import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { AnimatedText } from "@/components/AnimatedText";
import { Mail, UserRound } from "lucide-react";

export const metadata = {
  title: "Staff Directory — Meet Our Teachers",
  description: "Meet our teaching and leadership team. Subject specialisms and class assignments are listed for each member of staff.",
};

// Server component: renders a fallback list even if JS fails; client can
// hydrate search filters. Kept intentionally dependency-light.
async function fetchStaff() {
  try {
    // Use absolute URL for SSR
    const proto = process.env.NODE_ENV === "production" ? "https" : "http";
    const host = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_SITE_URL || "localhost:3000";
    const r = await fetch(`${proto}://${host}/api/public/staff`, { next: { revalidate: 300 } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.staff as any[]) || [];
  } catch {
    return [];
  }
}

export default async function StaffDirectoryPage() {
  const staff = await fetchStaff();
  return (
    <>
      <Header />
      <main className="theme-transition min-h-screen bg-[var(--bg-primary)]">
        <Reveal>
          <section className="w-full overflow-hidden bg-[var(--bg-primary)] pt-32 pb-12 md:pt-40 md:pb-16">
            <div className="mx-auto max-w-7xl px-6">
              <p className="mb-4 font-body text-xs font-bold uppercase tracking-[0.25em] text-[var(--accent-primary)]">
                OUR PEOPLE
              </p>
              <AnimatedText
                as="h1"
                heavy
                stagger={0.03}
                className="font-display text-[clamp(2.4rem,8vw,7rem)] leading-[0.86] tracking-[-0.01em] text-[var(--text-primary)] mb-6"
                text="STAFF DIRECTORY"
              />
              <p className="max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] md:text-xl">
                Dedicated teachers, subject specialists and support staff. Contact the school office
                to arrange a meeting or speak with a class teacher.
              </p>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="w-full bg-[var(--bg-primary)] py-12 md:py-20">
            <div className="mx-auto max-w-7xl px-6">
              {staff.length === 0 ? (
                <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-center text-[var(--text-muted)]">
                  Staff directory will be published here once the school administrator opts it in.
                </div>
              ) : (
                <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="list">
                  {staff.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)] transition hover:-translate-y-1 hover:border-[var(--accent-primary)]"
                    >
                      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                        {s.photoUrl ? (
                          <img src={s.photoUrl} alt={`${s.name} portrait`} className="h-full w-full rounded-full object-cover" />
                        ) : (
                          <UserRound size={30} aria-hidden />
                        )}
                      </div>
                      <h3 className="font-display text-lg tracking-widest text-[var(--text-primary)]">{s.name}</h3>
                      <p className="mt-1 text-xs uppercase tracking-widest text-[var(--accent-primary)]">{s.title}</p>
                      {s.subjects.length > 0 && (
                        <p className="mt-3 text-sm text-[var(--text-secondary)]">
                          {s.subjects.slice(0, 3).join(" · ")}
                        </p>
                      )}
                      {s.className && (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">Class: {s.className}</p>
                      )}
                      <a
                        href={`/contact?subject=${encodeURIComponent(`Message for ${s.name}`)}`}
                        className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--accent-primary)] hover:opacity-80"
                        aria-label={`Message ${s.name} via the school office`}
                      >
                        <Mail size={14} /> Contact via office
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
