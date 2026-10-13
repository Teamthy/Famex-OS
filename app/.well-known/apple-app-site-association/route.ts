import { NextResponse } from "next/server";

export const dynamic = "force-static";

/**
 * Apple App Site Association — the iOS half of Universal Links.
 *
 * Served from code rather than `public/` for two reasons: Apple requires
 * `application/json` with NO `.json` extension on the path, which a static file
 * cannot express cleanly, and the team/bundle IDs then come from env rather
 * than being hardcoded in a file nobody remembers to update.
 *
 * THIS FILE ALONE DOES NOT ENABLE UNIVERSAL LINKS. It is the server side of a
 * three-part handshake:
 *   1. this document, at https://<domain>/.well-known/apple-app-site-association
 *   2. `ios.associatedDomains: ["applinks:<domain>"]` in mobile/app.json
 *   3. a NEW NATIVE BUILD submitted through TestFlight/App Store — the
 *      entitlement is compiled in, so an OTA update cannot deliver it
 *
 * Apple fetches this at install time. Until APPLE_TEAM_ID is set the route
 * returns 404 rather than an association naming a placeholder team, which iOS
 * would cache as a negative result.
 */
export async function GET() {
  const teamId = process.env.APPLE_TEAM_ID;
  const bundleId = process.env.IOS_BUNDLE_ID || "com.ykaycollege.app";

  // No team ID means Universal Links are not configured yet. A 404 is honest;
  // a malformed association is worse than none, because iOS caches it.
  if (!teamId) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json(
    {
      applinks: {
        // `details` supersedes the legacy `apps`/`paths` shape.
        details: [
          {
            appIDs: [`${teamId}.${bundleId}`],
            components: [
              // Only the paths the app can actually handle. Claiming "/" would
              // hijack every marketing page on the site into the app.
              { "/": "/reset-password", comment: "Password reset deep link" },
              { "/": "/verify/report/*", comment: "Report card verification" },
            ],
          },
        ],
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        // Apple re-fetches periodically; a day is long enough to be cheap and
        // short enough that adding a path does not take a week to propagate.
        "Cache-Control": "public, max-age=86400",
      },
    },
  );
}
