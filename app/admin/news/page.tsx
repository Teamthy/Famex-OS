"use client";

import { useCallback, useEffect, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import AdminSidebar from "@/components/AdminSidebar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  Megaphone,
  PlusCircle,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { NewsAudience } from "@prisma/client";

type Post = {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string;
  isPublished: boolean;
  publishedAt: string | null;
  authorName: string;
  createdAt: string;
  audience: NewsAudience;
  audienceLabel: string;
  targetClassName: string | null;
  recipientCount: number;
};

type AudienceParent = {
  id: string;
  displayName: string;
  students: { displayName: string; className: string }[];
};

type AudienceClass = { id: string; displayName: string };

const CATEGORIES = [
  "News",
  "Events",
  "Achievements",
  "IT Education",
  "Admissions",
  "Announcements",
];

export default function AdminNewsPage() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [form, setForm] = useState({ title: "", category: "News", excerpt: "", content: "" });
  const [audience, setAudience] = useState<NewsAudience>(NewsAudience.PUBLIC);
  const [targetClassId, setTargetClassId] = useState("");
  const [parentQuery, setParentQuery] = useState("");
  const [classes, setClasses] = useState<AudienceClass[]>([]);
  const [parentResults, setParentResults] = useState<AudienceParent[]>([]);
  const [selectedParents, setSelectedParents] = useState<Map<string, AudienceParent>>(new Map());
  const [audienceLoading, setAudienceLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/news", { cache: "no-store" });
      const body = (await response.json()) as { posts: Post[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load posts.");
      setPosts(body.posts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load posts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (audience === NewsAudience.PUBLIC) return;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setAudienceLoading(true);
        try {
          const params = new URLSearchParams();
          if (parentQuery.trim().length >= 2) params.set("q", parentQuery.trim());
          const response = await fetch(`/api/admin/news/audiences?${params.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const body = (await response.json()) as {
            classes: AudienceClass[];
            parents: AudienceParent[];
            error?: string;
          };
          if (!response.ok) throw new Error(body.error || "Could not load publication recipients.");
          setClasses(body.classes);
          setParentResults(body.parents);
        } catch (audienceError) {
          if (!controller.signal.aborted) {
            toast(
              audienceError instanceof Error ? audienceError.message : "Could not load recipients.",
              "error",
            );
          }
        } finally {
          if (!controller.signal.aborted) setAudienceLoading(false);
        }
      },
      parentQuery.trim().length >= 2 ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [audience, parentQuery, toast]);

  async function createPost(publish: boolean) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          publish,
          audience,
          targetClassId: audience === NewsAudience.CLASS_PARENTS ? targetClassId : null,
          parentProfileIds: Array.from(selectedParents.keys()),
        }),
      });
      const body = (await response.json()) as {
        message?: string;
        error?: string;
        recipientCount?: number;
        whatsappQueued?: number;
        whatsappTemplateConfigured?: boolean;
      };
      if (!response.ok) throw new Error(body.error || "Unable to save post.");
      const resultMessage =
        publish && audience !== NewsAudience.PUBLIC
          ? `${body.message || "Published."} Portal access: ${body.recipientCount ?? 0} parent(s). WhatsApp queued: ${body.whatsappQueued ?? 0}${body.whatsappTemplateConfigured ? "." : "; configure the approved Meta publication template to enable WhatsApp."}`
          : body.message || "Saved.";
      toast(resultMessage, "success");
      setForm({ title: "", category: "News", excerpt: "", content: "" });
      setAudience(NewsAudience.PUBLIC);
      setTargetClassId("");
      setParentQuery("");
      setParentResults([]);
      setSelectedParents(new Map());
      setShowForm(false);
      await load();
    } catch (createError) {
      toast(createError instanceof Error ? createError.message : "Unable to save post.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function act(post: Post, action: "PUBLISH" | "UNPUBLISH" | "DELETE") {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/news", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, action }),
      });
      const body = (await response.json()) as {
        message?: string;
        error?: string;
        recipientCount?: number;
        whatsappQueued?: number;
        whatsappTemplateConfigured?: boolean;
      };
      if (!response.ok) throw new Error(body.error || "Action failed.");
      const deliverySummary =
        action === "PUBLISH" && post.audience !== NewsAudience.PUBLIC
          ? ` Portal access: ${body.recipientCount ?? 0} parent(s). WhatsApp queued: ${body.whatsappQueued ?? 0}${body.whatsappTemplateConfigured ? "." : "; configure the approved Meta publication template to enable WhatsApp."}`
          : "";
      toast(`${body.message || "Done."}${deliverySummary}`, "success");
      await load();
    } catch (actError) {
      toast(actError instanceof Error ? actError.message : "Action failed.", "error");
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-famex-lime/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <Megaphone size={11} /> Post &amp; News
            </span>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              NEWS <span className="text-brand-green">PUBLISHER</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/85">
              Write, publish, and manage school news, events, and announcements.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <AdminSidebar />

            <div className="min-w-0 flex-1 space-y-6">
              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                  {error}
                </div>
              ) : null}

              <button
                onClick={() => setShowForm(!showForm)}
                className="inline-flex items-center gap-2 rounded-full bg-famex-lime px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg"
              >
                <PlusCircle size={15} /> {showForm ? "Hide Editor" : "New Post"}
              </button>

              {showForm ? (
                <div className="space-y-5 rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]">
                  <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      Title
                      <input
                        value={form.title}
                        onChange={(event) => setForm({ ...form, title: event.target.value })}
                        placeholder="e.g. FIS Students Shine at Regional IT Bootcamp"
                        className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)]"
                      />
                    </label>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      Category
                      <select
                        value={form.category}
                        onChange={(event) => setForm({ ...form, category: event.target.value })}
                        className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)]"
                      >
                        {CATEGORIES.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      Audience
                      <select
                        value={audience}
                        onChange={(event) => setAudience(event.target.value as NewsAudience)}
                        className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm normal-case tracking-normal text-[var(--input-text)]"
                      >
                        <option value={NewsAudience.PUBLIC}>Public website</option>
                        <option value={NewsAudience.ALL_PARENTS}>All parents</option>
                        <option value={NewsAudience.CLASS_PARENTS}>Parents of one class</option>
                        <option value={NewsAudience.SELECTED_PARENTS}>Selected parents</option>
                      </select>
                    </label>
                    {audience === NewsAudience.CLASS_PARENTS ? (
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        Class
                        <select
                          value={targetClassId}
                          onChange={(event) => setTargetClassId(event.target.value)}
                          className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm normal-case tracking-normal text-[var(--input-text)]"
                        >
                          <option value="">Choose a class…</option>
                          {classes.map((classroom) => (
                            <option key={classroom.id} value={classroom.id}>
                              {classroom.displayName}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>

                  {audience === NewsAudience.SELECTED_PARENTS ? (
                    <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
                      <label
                        className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]"
                        htmlFor="publication-parent-search"
                      >
                        Find parents by name
                        <span className="relative mt-2 block">
                          <Search
                            size={15}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                          />
                          <input
                            id="publication-parent-search"
                            value={parentQuery}
                            onChange={(event) => setParentQuery(event.target.value)}
                            placeholder="Type at least two characters"
                            className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] py-3 pl-10 pr-4 text-sm normal-case tracking-normal text-[var(--input-text)]"
                          />
                        </span>
                      </label>
                      <p className="text-xs text-[var(--text-muted)]">
                        {selectedParents.size} parent(s) selected. Choose only families this notice
                        is intended for.
                      </p>
                      {audienceLoading ? (
                        <p className="text-xs text-[var(--text-muted)]">Searching parents…</p>
                      ) : null}
                      {parentQuery.trim().length >= 2 && !audienceLoading ? (
                        <div className="max-h-56 space-y-1 overflow-y-auto">
                          {parentResults.map((parent) => {
                            const checked = selectedParents.has(parent.id);
                            const children = parent.students
                              .map((student) => `${student.displayName} · ${student.className}`)
                              .join(", ");
                            return (
                              <label
                                key={parent.id}
                                className="flex cursor-pointer items-start gap-3 rounded-xl p-3 text-sm hover:bg-[var(--surface-card)]"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setSelectedParents((current) => {
                                      const next = new Map(current);
                                      if (checked) next.delete(parent.id);
                                      else next.set(parent.id, parent);
                                      return next;
                                    });
                                  }}
                                  className="mt-1 accent-[var(--famex-lime)]"
                                />
                                <span className="min-w-0">
                                  <span className="block font-semibold text-[var(--text-primary)]">
                                    {parent.displayName}
                                  </span>
                                  {children ? (
                                    <span className="block text-xs text-[var(--text-muted)]">
                                      {children}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            );
                          })}
                          {parentResults.length === 0 ? (
                            <p className="p-3 text-xs text-[var(--text-muted)]">
                              No matching active parent profiles.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {selectedParents.size ? (
                        <ul className="flex flex-wrap gap-2" aria-label="Selected parents">
                          {Array.from(selectedParents.values()).map((parent) => (
                            <li
                              key={parent.id}
                              className="inline-flex items-center gap-1 rounded-full bg-famex-lime/15 px-3 py-1 text-xs text-[var(--text-primary)]"
                            >
                              {parent.displayName}
                              <button
                                type="button"
                                aria-label={`Remove ${parent.displayName}`}
                                onClick={() =>
                                  setSelectedParents((current) => {
                                    const next = new Map(current);
                                    next.delete(parent.id);
                                    return next;
                                  })
                                }
                                className="rounded-full p-1 hover:bg-red-500/10"
                              >
                                <X size={12} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  {audience !== NewsAudience.PUBLIC ? (
                    <p className="rounded-xl bg-brand-orange/10 p-3 text-xs leading-5 text-[var(--text-secondary)]">
                      Targeted posts are private to the selected parent accounts. WhatsApp delivery
                      is queued only for parents with explicit broadcast consent and an approved
                      Meta publication template; portal access is retained even if WhatsApp is not
                      configured.
                    </p>
                  ) : null}

                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Excerpt (shown on the news list)
                    <textarea
                      value={form.excerpt}
                      onChange={(event) => setForm({ ...form, excerpt: event.target.value })}
                      rows={2}
                      className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--input-text)]"
                    />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Full content
                    <textarea
                      value={form.content}
                      onChange={(event) => setForm({ ...form, content: event.target.value })}
                      rows={10}
                      className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm leading-7 text-[var(--input-text)]"
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => void createPost(true)}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-full bg-famex-lime px-8 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-lg disabled:opacity-50"
                    >
                      {busy ? (
                        <LoaderCircle size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}{" "}
                      Publish Now
                    </button>
                    <button
                      onClick={() => void createPost(false)}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-8 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
                    >
                      Save Draft
                    </button>
                  </div>
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <LoaderCircle className="animate-spin text-brand-green" size={20} /> Loading
                    posts...
                  </div>
                </div>
              ) : null}

              {!loading ? (
                <div className="space-y-3">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-xl text-[var(--text-primary)]">
                              {post.title}
                            </h3>
                            <span className="rounded-full bg-famex-lime/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-brand-green">
                              {post.category}
                            </span>
                            <span className="rounded-full bg-[var(--bg-primary)] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                              {post.audienceLabel}
                              {post.targetClassName
                                ? ` · ${post.targetClassName}`
                                : post.audience !== NewsAudience.PUBLIC
                                  ? ` · ${post.recipientCount} recipients`
                                  : ""}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${post.isPublished ? "bg-famex-lime/10 text-brand-green" : "bg-brand-orange/10 text-brand-orange"}`}
                            >
                              {post.isPublished ? "Published" : "Draft"}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm text-[var(--text-secondary)]">
                            {post.excerpt}
                          </p>
                          <div className="mt-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                            By {post.authorName} · {new Date(post.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {post.isPublished ? (
                            <button
                              onClick={() => void act(post, "UNPUBLISH")}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
                            >
                              <EyeOff size={12} /> Unpublish
                            </button>
                          ) : (
                            <button
                              onClick={() => void act(post, "PUBLISH")}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-full bg-famex-lime px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-navy disabled:opacity-50"
                            >
                              <Eye size={12} /> Publish
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(post)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!posts.length ? (
                    <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-center shadow-[var(--card-shadow)]">
                      <Megaphone className="mx-auto mb-3 text-[var(--text-muted)]" size={30} />
                      <p className="text-sm text-[var(--text-muted)]">
                        No posts yet. Write your first news post above.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this post?"
        message={`"${deleteTarget?.title}" will be permanently removed.`}
        confirmText="Delete Post"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => deleteTarget && void act(deleteTarget, "DELETE")}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
