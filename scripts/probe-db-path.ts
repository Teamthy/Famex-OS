/**
 * Which layer between THIS machine and the database is broken?
 *
 *   npm run probe:db
 *
 * `diagnose:db` checks the database. This checks the PATH to it, one protocol
 * layer at a time, and separately over IPv4 and IPv6 — because the failure we
 * are chasing is a P1001 against a Neon branch that is provably healthy.
 *
 * Verified from outside the user's network at the time of writing: the host
 * completes a TLS 1.3 handshake and answers a Postgres startup packet with an
 * `R` (SCRAM auth request). A suspended compute cannot do that, so the
 * database is up and the fault is local to the client.
 *
 * The prime suspect is address family. Neon publishes both A and AAAA
 * records. Windows and Node frequently prefer IPv6; on a network with no
 * working IPv6 route the connection hangs and Prisma reports P1001 — "can't
 * reach the server" — with no hint that a different address family would have
 * worked immediately.
 *
 * Every step prints what it proves, so the output is a diagnosis rather than
 * a pass/fail.
 */
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns/promises";
import { logger } from "@/lib/logger";

const GREEN = "\u001b[32m";
const RED = "\u001b[31m";
const YELLOW = "\u001b[33m";
const DIM = "\u001b[2m";
const RESET = "\u001b[0m";

const ok = (label: string, detail = "") =>
  console.log(`  ${GREEN}✓${RESET} ${label}${detail ? ` ${DIM}${detail}${RESET}` : ""}`);
const bad = (label: string, detail = "") =>
  console.log(`  ${RED}✗${RESET} ${label}${detail ? ` ${DIM}${detail}${RESET}` : ""}`);
const note = (text: string) => console.log(`    ${DIM}${text}${RESET}`);

type Family = 4 | 6;

/** TCP connect to one specific IP, so we test an address family in isolation. */
function tcpTo(ip: string, port: number, family: Family, timeout = 8000) {
  return new Promise<{ ok: boolean; ms: number; error?: string }>((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    const done = (result: { ok: boolean; ms: number; error?: string }) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => done({ ok: true, ms: Date.now() - started }));
    socket.once("timeout", () => done({ ok: false, ms: Date.now() - started, error: "timeout" }));
    socket.once("error", (error: NodeJS.ErrnoException) =>
      done({ ok: false, ms: Date.now() - started, error: error.code || error.message }),
    );
    socket.connect({ host: ip, port, family });
  });
}

/**
 * Full Postgres reachability over one IP: TLS, then a startup packet.
 *
 * The startup packet is what distinguishes "the proxy accepted a socket" from
 * "the database is actually serving". Neon's proxy answers TCP even while the
 * compute is suspended, so a socket test alone proves nothing — a lesson this
 * project learned the hard way.
 */
