import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { prisma } from "@/lib/prisma";
import { ArrowRight, Calendar } from "lucide-react";

import { AnimatedText } from "@/components/AnimatedText";
export const dynamic = "force-dynamic";

async function loadPosts() {
  try {
    const school = await prisma.school.findFirst({ orderBy: { createdAt: "asc" } });
    if (!school) return [];
    return prisma.newsPost.findMany({
      where: { schoolId: school.id, isPublished: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 40,
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        excerpt: true,
        publishedAt: true,
      },
    });
  } catch {
    return [];
  }
}

export default async function NewsPage() {
  const posts = await loadPosts();

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <Reveal>
          <section className="bg-brand-navy px-6 pb-14 pt-28 text-white">
            <div className="mx-auto max-w-7xl">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
                School journal
              </p>
              <h1 className="mt-3 font-display tracking-widest text-[clamp(3rem,11vw,9.5rem)]">
                <AnimatedText heavy stagger={0.034} text="NEWS &" delay={0.0} />
                <span className="text-brand-green">
                  <AnimatedText heavy stagger={0.034} text="EVENTS" delay={0.15} />
                </span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/65">
                Official updates from Ykay College — published by the school communications team.
              </p>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="mx-auto max-w-7xl px-6 py-12">
            {posts.length ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {posts.map((post) => (
                  <article
                    key={post.id}
                    className="flex flex-col rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-brand-green/40"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-brand-green/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                        {post.category}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                        <Calendar size={12} />
                        {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "—"}
                      </span>
                    </div>
                    <h2 className="font-display text-2xl tracking-wide text-[var(--text-primary)]">
                      <AnimatedText text={post.title} delay={0.0} />
                    </h2>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {post.excerpt}
                    </p>
                    <Link
                      href={`/news-events/${post.slug}`}
                      className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-green"
                    >
                      Read more <ArrowRight size={14} />
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-[var(--border-default)] bg-[var(--surface-card)] p-12 text-center">
                <p className="font-display text-2xl tracking-widest text-[var(--text-primary)]">
                  No published posts yet
                </p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  When the admin team publishes from Post & News, stories appear here automatically.
                </p>
              </div>
            )}
          </section>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
