import { NextResponse } from "next/server";
import { apkUrl } from "@/lib/apk";

export const dynamic = "force-dynamic";

/**
 * Stable download link: /download/apk → wherever the APK actually lives.
 *
 * The hosting decision is not permanent. The repo goes private after launch,
 * which rules out GitHub Release assets (a private release asset 404s on its
 * public URL and the API hands back a short-lived signed redirect), so the
 * file will move to R2 or similar. It may move again.
 *
 * Every link that escapes into the world — a printed letter, a WhatsApp
 * forward, a QR code on a noticeboard, a parent's bookmark — must survive
 * that. Those cannot be edited after the fact. So the only URL we ever publish
 * is this one, and the storage URL stays an environment variable.
 *
 * A 302, not a 308: the target changes with every release, and a permanent
 * redirect would be cached by browsers and proxies pointing at a stale build.
 */
export async function GET() {
  const target = apkUrl();

  if (!target) {
    // Send them to the page that explains things rather than erroring at a
    // link someone has already shared.
    return NextResponse.redirect(
      new URL(
        "/download?error=unavailable",
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      ),
      302,
    );
  }

  return NextResponse.redirect(target, {
    status: 302,
    headers: {
      // Short cache so a new release propagates quickly, but not zero — a
      // noticeboard QR code can be scanned by a whole class at once.
      "Cache-Control": "public, max-age=300",
    },
  });
}
