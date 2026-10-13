"use client";

import { useState } from "react";
import { cacheSet } from "@/lib/offline/db";
import { CheckCircle2, Loader2, CloudOff } from "lucide-react";

/**
 * "Download for Offline" button.
 *
 * Pre-fetches ALL portal data for the current user role and caches it in
 * IndexedDB. After this, the user can go fully offline and every page
 * loads instantly from cache.
 *
 * Usage: <DownloadForOffline role="teacher" />
 */
const ROUTES_BY_ROLE: Record<string, string[]> = {
  teacher: [
    "/api/teacher/dashboard",
    "/api/teacher/students",
    "/api/teacher/profile",
    "/api/teacher/gradebook",
    "/api/teacher/attendance/register",
  ],
  student: [
    "/api/student/dashboard",
    "/api/student/report-cards",
    "/api/student/exams",
    "/api/student/attendance",
    "/api/teacher/profile",
  ],
  parent: [
    "/api/parent/dashboard",
    "/api/parent/report-cards",
    "/api/parent/fees",
    "/api/parent/attendance",
  ],
};

export default function DownloadForOffline({ role }: { role: string }) {
  const [status, setStatus] = useState<"idle" | "downloading" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);

  async function downloadAll() {
    const routes = ROUTES_BY_ROLE[role] || [];
    setStatus("downloading");
    setProgress(0);

    let succeeded = 0;
    for (let i = 0; i < routes.length; i++) {
      try {
        const res = await fetch(routes[i], { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          await cacheSet(routes[i], data);
          succeeded++;
        }
      } catch {
        // Skip failed routes
      }
      setProgress(Math.round(((i + 1) / routes.length) * 100));
    }

    setStatus(succeeded > 0 ? "done" : "error");
  }

  if (status === "done") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-500 text-xs font-bold">
        <CheckCircle2 size={14} /> Ready for offline
      </div>
    );
  }

  if (status === "downloading") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold">
        <Loader2 size={14} className="animate-spin" /> Downloading... {progress}%
      </div>
    );
  }

  return (
    <button
      onClick={downloadAll}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-bold hover:bg-white/10 transition-colors"
    >
      <CloudOff size={14} /> Download for offline
    </button>
  );
}
