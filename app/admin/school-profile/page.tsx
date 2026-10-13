"use client";

import { useEffect, useState, type FormEvent } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { useToast } from "@/components/Toast";
import { LoaderCircle, MapPin, Save } from "lucide-react";

type Profile = { name: string; address: string; addressConfirmed: boolean };

export default function SchoolProfilePage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/school-profile", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as Partial<Profile> & {
          error?: string;
        };
        if (!response.ok) throw new Error(body.error || "We could not load the school profile.");
        if (!active) return;
        setProfile(body as Profile);
        setAddress(body.address ?? "");
      })
      .catch((err: unknown) => {
        if (active)
          setError(err instanceof Error ? err.message : "We could not load the school profile.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/school-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const body = (await response.json().catch(() => ({}))) as Partial<Profile> & {
        error?: string;
      };
      if (!response.ok) {
        setError(body.error || "We could not save the address. Please try again.");
        return;
      }
      setProfile((current) => ({
        name: current?.name ?? "",
        address: body.address ?? "",
        addressConfirmed: Boolean(body.addressConfirmed),
      }));
      setAddress(body.address ?? "");
      toast(body.addressConfirmed ? "School address saved." : "School address cleared.", "success");
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PortalTopbar />
      <main className="min-h-screen bg-[var(--bg-primary)] theme-transition">
        <section className="bg-brand-navy px-6 pt-28 pb-14">
          <div className="mx-auto max-w-7xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <MapPin size={11} /> School profile
            </span>
            <h1 className="font-display text-4xl tracking-widest text-white md:text-6xl">
              SCHOOL <span className="text-brand-green">ADDRESS</span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-white/60">
              One address, used on receipts, report cards, ID cards and the public website. Until it
              is set, none of these print an address.
            </p>
          </div>
        </section>

        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
            <AdminSidebar />

            <div className="min-w-0 flex-1 space-y-6">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <LoaderCircle className="animate-spin" size={16} /> Loading…
                </div>
              ) : (
                <form
                  onSubmit={save}
                  className="max-w-2xl space-y-5 rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]"
                >
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{profile?.name}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {profile?.addressConfirmed
                        ? "An address is set and is printed on documents and the public website."
                        : "No address is set. Documents and the public website leave it out."}
                    </p>
                  </div>

                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      Postal address
                    </span>
                    <textarea
                      name="address"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      rows={3}
                      maxLength={300}
                      placeholder="Street, town, state"
                      className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] p-4 text-sm text-[var(--text-primary)]"
                    />
                    <span className="mt-2 block text-xs text-[var(--text-muted)]">
                      Enter the address exactly as the school wants it printed. Leave it empty to
                      clear it.
                    </span>
                  </label>

                  {error && (
                    <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 text-sm font-bold uppercase tracking-widest text-brand-navy disabled:opacity-60"
                  >
                    {saving ? (
                      <LoaderCircle className="animate-spin" size={16} />
                    ) : (
                      <Save size={16} />
                    )}
                    {saving ? "Saving…" : "Save address"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
