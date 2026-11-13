"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The dark card's two-up photograph carousel ("From our campus"). Cycles a
 * window of two images with arrows; purely presentational, zero data reads.
 */
export default function CampusMiniCarousel({
  photos,
}: {
  photos: { src: string; alt: string; caption: string }[];
}) {
  const [start, setStart] = useState(0);
  const visible = [photos[start % photos.length], photos[(start + 1) % photos.length]];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {visible.map((photo) => (
          <figure key={photo.src} className="overflow-hidden rounded-xl">
            <img
              src={photo.src}
              alt={photo.alt}
              loading="lazy"
              decoding="async"
              className="h-32 w-full object-cover transition duration-500 hover:scale-[1.04]"
            />
            <figcaption className="mt-1.5 text-[11px] text-white/85">{photo.caption}</figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setStart((s) => (s - 1 + photos.length) % photos.length)}
          aria-label="Previous campus photographs"
          className="grid h-8 w-8 place-items-center rounded-full border border-white/25 text-white transition hover:border-[var(--home-lime)] hover:bg-[var(--home-lime)] hover:text-[var(--home-dark)]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setStart((s) => (s + 1) % photos.length)}
          aria-label="Next campus photographs"
          className="grid h-8 w-8 place-items-center rounded-full border border-white/25 text-white transition hover:border-[var(--home-lime)] hover:bg-[var(--home-lime)] hover:text-[var(--home-dark)]"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
