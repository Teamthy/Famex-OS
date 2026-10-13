/**
 * Database connectivity diagnostic.
 *
 *   npm run diagnose:db
 *
 * P1001 "Can't reach database server" is Prisma's catch-all: it means the
 * driver never got a usable connection, and it looks identical whether the
 * cause is DNS, a firewall, IPv6, TLS, a bad password or a suspended branch.
 * Guessing between those wastes time — this walks the layers in order and
 * stops at the first one that actually fails.
 *
 * Reads DATABASE_URL. Never prints the password.
 */
import net from "node:net";
import dns from "node:dns/promises";
import tls from "node:tls";
import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";

let failed = false;

function pass(label: string, detail = "") {
  console.log(`  ${GREEN}✓${RESET} ${label}${detail ? ` ${DIM}${detail}${RESET}` : ""}`);
}
function fail(label: string, detail: string, fix: string) {
  failed = true;
  console.log(`  ${RED}✗${RESET} ${label}`);
  console.log(`      ${RED}${detail}${RESET}`);
  console.log(`      ${YELLOW}→ ${fix}${RESET}`);
}
function warn(label: string, detail: string) {
  console.log(`  ${YELLOW}!${RESET} ${label} ${DIM}${detail}${RESET}`);
}

async function main() {
  console.log("\nDatabase connectivity diagnostic\n" + "─".repeat(60));

  // ── 1. Is the variable even set, and does it parse? ──
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    fail(
      "DATABASE_URL is set",
      "The variable is missing.",
      "Add DATABASE_URL to .env (copy the shape from .env.example).",
    );
    return;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail(
      "DATABASE_URL parses",
      "The value is not a valid URL.",
      "Expected postgresql://user:password@host/db?sslmode=require",
    );
    return;
  }

  const host = url.hostname;
  const port = Number(url.port || 5432);
  const database = url.pathname.replace(/^\//, "");
  const user = decodeURIComponent(url.username || "");

  pass("DATABASE_URL parses");
  console.log(`      host     ${host}`);
  console.log(`      port     ${port}`);
  console.log(`      database ${database || "(none in URL)"}`);
  console.log(`      user     ${user || "(none in URL)"}`);
  console.log(`      sslmode  ${url.searchParams.get("sslmode") ?? "(absent)"}`);

  // Placeholder values are a common cause and produce a confusing P1001.
  if (/^(HOST|USER|DATABASE|PASSWORD)$/i.test(host) || host === "HOST") {
    fail(
      "DATABASE_URL is filled in",
      "The URL still contains placeholder text (HOST/USER/DATABASE).",
      "Paste the real connection string from the Neon dashboard.",
    );
    return;
  }
  if (!database) {
    warn("Database name", "no database in the URL path — Prisma will likely fail");
  }
  if (host.includes("neon.tech") && !url.searchParams.get("sslmode")) {
    warn("sslmode", "Neon requires TLS; add ?sslmode=require");
  }

  // ── 2. DNS ──
  console.log("\nResolving DNS");
  let v4: string[] = [];
  let v6: string[] = [];

  // lookup() honours /etc/hosts and the OS resolver; resolve4/6 go straight to
  // a DNS server and would report "localhost" as unresolvable. Use lookup as
  // the source of truth and resolve4/6 only to describe what was found.
  try {
    const all = await dns.lookup(host, { all: true });
    v4 = all.filter((a) => a.family === 4).map((a) => a.address);
    v6 = all.filter((a) => a.family === 6).map((a) => a.address);
  } catch {
    /* reported below */
  }

  if (!v4.length && !v6.length) {
    fail(
      "DNS resolves",
      `${host} could not be resolved to any address.`,
      "Check the hostname for typos, and that you are online / not behind a DNS-filtering VPN.",
    );
    return;
  }
  pass("DNS resolves", `IPv4: ${v4.length || "none"} · IPv6: ${v6.length || "none"}`);

  // IPv6-only egress with an IPv6-less network is a classic silent P1001.
  if (!v4.length && v6.length) {
    warn("IPv4", "host resolves to IPv6 only — a network without IPv6 cannot reach it");
  }

  // ── 3. Raw TCP, per address family ──
  console.log("\nOpening a TCP socket");
  const candidates = [
    ...v4.map((ip) => ({ ip, family: "IPv4" })),
    ...v6.map((ip) => ({ ip, family: "IPv6" })),
  ];

  let reachable: { ip: string; family: string } | null = null;
  for (const candidate of candidates) {
    const ok = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      const done = (value: boolean) => {
        socket.destroy();
        resolve(value);
      };
      socket.setTimeout(8000);
      socket.once("connect", () => done(true));
      socket.once("timeout", () => done(false));
      socket.once("error", () => done(false));
      socket.connect(port, candidate.ip);
    });
    if (ok) {
      // NOTE: on Neon this proves the PROXY answered, not that the compute is
      // awake. Neon separates the two, so a suspended branch still accepts TCP
      // and then fails at the Postgres layer. Do not read this as "the
      // database is up" — the auth step below is what settles that.
      pass(`TCP ${candidate.family}`, `${candidate.ip}:${port} reachable`);
      reachable ??= candidate;
    } else {
      console.log(`  ${DIM}·${RESET} TCP ${candidate.family} ${candidate.ip}:${port} unreachable`);
    }
  }

  if (!reachable) {
    fail(
      "TCP connect",
      `Nothing accepted a connection on port ${port}.`,
      "A firewall, corporate proxy or antivirus is most likely blocking outbound 5432. " +
        "Try a phone hotspot to confirm, or use Neon's port 443 endpoint.",
    );
    return;
  }

  // ── 4. TLS ──
  console.log("\nNegotiating TLS");
  const tlsOk = await new Promise<boolean>((resolve) => {
    // Postgres needs an SSLRequest before TLS, so a plain TLS handshake on 5432
    // is expected to fail. This only proves the path is not being intercepted.
    const socket = net.connect(port, reachable!.ip, () => {
      // SSLRequest packet: length 8, code 80877103.
      const packet = Buffer.alloc(8);
      packet.writeInt32BE(8, 0);
      packet.writeInt32BE(80877103, 4);
      socket.write(packet);
    });
    socket.setTimeout(8000);
    socket.once("data", (data) => {
      const reply = data.toString("utf8", 0, 1);
      socket.destroy();
      resolve(reply === "S");
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });

  const tlsExpected = url.searchParams.get("sslmode") !== "disable" && host !== "localhost";
  if (tlsOk) {
    pass("TLS", "server accepted an SSL request");
  } else if (tlsExpected) {
    warn("TLS", "server refused the SSL request — a proxy may be intercepting port " + port);
  } else {
    // A local dev server with TLS off is normal, not a finding.
    console.log(`  ${DIM}·${RESET} TLS not offered ${DIM}(expected for a local server)${RESET}`);
  }

  // ── 5. Authenticate through Prisma ──
  console.log("\nAuthenticating (Prisma)");
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    pass("Authentication", "credentials accepted");

    const schools = await prisma.school.count();
    pass("Query", `School table readable (${schools} row(s))`);
  } catch (error) {
    const message = String(error);
    // Prisma phrases this several ways depending on the driver and version;
    // match the wording it actually emits, not just the documented code.
    if (
      message.includes("P1000") ||
      /password authentication failed/i.test(message) ||
      /authentication failed against database server/i.test(message) ||
      /credentials for .* are not valid/i.test(message)
    ) {
      fail(
        "Authentication",
        "The server answered but rejected the credentials.",
        "The password in DATABASE_URL is wrong or the role was rotated. Copy a fresh string from Neon.",
      );
    } else if (message.includes("P1003") || /does not exist/i.test(message)) {
      fail(
        "Database exists",
        `The server is up but "${database}" was not found.`,
        "Check the database name at the end of DATABASE_URL.",
      );
    } else if (
      message.includes("P1001") ||
      // Prisma does not always include the code in the message body — the
      // 6.x wording is just "Can't reach database server at ...". Matching
      // only on "P1001" sent this straight to the generic branch, which was
      // caught by running the diagnostic rather than reading it.
      /can't reach database server/i.test(message)
    ) {
      // We already proved TCP works, so this is NOT an unreachable server.
      if (host.includes("neon.tech")) {
        // On Neon, P1001 with a working socket almost always means the compute
        // is suspended and waking. The proxy answers TCP throughout, which is
        // why the socket test above passes and Prisma still fails.
        //
        // Neon's own docs are explicit that hammering it makes this worse:
        // "This issue sometimes occurs due to repeated connection attempts
        // during the compute's restart phase." So this waits patiently rather
        // than retrying fast — a cold start is typically a few seconds, and
        // the whole point is to give it room.
        const woken = await wakeNeon(prisma);
        if (woken) {
          pass(
            "Prisma connect",
            "the compute was suspended and has now woken — re-run your command",
          );
        } else {
          fail(
            "Prisma connect",
            "TCP succeeded, but Prisma could not connect even after waiting for a cold start.",
            "The compute did not wake within ~40s. Open the Neon dashboard and check the " +
              "branch is not disabled or over quota, then check neonstatus.com. Do NOT retry " +
              "in a tight loop — repeated attempts during a restart keep it failing.",
          );
        }
      } else {
        fail(
          "Prisma connect",
          "TCP succeeded above, yet Prisma still reports P1001.",
          "Likely TLS or the connection string rather than the server. Check sslmode and " +
            "whether a proxy/antivirus is inspecting TLS on this port.",
        );
      }
    } else {
      // Surface the first meaningful line, not just "PrismaClientInitializationError".
      const meaningful =
        message
          .split("\n")
          .map((line) => line.trim())
          .find((line) => line && !/^(PrismaClientInitializationError|Invalid `)/.test(line)) ??
        message.split("\n")[0];
      fail("Prisma connect", meaningful, "See the full error above.");
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("─".repeat(60));
  console.log(
    failed
      ? `${RED}Stopped at the first failing layer — fix that one and re-run.${RESET}\n`
      : `${GREEN}All layers healthy. The database is reachable.${RESET}\n`,
  );
}

/**
 * Give a suspended Neon compute time to wake, without hammering it.
 *
 * Neon scales a branch to zero after inactivity. The first connection has to
 * start the compute, and until it is up Prisma reports P1001 — indistinguishable
 * from a genuinely unreachable host, because the Neon proxy keeps answering TCP
 * the whole time.
 *
 * Backoff is deliberately generous and capped at four attempts. Neon's docs
 * warn that "repeated connection attempts during the compute's restart phase"
 * are themselves a cause of this error, so a tight retry loop makes a cold
 * start worse rather than better. Earlier in this project a 3/6/9/12s ladder
 * was actively counter-productive for exactly that reason.
 */
async function wakeNeon(prisma: { $queryRawUnsafe: (sql: string) => Promise<unknown> }) {
  const waits = [5_000, 10_000, 12_000, 12_000];
  process.stdout.write("      compute may be suspended — waiting for it to wake");

  for (const wait of waits) {
    await new Promise((resolve) => setTimeout(resolve, wait));
    process.stdout.write(".");
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      process.stdout.write("\n");
      return true;
    } catch {
      /* still starting */
    }
  }

  process.stdout.write("\n");
  return false;
}

main().catch((error) => {
  logger.error("Diagnostic itself failed:", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
