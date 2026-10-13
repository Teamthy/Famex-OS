"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface LightboxProps {
  images: { src: string; caption: string }[];
}

export default function Lightbox({ images }: LightboxProps) {
  const [idx, setIdx] = useState<number | null>(null);
  const next = () => setIdx(idx !== null ? (idx + 1) % images.length : 0);
  const prev = () => setIdx(idx !== null ? (idx - 1 + images.length) % images.length : 0);

  return (
    <>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className="group relative aspect-[4/3] rounded-2xl overflow-hidden"
          >
            <img
              src={img.src}
              alt={img.caption}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
              <span className="text-white font-medium text-sm">{img.caption}</span>
            </div>
          </button>
        ))}
      </div>

      {idx !== null && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-6"
          onClick={() => setIdx(null)}
        >
          <button
            onClick={() => setIdx(null)}
            className="absolute top-6 right-6 text-white hover:text-brand-green"
          >
            <X size={30} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-6 text-white hover:text-brand-green p-3 rounded-full bg-white/10 hover:bg-white/20"
          >
            <ChevronLeft size={30} />
          </button>
          <div className="max-w-5xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={images[idx].src}
              alt={images[idx].caption}
              className="w-full h-full object-contain rounded-lg"
            />
            <p className="text-white text-center mt-4 font-medium">{images[idx].caption}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-6 text-white hover:text-brand-green p-3 rounded-full bg-white/10 hover:bg-white/20"
          >
            <ChevronRight size={30} />
          </button>
        </div>
      )}
    </>
  );
}
