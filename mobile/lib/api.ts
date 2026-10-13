/**
 * Ykay College — mobile API client.
 *
 * Single-tenant client for the Ykay College portal. Talks to the SAME backend
 * as the web app. Offline-aware: reads go through a network-first cache
 * (cachedGet) and offline-safe writes are queued (apiQueued → queuedWrite).
 *
 * Shared HTTP primitives live in lib/http (imported here and by the offline
 * cache) to avoid a require cycle.
 */
import {
  API_BASE,
  IS_WEB,
  fetchOptions,
  getToken,
  setToken,
  clearToken,
  authHeaders,
  notifyAuthExpired,
  type SessionUser,
} from "@/lib/http";
import { cachedGet, queuedWrite } from "@/lib/offline/cache";

// Re-export so existing `import { API_BASE, getToken, ... } from "@/lib/api"` keeps working.
export { API_BASE, getToken, setToken, clearToken };
export type { SessionUser };

/**
 * Typed API call.
 *
 * The default is `any`, not `unknown`, on purpose. Screens consume dynamic
 * server shapes (`res?.reports?.[0]?.id`) and with `unknown` the compiler
 * narrows the result to `{}`, producing "Property 'reports' does not exist on
 * type '{}'" on eight screens. Callers that want safety pass an explicit
 * generic — `api<DashboardResponse>("/api/student/dashboard")` — and get full
 * checking; the rest stay ergonomic instead of littered with casts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  // Reads go through the offline read-cache (network-first, cache fallback).
  if (!options.method || options.method === "GET") {
    return cachedGet<T>(path);
  }
  // Mutations (payments, login, exam start) are sent directly — never queued.
  // On web the token is only a local "signed in" marker, not a JWT — the real
  // credential is the httpOnly cookie. Sending it as a Bearer would be a junk
  // header the backend tries (and fails) to verify.
  const token = IS_WEB ? null : await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (res.status === 401) void notifyAuthExpired();
  if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed");
  return data as T;
}

/** Offline-safe write: queued and replayed automatically when back online. */
export async function apiQueued<T = unknown>(
  path: string,
  method: string,
  body: unknown,
): Promise<T> {
  return queuedWrite<T>(path, method, body);
}

// ── Auth ──────────────────────────────────────────────────

export async function login(
  email: string,
  password: string,
): Promise<{ user: SessionUser; token: string }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    ...fetchOptions,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");

  /**
   * Recover the session token.
   *
   * NATIVE: there is no cookie jar, so we scrape `Set-Cookie` off the response
   * and replay it manually on later requests.
   *
   * WEB: `Set-Cookie` is a FORBIDDEN RESPONSE HEADER — the Fetch spec requires
   * browsers to filter it out of `res.headers` unconditionally. So the line
   * below always returned `null` on web, `token` was always `""`, `setToken`
   * was never called, and the root layout's `getMe()` bailed at
   * `if (!token) return null` — bouncing the user straight back to the login
   * screen it had just accepted them through. It reads like a rejected
   * password; it is actually a header the browser is required to hide.
   *
   * The real cookie IS set (httpOnly), and travels automatically now that
   * requests use `credentials: "include"`. All we need locally is a marker
   * that a session exists, so the layout's `if (!token)` gate passes.
   */
  let token = "";
  if (IS_WEB) {
    token = "web-session"; // marker only; the httpOnly cookie is the real auth
  } else {
    const setCookie = res.headers.get("set-cookie") || "";
    token = setCookie.match(/ykay_session=([^;]+)/)?.[1] || "";
  }

  if (token) await setToken(token);
  return { user: data.user, token };
}

/**
 * Ask the backend to email a reset link.
 *
 * The API always answers with the same generic message so an attacker can't
 * use this to discover which addresses are registered — so there is no
 * "unknown email" error to surface, and we never reveal existence either.
 */
