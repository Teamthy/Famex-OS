import { logger } from "@/lib/logger";
/**
 * Mobile API contract smoke.
 *
 * The mobile app is a thin client over the SAME backend as the web app, so the
 * thing worth testing is the contract: every endpoint mobile/lib/api.ts calls
 * must exist, accept the role the app signs in as, and return the shape the
 * screens read.
 *
 * This catches the class of bug found in the dashboards — an endpoint that
 * responds 200 but omits a field a screen renders.
 *
 * Usage: BASE_URL=http://127.0.0.1:3000 npx tsx scripts/e2e-mobile.ts
 */
const BASE = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
// No fallback — see scripts/e2e-full.ts. A smoke test that silently falls back
// to a known password hides the very misconfiguration it should surface.
const PASSWORD = process.env.SEED_PASSWORD || "";
if (!PASSWORD) {
  console.error("\nSEED_PASSWORD is required.\n");
  console.error('  PowerShell:  $env:SEED_PASSWORD="<the seeded password>"');
  console.error('  bash:        SEED_PASSWORD="<the seeded password>" npm run test:e2e:mobile\n');
  process.exit(1);
}

const ACCOUNTS: Record<string, string> = {
  ADMIN: "admin@ykaycollege.com",
  TEACHER: "teacher1@ykaycollege.com",
  STUDENT: "student1@ykaycollege.com",
  PARENT: "parent1@ykaycollege.com",
};

type Probe = {
  role: keyof typeof ACCOUNTS;
  path: string;
  /** Dot-paths the mobile screens actually read. */
  expect?: string[];
  label: string;
};

const PROBES: Probe[] = [
  // ── Student portal ──
  {
    role: "STUDENT",
    path: "/api/student/dashboard",
    label: "student dashboard",
    expect: [
      "student.displayName",
      "student.className",
      "student.studentId",
      "stats.attendanceRate",
      "stats.feeBalance",
    ],
  },
  { role: "STUDENT", path: "/api/student/report-cards", label: "student report cards" },
  { role: "STUDENT", path: "/api/student/attendance", label: "student attendance" },
  { role: "STUDENT", path: "/api/student/exams", label: "student exams" },
  { role: "STUDENT", path: "/api/student/announcements", label: "student announcements" },
  { role: "STUDENT", path: "/api/student/teachers", label: "student teachers" },
  { role: "STUDENT", path: "/api/auth/me", label: "session (me)", expect: ["user.role"] },

  // ── Teacher portal ──
  {
    role: "TEACHER",
    path: "/api/teacher/dashboard",
    label: "teacher dashboard",
    expect: [
      "teacher.displayName",
      "stats.classCount",
      "stats.totalStudents",
      "stats.openGradebooks",
      "stats.pendingCorrections",
      "stats.todayRegisterDone",
      "assignments",
    ],
  },
  { role: "TEACHER", path: "/api/teacher/students", label: "teacher students" },
  { role: "TEACHER", path: "/api/teacher/class/roster", label: "teacher roster" },
  { role: "TEACHER", path: "/api/teacher/profile", label: "teacher profile" },
  { role: "TEACHER", path: "/api/teacher/analytics", label: "teacher analytics" },
  { role: "TEACHER", path: "/api/teacher/announcements", label: "teacher announcements" },
  { role: "TEACHER", path: "/api/teacher/messages", label: "teacher messages" },
  { role: "TEACHER", path: "/api/teacher/gradebook", label: "teacher gradebook" },
  { role: "TEACHER", path: "/api/teacher/attendance/register", label: "attendance register" },

  // ── Parent portal ──
  {
    role: "PARENT",
    path: "/api/parent/dashboard",
    label: "parent dashboard",
    expect: [
      "parent.displayName",
      "children",
      "selectedChild",
      "attendance.attendanceRate",
      "finance.totalOutstanding",
    ],
  },
  { role: "PARENT", path: "/api/parent/report-cards", label: "parent report cards" },
  { role: "PARENT", path: "/api/parent/fees", label: "parent fees" },
  { role: "PARENT", path: "/api/parent/attendance", label: "parent attendance" },
  { role: "PARENT", path: "/api/parent/events", label: "parent events" },
  { role: "PARENT", path: "/api/parent/messages", label: "parent messages" },

  // ── Admin portal ──
  {
    role: "ADMIN",
    path: "/api/admin/dashboard",
    label: "admin dashboard",
    expect: ["stats.studentCount", "stats.teacherCount", "stats.classCount"],
  },
  { role: "ADMIN", path: "/api/admin/students", label: "admin students" },
  { role: "ADMIN", path: "/api/admin/finances/overview", label: "admin finances" },
  { role: "ADMIN", path: "/api/admin/fees/overview", label: "admin fees" },
  { role: "ADMIN", path: "/api/admin/admissions", label: "admin admissions" },
  { role: "ADMIN", path: "/api/admin/report-cards/overview", label: "admin report cards" },
  { role: "ADMIN", path: "/api/admin/news", label: "admin news" },
  { role: "ADMIN", path: "/api/admin/notifications", label: "admin notifications" },
  { role: "ADMIN", path: "/api/admin/attendance/corrections", label: "admin corrections" },
  { role: "ADMIN", path: "/api/admin/attendance/analytics", label: "admin attendance analytics" },
  { role: "ADMIN", path: "/api/admin/class-manager", label: "admin class manager" },
];