function postgresHandshake(ip: string, port: number, servername: string, family: Family) {
  return new Promise<{ ok: boolean; stage: string; detail: string }>((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (result: { ok: boolean; stage: string; detail: string }) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    const timer = setTimeout(
      () => finish({ ok: false, stage: "timeout", detail: "no response within 12s" }),
      12_000,
    );

    socket.once("error", (error: NodeJS.ErrnoException) =>
      finish({ ok: false, stage: "tcp", detail: error.code || error.message }),
    );

    socket.connect({ host: ip, port, family }, () => {
      // SSLRequest: length 8, magic 80877103.
      const request = Buffer.alloc(8);
      request.writeInt32BE(8, 0);
      request.writeInt32BE(80877103, 4);
      socket.write(request);
    });

    socket.once("data", (first) => {
      if (first.toString("latin1", 0, 1) !== "S") {
        return finish({ ok: false, stage: "ssl", detail: "server refused TLS" });
      }
      const secure = tls.connect({ socket, servername, rejectUnauthorized: false }, () => {
        // A deliberately invalid user: we only care that the server ANSWERS.
        const params = "user\0__probe__\0database\0postgres\0\0";
        const length = 8 + Buffer.byteLength(params);
        const startup = Buffer.alloc(length);
        startup.writeInt32BE(length, 0);
        startup.writeInt32BE(196608, 4);
        startup.write(params, 8, "latin1");
        secure.write(startup);
      });
      secure.once("data", (reply) => {
        clearTimeout(timer);
        const type = reply.toString("latin1", 0, 1);
        finish({
          ok: type === "R" || type === "E",
          stage: "postgres",
          detail:
            type === "R"
              ? "auth requested — the database is serving"
              : type === "E"
                ? "server returned an error — still proves it is serving"
                : `unexpected reply type ${JSON.stringify(type)}`,
        });
      });
      secure.once("error", (error) => finish({ ok: false, stage: "tls", detail: error.message }));
    });
  });
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error("DATABASE_URL is not set. Run this from the project root so .env is loaded.");
    process.exitCode = 1;
    return;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    console.error("DATABASE_URL is not a valid URL.");
    process.exitCode = 1;
    return;
  }

  const host = url.hostname;
  const port = Number(url.port || 5432);

  console.log(`\nProbing the path to ${host}:${port}\n`);

  // ── DNS ──
  console.log("DNS");
  let v4: string[] = [];
  let v6: string[] = [];
  try {
    const all = await dns.lookup(host, { all: true });
    v4 = all.filter((a) => a.family === 4).map((a) => a.address);
    v6 = all.filter((a) => a.family === 6).map((a) => a.address);
  } catch (error) {
    bad("resolve", error instanceof Error ? error.message : String(error));
    return;
  }
  ok("resolve", `${v4.length} IPv4 · ${v6.length} IPv6`);

  let preferred = "";
  try {
    preferred = (await dns.lookup(host)).address;
    const family = v6.includes(preferred) ? "IPv6" : "IPv4";
    ok("default choice", `${preferred} (${family})`);
  } catch {
    /* non-fatal */
  }

  // ── Per-family TCP ──
  console.log("\nTCP, per address family");
  const v4Results = await Promise.all(v4.slice(0, 3).map((ip) => tcpTo(ip, port, 4)));
  const v6Results = await Promise.all(v6.slice(0, 3).map((ip) => tcpTo(ip, port, 6)));

  const v4Works = v4Results.some((r) => r.ok);
  const v6Works = v6Results.some((r) => r.ok);

  v4.slice(0, 3).forEach((ip, index) => {
    const result = v4Results[index];
    (result.ok ? ok : bad)(`IPv4 ${ip}`, result.ok ? `${result.ms}ms` : result.error);
  });
  v6.slice(0, 3).forEach((ip, index) => {
    const result = v6Results[index];
    (result.ok ? ok : bad)(`IPv6 ${ip}`, result.ok ? `${result.ms}ms` : result.error);
  });

  // ── Postgres over whichever family works ──
  console.log("\nPostgres protocol");
  const target = v4Works
    ? { ip: v4[0], family: 4 as Family }
    : v6Works
      ? { ip: v6[0], family: 6 as Family }
      : null;

  if (!target) {
    bad("handshake", "no address family reachable — nothing to talk to");
  } else {
    const result = await postgresHandshake(target.ip, port, host, target.family);
    (result.ok ? ok : bad)(
      `handshake over IPv${target.family}`,
      `${result.stage}: ${result.detail}`,
    );
  }

  // ── Verdict ──
  console.log("\n" + "─".repeat(62));

  if (v4Works && !v6Works && v6.length) {
    console.log(`${YELLOW}IPv6 is published but unreachable from this machine.${RESET}`);
    note("Neon publishes both A and AAAA records. Windows/Node often prefer");
    note("IPv6, and with no working IPv6 route the connection hangs — which");
    note("Prisma reports as P1001 'can't reach database server'.");
    console.log(`\n${GREEN}Fix — force IPv4 for Prisma commands:${RESET}`);
    console.log('    PowerShell:  $env:NODE_OPTIONS="--dns-result-order=ipv4first"');
    console.log("                 npx prisma migrate deploy");
    console.log("\n  Or permanently, in package.json scripts, prefix the command with:");
    console.log("    cross-env NODE_OPTIONS=--dns-result-order=ipv4first");
  } else if (!v4Works && !v6Works) {
    console.log(`${RED}Nothing reachable on either family — traffic is being blocked.${RESET}`);
    note("Port 5432 outbound is commonly blocked on corporate, campus and some");
    note("mobile-hotspot networks. Test on a different connection (phone");
    note("tether) to confirm, and check any VPN, firewall or antivirus that");
    note("inspects outbound TLS.");
  } else if (v4Works || v6Works) {
    console.log(`${GREEN}The network path is fine and the database is serving.${RESET}`);
    note("If Prisma still reports P1001, the problem is the connection STRING,");
    note("not the connection: check DATABASE_URL in .env for a stale host,");
    note("a rotated password, or a missing sslmode=require.");
  }
  console.log("");
}

main().catch((error) => {
  logger.error("Probe failed:", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