export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/auth/password-reset/request`, {
    ...fetchOptions,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) {
    throw new Error(data.error || "Too many reset requests. Please try again later.");
  }
  return {
    message: data.message || "If this email is registered, you will receive a reset link shortly.",
  };
}

export async function logout(): Promise<void> {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    // ignore — we're clearing locally anyway
  }
  await clearToken();
}

export async function getMe(): Promise<{ user: SessionUser } | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    return await api<{ user: SessionUser }>("/api/auth/me");
  } catch {
    return null;
  }
}

// ── Messaging (parent <-> teacher, shared) ────────────────

export const messagingApi = {
  inbox: () => api("/api/messages"),
  thread: (id: string) => api(`/api/messages/${id}`),
  reply: (id: string, body: string) =>
    api(`/api/messages/${id}`, { method: "POST", body: JSON.stringify({ body }) }),
  start: (data: { studentProfileId: string; subject: string; body: string }) =>
    api("/api/messages", { method: "POST", body: JSON.stringify(data) }),
};

// ── Student API ───────────────────────────────────────────

type ExamAnswer = { questionId: string; response: string | null };

export const studentApi = {
  dashboard: () => api("/api/student/dashboard"),
  reportCards: () => api("/api/student/report-cards"),
  attendance: () => api("/api/student/attendance"),
  exams: () => api("/api/student/exams"),
  announcements: () => api("/api/student/announcements"),
  teachers: () => api("/api/student/teachers"),
  timetable: () => api("/api/student/timetable"),

  startExam: (examId: string) => api(`/api/student/exams/${examId}/attempt`, { method: "POST" }),
  saveExam: (examId: string, attemptId: string, answers: ExamAnswer[]) =>
    apiQueued(`/api/student/exams/${examId}/attempt`, "PATCH", {
      attemptId,
      action: "SAVE",
      answers,
    }),
  submitExam: (examId: string, attemptId: string, answers: ExamAnswer[]) =>
    api(`/api/student/exams/${examId}/attempt`, {
      method: "PATCH",
      headers: { "x-idempotency-key": `${attemptId}:submit` },
      body: JSON.stringify({
        attemptId,
        action: "SUBMIT",
        answers,
      }),
    }),
};

// ── Teacher API ───────────────────────────────────────────

export const teacherApi = {
  dashboard: () => api("/api/teacher/dashboard"),
  students: () => api("/api/teacher/students"),
  roster: () => api("/api/teacher/class/roster"),
  profile: () => api("/api/teacher/profile"),
  analytics: () => api("/api/teacher/analytics"),
  announcements: () => api("/api/teacher/announcements"),
  messages: () => api("/api/teacher/messages"),

  attendance: (classId?: string, date?: string) => {
    const p = new URLSearchParams();
    if (classId) p.set("classId", classId);
    if (date) p.set("date", date);
    const q = p.toString();
    return api("/api/teacher/attendance/register" + (q ? `?${q}` : ""));
  },
  saveAttendance: (data: {
    classId: string;
    sessionDate: string;
    periodKey?: string;
    notes?: string | null;
    finalize?: boolean;
    entries: { studentProfileId: string; status: string; note?: string | null }[];
  }) => apiQueued("/api/teacher/attendance/register", "POST", data),

  behavior: (studentId?: string) =>
    api("/api/teacher/class/behavior" + (studentId ? `?studentId=${studentId}` : "")),
  createBehavior: (data: {
    studentProfileId: string;
    type: "COMMENDATION" | "WARNING" | "NOTE";
    category?: string;
    description: string;
    notifyParent?: boolean;
  }) => api("/api/teacher/class/behavior", { method: "POST", body: JSON.stringify(data) }),
  deleteBehavior: (id: string) =>
    api(`/api/teacher/class/behavior?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  gradebook: (assignmentId?: string) =>
    api("/api/teacher/gradebook" + (assignmentId ? `?assignmentId=${assignmentId}` : "")),
  saveGradebook: (assignmentId: string, action: "SAVE" | "SUBMIT", scores: any[]) =>
    apiQueued("/api/teacher/gradebook", "POST", { assignmentId, action, scores }),
};

// ── Parent API ────────────────────────────────────────────

export const parentApi = {
  dashboard: (studentId?: string) =>
    api("/api/parent/dashboard" + (studentId ? `?studentId=${studentId}` : "")),
  reportCards: (studentId?: string) =>
    api("/api/parent/report-cards" + (studentId ? `?studentId=${studentId}` : "")),
  fees: (studentId?: string) =>
    api("/api/parent/fees" + (studentId ? `?studentId=${studentId}` : "")),
  attendance: (studentId?: string, month?: string) => {
    const p = new URLSearchParams();
    if (studentId) p.set("studentId", studentId);
    if (month) p.set("month", month);
    const q = p.toString();
    return api("/api/parent/attendance" + (q ? `?${q}` : ""));
  },
  events: () => api("/api/parent/events"),
  messages: () => api("/api/parent/messages"),
  timetable: (studentId?: string) =>
    api("/api/parent/timetable" + (studentId ? `?studentId=${encodeURIComponent(studentId)}` : "")),
  pay: (
    invoiceId: string,
    method: "PAYSTACK" | "BANK_TRANSFER",
    opts?: {
      amount?: number;
      transferReference?: string;
      transferDate?: string;
      narration?: string;
    },
  ) =>
    api("/api/parent/fees/payment-intents", {
      method: "POST",
      // Idempotency key — required by the backend to prevent double-charge on
      // retry/double-tap. Self-contained (Hermes has no crypto.randomUUID).
      headers: {
        "x-idempotency-key":
          Date.now().toString(36) +
          Math.random().toString(36).slice(2) +
          Math.random().toString(36).slice(2),
      },
      body: JSON.stringify({ invoiceId, method, ...opts }),
    }),
};

