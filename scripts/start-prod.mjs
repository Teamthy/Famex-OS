/**
 * Start the production build.
 *
 * next.config.ts sets `output: "standalone"`, so the canonical way to run the
 * built app is the traced bundle:
 *
 *   node .next/standalone/server.js
 *
 * `next start` refuses to serve a standalone build, and the standalone bundle
 * deliberately omits `.next/static` and `public/` (the deploy step is expected
 * to copy them in). This launcher does that copy — the same two lines the
 * Dockerfile runs — then boots the bundle.
 *
 * The result is byte-for-byte the artifact that ships to production, which is
 * the only thing `npm start` should serve.
 *
 * Usage:  npm run build && npm start
 *         PORT=3001 npm start          (default port 3000)
 *         HOSTNAME=0.0.0.0 npm start   (bind all interfaces — needed in a container)
 */

import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

const PORT = process.env.PORT || "3000";
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
    // Default to all interfaces so containers / other machines can reach it.
    // Override with HOSTNAME=127.0.0.1 for a local-only server.
    HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
  },
});

// Forward signals so an orchestrator (or Ctrl+C) stops it cleanly.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code) => process.exit(code ?? 0));
