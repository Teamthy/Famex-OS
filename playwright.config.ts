import { defineConfig, devices } from "@playwright/test";

/**
 * Authenticated browser E2E.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every existing test mocks Prisma via tests/setup.ts, so nothing exercised a
 * real request through real middleware against a real database. Two bugs
 * shipped straight through a green suite because of that gap:
 *
 *   - `camera=()` in next.config.ts silently disabled the QR scanner. The
 *     failure was a response header, which no unit test reads.
 *   - lib/session.ts lost the `checkRole` export. 633 tests passed; the build
 *     died. Nothing under tests/ imports checkRole, so only a real route did.
 *
 * These run against a built app and a seeded database. They are slower than
 * unit tests on purpose — they are the only thing here that proves a user can
 * actually sign in and do their job.
 *
 * Local:  npm run test:e2e:ui
 * CI:     npm run test:e2e:browser
 */

const PORT = Number(process.env.E2E_PORT || 3100);
const BASE_URL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // Journeys share one seeded database and some of them write to it, so
  // running files in parallel makes failures depend on scheduling order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // The QR attendance journey needs a camera. Playwright's fake device
        // satisfies getUserMedia, which is what the Permissions-Policy header
        // gates — so this asserts the header is right, not that a webcam works.
        permissions: ["camera"],
        launchOptions: {
          args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        },
      },
    },
  ],

  // Reuse an already-running server locally; start one in CI.
  //
  // ── Why `node .next/standalone/server.js` and not `next start` ────────────
  // next.config.ts sets `output: "standalone"` (for the Docker image), and
  // `next start` refuses to serve that build — it prints a warning and then
  // fails. The standalone bundle also does NOT include .next/static or
  // public/; the Dockerfile copies them in, so anything running the bundle
  // directly has to do the same or every stylesheet and script 404s.
  //
  // scripts/e2e-server.mjs does that copy and then boots the bundle, so what
  // the tests exercise is byte-for-byte the artefact that ships in Docker.
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: `node scripts/e2e-server.mjs ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
