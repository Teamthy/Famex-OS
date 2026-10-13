import { NextResponse } from "next/server";
import { apkUrl } from "@/lib/apk";
import { isOlderThan } from "@/lib/app-version";

export const dynamic = "force-dynamic";

/**
 * Public runtime config for the mobile app.
 *
 * Ykay is distributing the Android app as a **sideloaded APK**, not through
 * the Play Store. That removes the safety net a store provides:
 *
 *   - nothing nags a stale install to update
 *   - an APK forwarded on WhatsApp can be installed months later
 *   - OTA updates only replace JavaScript, so a build whose NATIVE layer is
 *     too old cannot be fixed over the air at all
 *
 * So the server has to be able to say "that build is too old, download a new
 * APK". Without this, an old install just starts failing in confusing ways
 * against an API that has moved on.
 *
 * Deliberately unauthenticated: a client that is too old to sign in still
 * needs to be told why.
 */

/**
 * Oldest app version allowed to keep working.
 *
 * Only raise this when a change genuinely cannot be delivered over the air —
 * a new native module, or a breaking API change. Raising it casually forces
 * every parent to re-download an APK by hand, which is a real cost when there
 * is no store to do it for them.
 */
const MINIMUM_APP_VERSION = "1.0.0";

/**
 * Where a user goes to get a current build.
 *
 * Prefers the /download page over the raw .apk — it explains Android's
 * "unknown source" warning, which a raw file link cannot.
 */
function downloadUrl(): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (site) return `${site}/download`;
  return apkUrl() ?? "";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appVersion = url.searchParams.get("appVersion");

  // No version supplied — answer with the policy rather than a verdict, so a
  // client can decide for itself.
  const outdated = appVersion ? isOlderThan(appVersion, MINIMUM_APP_VERSION) : false;

  return NextResponse.json(
    {
      minimumAppVersion: MINIMUM_APP_VERSION,
      apkUrl: downloadUrl(),
      outdated,
      message: outdated
        ? "This version of the Ykay College app is no longer supported. Please download the latest version."
        : null,
      // Public school contact info for the in-app "School Info" screen. Plain
      // values — nothing sensitive, safe for any signed-in user to see.
      school: {
        name: process.env.SCHOOL_NAME || "Ykay College & Leadership Academy",
        motto: process.env.SCHOOL_MOTTO || "Excellence in Education",
        address: process.env.SCHOOL_ADDRESS || "",
        phone: process.env.SCHOOL_PHONE || "",
        email: process.env.SCHOOL_EMAIL || "",
      },
    },
    {
      // Short cache: this is checked on launch and must react quickly when a
      // minimum is raised, but should not hammer the server.
      headers: { "Cache-Control": "public, max-age=300" },
    },
  );
}
