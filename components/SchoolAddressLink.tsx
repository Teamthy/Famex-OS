"use client";

import { useSchoolProfile } from "@/components/SchoolProfileContext";

/**
 * The profile-dependent fragment of ServiceInfo.
 *
 * Keeping this tiny island client-side lets the rest of the below-the-fold
 * home section render on the server. It preserves the existing behaviour:
 * show the resolved school's confirmed address when one exists, otherwise
 * direct visitors to contact the school office.
 */
export function SchoolAddressLink() {
  const { address } = useSchoolProfile();

  if (!address) {
    return (
      <p className="font-body text-sm text-[var(--text-primary)]">
        Call or email the school office for directions.
      </p>
    );
  }

  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-body text-sm text-[var(--text-primary)] underline decoration-[var(--border-default)] underline-offset-4 transition-colors hover:text-[var(--accent-primary)] hover:decoration-[var(--accent-primary)]"
    >
      {address}
    </a>
  );
}
