import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

/**
 * Branded Open Graph share-card factory (1200×630).
 *
 * Same design language as the site: deep navy, Anton display caps, brand
 * green accent. Rendered at build time by app/opengraph-image.tsx and the
 * per-route cards — WhatsApp, Facebook and iMessage show these previews, and
 * they drive clicks more than anything else in a shared link.
 *
 * Server-only (fs + build-time rendering); never import from a client file —
 * the pre-commit boundary check enforces this.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

let antonCache: ArrayBuffer | null = null;
let dmRegularCache: ArrayBuffer | null = null;
let dmBoldCache: ArrayBuffer | null = null;

async function toArrayBuffer(p: string): Promise<ArrayBuffer> {
  const b = await readFile(p);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

async function loadFonts() {
  // Satori cannot read WOFF2 ("Unsupported OpenType signature wOF2"), so the
  // TTF builds of the same self-hosted faces live beside the woff2 files.
  const dir = path.join(process.cwd(), "app/fonts");
  if (!antonCache) antonCache = await toArrayBuffer(path.join(dir, "Anton-Regular.ttf"));
  if (!dmRegularCache) dmRegularCache = await toArrayBuffer(path.join(dir, "DMSans-Regular.ttf"));
  if (!dmBoldCache) dmBoldCache = await toArrayBuffer(path.join(dir, "DMSans-Bold.ttf"));
  return [
    { name: "Anton", data: antonCache!, weight: 400 as const, style: "normal" as const },
    {
      name: "DM Sans",
      data: dmRegularCache!,
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "DM Sans",
      data: dmBoldCache!,
      weight: 700 as const,
      style: "normal" as const,
    },
  ];
}

export async function brandCard({
  eyebrow,
  title,
  subtitle,
  footer = "ykaycollege.edu.ng",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  footer?: string;
}) {
  const fonts = await loadFonts();
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#050c14",
        padding: "72px 80px",
        fontFamily: "DM Sans",
      }}
    >
      {/* top row: brand + eyebrow */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              backgroundColor: "#4ec54d",
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 6,
              color: "#ffffff",
            }}
          >
            YKAY COLLEGE
          </div>
        </div>
        <div style={{ fontSize: 22, letterSpacing: 4, color: "#8aa3b8", fontWeight: 700 }}>
          {eyebrow.toUpperCase()}
        </div>
      </div>

      {/* middle: the title */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontFamily: "Anton",
            fontSize: title.length > 24 ? 96 : 128,
            lineHeight: 1.02,
            color: "#ffffff",
            letterSpacing: -2,
            display: "flex",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ marginTop: 26, fontSize: 30, color: "#b8c9d8", display: "flex" }}>
            {subtitle}
          </div>
        ) : null}
      </div>

      {/* bottom: green rule + footer */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            width: 160,
            height: 10,
            backgroundColor: "#4ec54d",
            display: "flex",
            marginBottom: 24,
          }}
        />
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 3, color: "#8aa3b8" }}>
          {footer.toUpperCase()}
        </div>
      </div>
    </div>,
    { ...OG_SIZE, fonts },
  );
}