// ── Admin API ─────────────────────────────────────────────

export const adminApi = {
  dashboard: () => api("/api/admin/dashboard"),
  createStaff: (data: { name: string; email: string; role: string; phone?: string }) =>
    api("/api/admin/staff/direct", { method: "POST", body: JSON.stringify(data) }),
  students: () => api("/api/admin/students"),
  student: (id: string) => api(`/api/admin/students/${id}`),
  staffList: () => api("/api/admin/staff/assignments"),
  staffMember: (id: string) => api(`/api/admin/staff/${id}`),
  finances: () => api("/api/admin/finances/overview"),
  expenses: (category?: string) =>
    api("/api/admin/expenses" + (category ? `?category=${encodeURIComponent(category)}` : "")),
  createExpense: (data: {
    category: string;
    title: string;
    amount: number;
    spentAt?: string;
    vendor?: string;
    paymentMethod?: "CASH" | "BANK_TRANSFER" | "CARD" | "OTHER";
    reference?: string;
    notes?: string;
  }) => api("/api/admin/expenses", { method: "POST", body: JSON.stringify(data) }),
  deleteExpense: (id: string) =>
    api(`/api/admin/expenses?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
  fees: () => api("/api/admin/fees/overview"),
  sendFeeReminders: () => api("/api/admin/fees/reminders", { method: "POST" }),
  admissions: () => api("/api/admin/admissions"),
  reportCards: () => api("/api/admin/report-cards/overview"),
  generateReports: () => api("/api/admin/report-cards/generate", { method: "POST" }),
  news: () => api("/api/admin/news"),
  postNews: (data: {
    title: string;
    excerpt: string;
    content: string;
    category: string;
    isPublished: boolean;
  }) => api("/api/admin/news", { method: "POST", body: JSON.stringify(data) }),
  notifications: (status?: string) =>
    api("/api/admin/notifications" + (status ? `?status=${status}` : "")),
  broadcast: (data: { title: string; body: string; channels: string[]; audience: string }) =>
    api("/api/admin/notifications", { method: "POST", body: JSON.stringify(data) }),
  attendanceCorrections: () => api("/api/admin/attendance/corrections"),
  attendanceAnalytics: () => api("/api/admin/attendance/analytics"),
  classManager: () => api("/api/admin/class-manager"),

  staffAttendance: (date?: string) =>
    api(`/api/admin/staff-attendance${date ? `?date=${encodeURIComponent(date)}` : ""}`),
  recordStaffScan: (badgeCode: string, eventType?: "CHECK_IN" | "CHECK_OUT" | "AUTO") =>
    api("/api/admin/staff-attendance", {
      method: "POST",
      body: JSON.stringify({ badgeCode, eventType: eventType || "AUTO" }),
    }),
};

// ── Notification preferences ──────────────────────────────
//
// These used to live only in expo-secure-store, which the server cannot read —
// so the toggles changed nothing. They are now server-side, and the device
// copy is a cache for instant rendering.

export type NotificationPrefs = {
  announcements: boolean;
  attendance: boolean;
  fees: boolean;
  results: boolean;
};

export const notificationPrefsApi = {
  get: () => api<{ prefs: NotificationPrefs }>("/api/me/notification-prefs"),
  update: (patch: Partial<NotificationPrefs>) =>
    api<{ ok: boolean; prefs: NotificationPrefs }>("/api/me/notification-prefs", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
};

// ── Current academic term ─────────────────────────────────
//
// The app previously had no notion of a term: marks, invoices and attendance
// were shown with nothing saying which term they belonged to. `isEstimated`
// is true when the school has not configured a term and the labels are a
// month-based guess — surface that rather than presenting it as fact.

export type CurrentTerm = {
  sessionLabel: string;
  termLabel: string;
  termIndex: number | null;
  source: "TERM" | "CALENDAR";
  isEstimated: boolean;
};

export const termApi = {
  current: () => api<CurrentTerm>("/api/me/current-term"),
};

// ── Public school news ─────────────────────────────────────
export interface NewsPost {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  publishedAt: string | null;
}

export interface NewsDetail extends NewsPost {
  content: string;
}

export const newsApi = {
  list: () => api<{ posts: NewsPost[] }>("/api/news"),
  get: (slug: string) => api<{ post: NewsDetail }>(`/api/news?slug=${encodeURIComponent(slug)}`),
};

// ── School info (contact) ──────────────────────────────────
export interface SchoolInfo {
  name: string;
  motto: string;
  address: string;
  phone: string;
  email: string;
}

export const schoolInfoApi = {
  get: () => api<{ school: SchoolInfo }>(`/api/mobile/config`).then((r) => r.school),
};
