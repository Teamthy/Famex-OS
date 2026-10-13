"use client";

import { useEffect, useState } from "react";
import { qrDataUrl } from "@/lib/qr";

type Props = {
  value: string;
  size: number;
  /** Empty string marks the image as decorative. */
  alt: string;
  className?: string;
};

/**
 * A QR code generated in the browser from `value`. Use this instead of an
 * external QR URL, so the value (a student ID, a badge payload) never leaves the site.
 */
export default function QrImage({ value, size, alt, className }: Props) {
  // The image is stored with the inputs it was made from, so a stale image is never shown for new inputs.
  const requestKey = `${size}:${value}`;
  const [rendered, setRendered] = useState<{ key: string; src: string } | null>(null);

  useEffect(() => {
    let active = true;
    qrDataUrl(value, size)
      .then((url) => {
        if (active) setRendered({ key: requestKey, src: url });
      })
      .catch(() => {
        // Leave the placeholder in place. The printed value is still on the card.
      });
    return () => {
      active = false;
    };
    // requestKey already encodes value and size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const src = rendered?.key === requestKey ? rendered.src : null;

  if (!src) {
    return (
      <span
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={`inline-block ${className ?? ""}`}
      />
    );
  }

  return <img src={src} alt={alt} width={size} height={size} className={className} />;
}