function dig(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

async function login(email: string): Promise<string | null> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
    redirect: "manual",
  });
  if (!res.ok) return null;
  const m = (res.headers.get("set-cookie") || "").match(/ykay_session=([^;]+)/);
  return m ? m[1] : null;
}

async function main() {
  console.log(`Mobile API contract smoke against ${BASE}`);
  console.log(`${PROBES.length} endpoints from mobile/lib/api.ts\n`);

  const cookies: Record<string, string> = {};
  for (const [role, email] of Object.entries(ACCOUNTS)) {
    const c = await login(email);
    if (c) cookies[role] = c;
    console.log(`  ${c ? "OK  " : "FAIL"} login ${role.padEnd(8)} ${email}`);
  }
  console.log("");

  let pass = 0;
  const failures: string[] = [];
  const missingFields: string[] = [];

  for (const probe of PROBES) {
    const cookie = cookies[probe.role];
    if (!cookie) {
      failures.push(`${probe.path} — no session for ${probe.role}`);
      continue;
    }

    let status = 0;
    let body: unknown = null;
    try {
      const res = await fetch(`${BASE}${probe.path}`, {
        headers: { Cookie: `ykay_session=${cookie}`, Accept: "application/json" },
        redirect: "manual",
      });
      status = res.status;
      body = await res.json().catch(() => null);
    } catch (e) {
      failures.push(`${probe.path} — ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    const ok = status === 200;
    const missing: string[] = [];
    if (ok && probe.expect) {
      for (const f of probe.expect) {
        if (dig(body, f) === undefined) missing.push(f);
      }
    }

    const mark = ok && missing.length === 0 ? "PASS" : ok ? "WARN" : "FAIL";
    const detail = missing.length ? `  missing: ${missing.join(", ")}` : "";
    console.log(
      `${mark}  ${String(status).padStart(3)}  ${probe.role.padEnd(8)} ${probe.label}${detail}`,
    );

    if (!ok) failures.push(`${probe.path} → ${status}`);
    else if (missing.length) missingFields.push(`${probe.path}: ${missing.join(", ")}`);
    else pass++;
  }

  console.log(`\n${"=".repeat(64)}`);
  console.log(`Endpoints : ${PROBES.length}`);
  console.log(`Passed    : ${pass}`);
  console.log(`Failed    : ${failures.length}`);
  console.log(`Field gaps: ${missingFields.length}`);

  if (failures.length) {
    console.log(`\nFailures:`);
    for (const f of failures) console.log(`  ${f}`);
  }
  if (missingFields.length) {
    console.log(`\nResponded 200 but missing fields a mobile screen reads:`);
    for (const f of missingFields) console.log(`  ${f}`);
  }

  if (failures.length) process.exit(1);
  console.log(`\nMobile contract OK.`);
}

main().catch((e) => {
  logger.error("Request failed", { error: e instanceof Error ? e.message : String(e) });
  process.exit(1);
});
