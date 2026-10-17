"use client";

import { useEffect, useState, type FormEvent } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import PortalTopbar from "@/components/PortalTopbar";
import { useToast } from "@/components/Toast";
import { LoaderCircle, MapPin, MapPinOff, Navigation, Save } from "lucide-react";

type GeoConfig = {
  enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusM: number;
  configured: boolean;
  minRadiusM: number;
  maxRadiusM: number;
  defaultRadiusM: number;
};

type Profile = {
  name: string;
  address: string;
  addressConfirmed: boolean;
  geo: GeoConfig;
};

export default function SchoolProfilePage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [address, setAddress] = useState("");
  const [geoLat, setGeoLat] = useState<string>("");
  const [geoLng, setGeoLng] = useState<string>("");
  const [geoRadius, setGeoRadius] = useState<number>(100);
  const [geoEnabled, setGeoEnabled] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
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
        const p = body as Profile;
        setProfile(p);
        setAddress(p.address ?? "");
        setGeoLat(p.geo.latitude !== null ? String(p.geo.latitude) : "");
        setGeoLng(p.geo.longitude !== null ? String(p.geo.longitude) : "");
        setGeoRadius(p.geo.radiusM ?? p.geo.defaultRadiusM ?? 100);
        setGeoEnabled(p.geo.enabled ?? false);
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

  function useMyLocation() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoError("Geolocation isn't available on this browser.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLat(pos.coords.latitude.toFixed(6));
        setGeoLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied."
            : "Could not get your location.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const latNum = geoLat.trim() === "" ? null : Number(geoLat);
    const lngNum = geoLng.trim() === "" ? null : Number(geoLng);
    const clearing = latNum === null || lngNum === null;

    const payload: Record<string, unknown> = { address };
    if (clearing) {
      payload.geoLatitude = null;
      payload.geoLongitude = null;
      payload.geoRadiusM = null;
      payload.geoEnabled = false;
    } else {
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        setError("Please enter valid numeric coordinates, or clear both fields.");
        setSaving(false);
        return;
      }
      payload.geoLatitude = latNum;
      payload.geoLongitude = lngNum;
      payload.geoRadiusM = geoRadius;
      payload.geoEnabled = geoEnabled;
    }

    try {
      const response = await fetch("/api/admin/school-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as Partial<Profile> & {
        error?: string;
      };
      if (!response.ok) {
        setError(body.error || "We could not save the profile. Please try again.");
        return;
      }
      setProfile((current) => ({
        name: current?.name ?? "",
        address: body.address ?? current?.address ?? "",
        addressConfirmed: Boolean(body.addressConfirmed),
        geo: body.geo ?? current?.geo ?? ({} as GeoConfig),
      }));
      toast("School profile saved.", "success");
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
                  className="max-w-3xl space-y-8 rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 shadow-[var(--card-shadow)]"
                >
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{profile?.name}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {profile?.addressConfirmed
                        ? "An address is set and is printed on documents and the public website."
                        : "No address is set. Documents and the public website leave it out."}
                    </p>
                  </div>

                  <section className="space-y-4">
                    <h2 className="font-display text-xl tracking-widest">
                      <MapPin size={16} className="mr-2 inline-block text-brand-green" />
                      POSTAL ADDRESS
                    </h2>
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
                  </section>

                  <hr className="border-[var(--border-subtle)]" />

                  <section className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-display text-xl tracking-widest">
                          <MapPin size={16} className="mr-2 inline-block text-brand-green" />
                          GPS CLOCK-IN GEOFENCE
                        </h2>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Staff and students can only clock in when their phone reports a location
                          inside this radius. The server verifies coordinates, so a fake location
                          app won&apos;t work.
                        </p>
                      </div>
                      <label className="flex items-center gap-2 rounded-full bg-[var(--surface-disabled)] px-4 py-2 text-xs font-bold uppercase tracking-widest">
                        <input
                          type="checkbox"
                          checked={geoEnabled}
                          onChange={(e) => setGeoEnabled(e.target.checked)}
                          className="h-4 w-4 accent-brand-green"
                        />
                        {geoEnabled ? "Enabled" : "Disabled"}
                      </label>
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex-1 min-w-[12rem]">
                        <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          Latitude
                        </span>
                        <input
                          type="number"
                          step="0.000001"
                          min="-90"
                          max="90"
                          value={geoLat}
                          onChange={(e) => setGeoLat(e.target.value)}
                          placeholder="6.5244"
                          className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] p-3 text-sm text-[var(--text-primary)]"
                        />
                      </label>
                      <label className="flex-1 min-w-[12rem]">
                        <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          Longitude
                        </span>
                        <input
                          type="number"
                          step="0.000001"
                          min="-180"
                          max="180"
                          value={geoLng}
                          onChange={(e) => setGeoLng(e.target.value)}
                          placeholder="3.3792"
                          className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] p-3 text-sm text-[var(--text-primary)]"
                        />
                      </label>
                      <label className="w-40">
                        <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          Radius (m)
                        </span>
                        <input
                          type="number"
                          min={profile?.geo.minRadiusM ?? 20}
                          max={profile?.geo.maxRadiusM ?? 2000}
                          step={10}
                          value={geoRadius}
                          onChange={(e) => setGeoRadius(Number(e.target.value))}
                          className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] p-3 text-sm text-[var(--text-primary)]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={useMyLocation}
                        disabled={locating}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-disabled)] px-4 py-3 text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] disabled:opacity-50"
                      >
                        {locating ? (
                          <LoaderCircle className="animate-spin" size={14} />
                        ) : (
                          <Navigation size={14} />
                        )}
                        Use my location
                      </button>
                    </div>

                    {geoError && (
                      <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{geoError}</p>
                    )}

                    <div className="rounded-xl bg-[var(--surface-disabled)] p-4 text-xs text-[var(--text-muted)]">
                      <p className="font-bold text-[var(--text-secondary)]">
                        {profile?.geo.configured
                          ? "Fence is currently set."
                          : "Fence is not set."}
                      </p>
                      <p className="mt-1">
                        Stand at the school gate or admin office &amp; tap{" "}
                        <b>Use my location</b> to capture coordinates. Start with a radius of 100 m
                        and widen it if staff standing at the assembly ground get blocked.
                      </p>
                      {profile?.geo.configured && (
                        <p className="mt-2 font-mono">
                          Center: {profile.geo.latitude}, {profile.geo.longitude} ·{" "}
                          {profile.geo.radiusM} m radius
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setGeoLat("");
                        setGeoLng("");
                        setGeoEnabled(false);
                      }}
                      className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-500"
                    >
                      <MapPinOff size={14} /> Clear fence &amp; disable
                    </button>
                  </section>

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
                    {saving ? "Saving…" : "Save profile"}
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
