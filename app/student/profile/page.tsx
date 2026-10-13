"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import PortalSidebar from "@/components/PortalSidebar";
import {
  MessageCircle,
  LayoutDashboard,
  CalendarDays,
  FileText,
  User,
  Bell,
  ClipboardCheck,
  GraduationCap,
  Mail,
  Phone,
  Shield,
  Camera,
  LoaderCircle,
} from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/student/attendance", icon: CalendarDays },
  { label: "Timetable", href: "/student/timetable", icon: CalendarDays },
  { label: "CBT Tests", href: "/student/exams", icon: ClipboardCheck },
  { label: "Report Cards", href: "/student/report-cards", icon: FileText },
  { label: "Messages", href: "/student/messages", icon: MessageCircle },
  { label: "Announcements", href: "/student/announcements", icon: Bell },
  { label: "My Profile", href: "/student/profile", icon: User },
  { label: "Teachers", href: "/student/teachers", icon: GraduationCap },
];

type Profile = {
  displayName: string;
  studentId: string;
  gender: string | null;
  photoUrl: string | null;
  className: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
};

function fileToResizedDataUrl(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height) {
          height = Math.round((height * max) / width);
          width = max;
        } else {
          width = Math.round((width * max) / height);
          height = max;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/student/profile", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not load profile.");
      setProfile(j.student);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not load profile.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg("");
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      const r = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: dataUrl }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Upload failed.");
      setProfile((p) => (p ? { ...p, photoUrl: dataUrl } : p));
      setMsg("Profile photo updated.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const initials = (profile?.displayName || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <PortalTopbar title="My profile" />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2">
              MY <span className="text-brand-green">PROFILE</span>
            </h1>
            <p className="text-white/60 text-sm">
              View your information and manage your profile photo.
            </p>
          </div>
        </section>
        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <PortalSidebar portalName="Student" portalType="student" items={SIDEBAR_ITEMS} />
            <div className="flex-1 min-w-0 space-y-6">
              {msg && (
                <div className="rounded-2xl border border-brand-green/30 bg-brand-green/10 p-4 text-sm">
                  {msg}
                </div>
              )}
              <div className="rounded-[2rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] overflow-hidden shadow-[var(--card-shadow)]">
                <div className="h-28 bg-gradient-to-br from-brand-navy to-brand-navy-light" />
                <div className="px-8 pb-8 -mt-16">
                  <div className="flex items-end gap-6 mb-6">
                    <div className="relative">
                      <div className="w-28 h-28 rounded-3xl overflow-hidden bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center text-white font-display text-3xl border-4 border-[var(--bg-primary)] shadow-2xl">
                        {profile?.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profile.photoUrl}
                            alt={profile.displayName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{loading ? "" : initials}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading || loading}
                        className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-brand-orange text-brand-navy shadow-lg disabled:opacity-50"
                        aria-label="Change photo"
                      >
                        {uploading ? (
                          <LoaderCircle className="animate-spin" size={15} />
                        ) : (
                          <Camera size={15} />
                        )}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        onChange={onPhoto}
                        className="hidden"
                      />
                    </div>
                    <div className="pb-2">
                      <h2 className="font-display text-3xl text-[var(--text-primary)]">
                        {(profile?.displayName || "STUDENT").toUpperCase()}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-green/10 text-brand-green font-bold uppercase tracking-widest">
                          Student
                        </span>
                        {profile?.className && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-green text-brand-navy font-bold uppercase tracking-widest">
                            {profile.className}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-brand-green">
                        Personal Info
                      </h3>
                      {[
                        { icon: User, label: "Full Name", value: profile?.displayName },
                        { icon: User, label: "Gender", value: profile?.gender },
                        { icon: Shield, label: "Student ID", value: profile?.studentId },
                        { icon: GraduationCap, label: "Class", value: profile?.className },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-start gap-3 p-3 rounded-xl bg-[var(--surface-disabled)]"
                        >
                          <item.icon size={14} className="text-brand-green mt-0.5 shrink-0" />
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                              {item.label}
                            </div>
                            <div className="text-sm text-[var(--text-primary)] font-medium">
                              {item.value || "—"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-brand-orange">
                        Parent / Guardian
                      </h3>
                      {[
                        { icon: User, label: "Name", value: profile?.guardianName },
                        { icon: Phone, label: "Phone", value: profile?.guardianPhone },
                        { icon: Mail, label: "Email", value: profile?.guardianEmail },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-start gap-3 p-3 rounded-xl bg-[var(--surface-disabled)]"
                        >
                          <item.icon size={14} className="text-brand-orange mt-0.5 shrink-0" />
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                              {item.label}
                            </div>
                            <div className="text-sm text-[var(--text-primary)] font-medium">
                              {item.value || "—"}
                            </div>
                          </div>
                        </div>
                      ))}
                      {!profile?.guardianName &&
                        !profile?.guardianPhone &&
                        !profile?.guardianEmail && (
                          <p className="text-xs text-[var(--text-muted)]">
                            No guardian details linked.
                          </p>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
