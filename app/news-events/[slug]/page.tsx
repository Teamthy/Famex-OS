import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const school = await prisma.school.findFirst({ orderBy: { createdAt: "asc" } });
  if (!school) notFound();

  const post = await prisma.newsPost.findFirst({
    where: { schoolId: school.id, slug, isPublished: true },
  });
  if (!post) notFound();

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[var(--bg-primary)]">
        <article className="mx-auto max-w-3xl px-6 pb-20 pt-28">
          <Link
            href="/news-events"
            className="inline-flex items-center gap-2 text-sm font-bold text-brand-green"
          >
            <ArrowLeft size={14} /> Back to news
          </Link>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-widest text-brand-green">
            {post.category}
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-widest text-[var(--text-primary)] md:text-5xl">
            {post.title}
          </h1>
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Calendar size={14} />
            {post.publishedAt ? new Date(post.publishedAt).toLocaleString() : ""}
          </p>
          <p className="mt-6 text-lg text-[var(--text-secondary)]">{post.excerpt}</p>
          <div className="prose prose-slate mt-8 max-w-none whitespace-pre-wrap text-[var(--text-secondary)]">
            {post.content}
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
