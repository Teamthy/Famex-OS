import { NextResponse } from "next/server";

export const dynamic = "force-static";

/**
 * Digital Asset Links — the Android half of App Links.
 *
 * Served from code so the SHA-256 certificate fingerprint comes from env. That
 * fingerprint belongs to the signing key; hardcoding it in a committed file
 * makes rotating or adding a key (Play App Signing uses a different one from
 * your upload key) a code change nobody expects.
 *
 * THIS FILE ALONE DOES NOT ENABLE APP LINKS. Also required:
 *   1. `android.intentFilters` in mobile/app.json with `autoVerify: true`
 *   2. a NEW NATIVE BUILD — the intent filter lives in AndroidManifest.xml
 *   3. the fingerprint of the key Google Play actually signs with, which is
 *      NOT your upload key. Play Console → Setup → App signing.
 *
 * ANDROID_CERT_SHA256 accepts a comma-separated list so the upload key and the
 * Play signing key can both be present during a migration.
 */
export async function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const packageName = process.env.ANDROID_PACKAGE || "com.ykaycollege.app";

  // Without a fingerprint the statement verifies nothing. Return 404 rather
  // than publishing an empty grant.
  if (!fingerprints.length) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400",
      },
    },
  );
}
