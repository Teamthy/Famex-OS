/**
 * Boot the production build for local testing and load tests.
 *
 * WHY THIS EXISTS
 * ---------------
 * next.config.ts sets `output: "standalone"` so the Docker image can be a
 * traced, minimal bundle. `next start` does not serve that build:
 *
 *   ⚠ "next start" does not work with "output: standalone" configuration.
 *     Use "node .next/standalone/server.js" instead.
 *
 * It prints that and then fails to serve. Worse, the standalone bundle
 * deliberately omits `.next/static` and `public/` — Next expects the deploy
 * step to copy them in, which the Dockerfile does (lines 40-42). Run the
 * bundle without that copy and every stylesheet, script and image 404s, so
 * the page "loads" while looking and behaving like a broken shell.
 *
 * This script does the same copy the Dockerfile does, then starts the bundle.
 * The result is byte-for-byte the artefact that ships to production, which is
 * the only thing worth testing against.
 *
 * Usage:  node scripts/e2e-server.mjs [port]
 */

import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

const PORT = process.argv[2] || process.env.PORT || "3100";
const ROOT = process.cwd();
const STANDALONE = join(ROOT, ".next", "standalone");

if (!existsSync(STANDALONE)) {
  console.error(
    "\n.next/standalone does not exist — run `npm run build` first.\n" +
      "(If the build succeeded but this is still missing, check that\n" +
      ' next.config.ts still sets output: "standalone".)\n',
  );
  process.exit(1);
}

// Mirror the Dockerfile: the bundle is useless without these.
for (const [from, to] of [
  [join(ROOT, ".next", "static"), join(STANDALONE, ".next", "static")],
  [join(ROOT, "public"), join(STANDALONE, "public")],
]) {
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

const server = spawn(process.execPath, [join(STANDALONE, "server.js")], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT,
    HOSTNAME: process.env.HOSTNAME || "127.0.0.1",
    // This is a deliberate, scoped acceptance of the in-memory rate-limit
    // fallback: the e2e server is single-instance on one port, so a process-
    // local limiter is a real control here. Production (Vercel/multi-instance
    // Docker) must configure Upstash instead — see lib/rate-limit.ts.
    ALLOW_MEMORY_RATE_LIMITS: process.env.ALLOW_MEMORY_RATE_LIMITS || "true",
  },
});

// Forward signals so Playwright and CI can stop it cleanly rather than
// leaving a process holding the port.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code) => process.exit(code ?? 0));
