"use client";

import { ArrowRight, MapPin } from "lucide-react";
import { useSchoolProfile } from "@/components/SchoolProfileContext";

/**
 * The profile-dependent map/address fragment of FindUs.
 *
 * Only this fragment needs the client-side school profile context. Isolating
 * it lets the remaining FindUs section — headings, featured news, and links —
 * render on the server instead of hydrating the whole section on the home
 * page.
 */
export function SchoolLocation() {
  const { address } = useSchoolProfile();

  if (!address) {
    return (
      <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 shadow-[var(--card-shadow)]">
        <div className="text-[10px] uppercase tracking-widest text-brand-green font-bold mb-1">
          Visit Us
        </div>
        <p className="text-[var(--text-primary)] leading-relaxed">
          Call or email the school office and we will give you directions to the campus.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Map: a plain place embed (no API key). The query is the confirmed campus address. */}
      <div className="mb-6 aspect-[4/3] overflow-hidden rounded-3xl border border-[var(--border-subtle)] shadow-lg">
        <iframe
          src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          loading="lazy"
          title={`Map showing ${address}`}
        />
      </div>

      {/* Address Card */}
      <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 shadow-[var(--card-shadow)]">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center shrink-0">
            <MapPin size={22} />
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-brand-green font-bold mb-1">
              Our Campus Address
            </div>
            <div className="text-[var(--text-primary)] font-medium leading-relaxed">{address}</div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-sm text-brand-green font-bold hover:underline"
            >
              Get Directions <ArrowRight size={12} />
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
