"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

export type GalleryImage = {
  src: string;
  alt: string;
  caption: string;
  category: string;
};

export default function GalleryGrid({ images }: { images: GalleryImage[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeImage = activeIndex === null ? null : images[activeIndex];

  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft")
        setActiveIndex((current) =>
          current === null ? null : (current - 1 + images.length) % images.length,
        );
      if (event.key === "ArrowRight")
        setActiveIndex((current) => (current === null ? null : (current + 1) % images.length));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, images.length]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((image, index) => (
          <figure
            key={image.src}
            className="group overflow-hidden rounded-[24px] bg-white shadow-[var(--card-shadow)]"
          >
            <button
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Open photo: ${image.caption}`}
              className="relative block aspect-[4/3] w-full overflow-hidden text-left focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#1d4a45]"
            >
              <img
                src={image.src}
                alt={image.alt}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#082d20]/90 via-[#082d20]/45 to-transparent px-5 pb-5 pt-14 text-left">
                <span className="block text-[10px] font-bold uppercase tracking-[.18em] text-[#d7ff72]">
                  {image.category}
                </span>
                <span className="mt-1 block font-display text-2xl uppercase leading-tight text-white">
                  {image.caption}
                </span>
              </span>
            </button>
          </figure>
        ))}
      </div>

      {activeImage ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo viewer: ${activeImage.caption}`}
          className="fixed inset-0 z-[100] grid place-items-center bg-[#071d16]/95 p-4 sm:p-8"
          onClick={(event) => {
            if (event.target === event.currentTarget) setActiveIndex(null);
          }}
        >
          <div className="relative flex max-h-full w-full max-w-6xl flex-col items-center">
            <div className="mb-3 flex w-full items-center justify-between gap-4 text-white">
              <p className="min-w-0 text-sm font-semibold">
                <span className="text-[#d7ff72]">{activeImage.category}</span>
                <span aria-hidden="true"> · </span>
                {activeImage.caption}
                <span className="ml-2 text-white/80">
                  {activeIndex! + 1} / {images.length}
                </span>
              </p>
              <button
                type="button"
                onClick={() => setActiveIndex(null)}
                aria-label="Close photo viewer"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#082d20] transition hover:bg-[#d7ff72] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
              <img
                src={activeImage.src}
                alt={activeImage.alt}
                className="max-h-[calc(100vh-130px)] max-w-full rounded-2xl object-contain"
              />
              <button
                type="button"
                onClick={() =>
                  setActiveIndex((index) =>
                    index === null ? null : (index - 1 + images.length) % images.length,
                  )
                }
                aria-label="Previous photo"
                className="absolute left-2 grid h-11 w-11 place-items-center rounded-full bg-white text-[#082d20] shadow-lg transition hover:bg-[#d7ff72] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:left-4"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveIndex((index) => (index === null ? null : (index + 1) % images.length))
                }
                aria-label="Next photo"
                className="absolute right-2 grid h-11 w-11 place-items-center rounded-full bg-white text-[#082d20] shadow-lg transition hover:bg-[#d7ff72] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-4"
              >
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
