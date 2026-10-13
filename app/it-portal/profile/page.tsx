"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  LoaderCircle,
  Lock,
  Mail,
  Save,
  Shield,
  Trophy,
  TrendingUp,
  User,
} from "lucide-react";

type ProfileData = {
  profile: {
    id: string;
    name: string;
    email: string;
    role: string;
    memberSince: string;
    lastLogin: string | null;
    mustChangePassword: boolean;
  };
  learningStats: {
    totalEnrollments: number;
    completedCourses: number;
    inProgressCourses: number;
    totalModulesCompleted: number;
    estimatedLearningHours: number;
    completedCourseTitles: string[];
  };
  recentActivity: {
    courseTitle: string;
    courseSlug: string;
    completedAt: string;
  }[];
};

export default function ProfilePage() {
  const { toast } = useToast();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit fields
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [activeSection, setActiveSection] = useState<"profile" | "password" | "activity">(
    "profile",
  );

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/it/profile", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setData(j);
        setName(j.profile.name);
      }
    } catch {
      toast("Failed to load profile.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProfile() {
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (name !== data?.profile.name) body.name = name;
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          toast("Passwords do not match.", "error");
          setSaving(false);
          return;
        }
        if (newPassword.length < 12) {
          toast("Password must be at least 12 characters.", "error");
          setSaving(false);
          return;
        }
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      if (Object.keys(body).length === 0) {
        toast("No changes to save.", "error");
        setSaving(false);
        return;
      }

      const r = await fetch("/api/it/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok) {
        toast(j.message || "Profile updated!", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        await load();
      } else {
        toast(j.error || "Update failed.", "error");
      }
    } catch {
      toast("Network error.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg-primary)]">
        <LoaderCircle className="animate-spin text-[var(--text-primary)]" size={32} />
      </div>
    );
  }

  if (!data) return null;

  const { profile, learningStats, recentActivity } = data;
  const memberDays = Math.floor(
    (Date.now() - new Date(profile.memberSince).getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] theme-transition">
      <Header />
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--card-shadow)]">
        <div className="mx-auto flex h-[72px] max-w-[1340px] items-center gap-4 px-6">
          <Link href="/it-portal/dashboard" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0F1F2E]">
              <GraduationCap size={22} className="text-[#4EC54D]" />
            </div>
            <div className="hidden sm:block">
              <div className="text-[13px] font-extrabold tracking-wider text-[var(--text-primary)]">
                YKAY
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#4EC54D]">
                IT Hub
              </div>
            </div>
          </Link>
          <Link
            href="/it-portal/dashboard"
            className="ml-4 flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft size={16} /> My Courses
          </Link>
          <span className="text-[var(--text-muted)]">/</span>
          <span className="text-sm font-bold text-[var(--text-primary)]">Profile</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1340px] px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          {/* Left sidebar — profile card */}
          <div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
              {/* Avatar */}
              <div className="mb-4 flex flex-col items-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#0F1F2E] to-[#1A3148] text-3xl font-bold text-white shadow-lg">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <h2 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
                  {profile.name}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">{profile.email}</p>
                <span className="mt-2 rounded-full bg-[#4EC54D]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#4EC54D]">
                  {profile.role.replace("_", " ")}
                </span>
              </div>

              {/* Quick stats */}
              <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
                <div className="flex items-center gap-3 text-sm">
                  <Trophy size={16} className="text-[#EA902E]" />
                  <span className="text-[var(--text-secondary)]">
                    {learningStats.completedCourses} courses completed
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <BookOpen size={16} className="text-[#4EC54D]" />
                  <span className="text-[var(--text-secondary)]">
                    {learningStats.totalModulesCompleted} modules finished
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock size={16} className="text-blue-500" />
                  <span className="text-[var(--text-secondary)]">
                    ~{learningStats.estimatedLearningHours}h learning time
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar size={16} className="text-[var(--text-muted)]" />
                  <span className="text-[var(--text-secondary)]">Member for {memberDays} days</span>
                </div>
              </div>

              {/* Badges */}
              {learningStats.completedCourseTitles.length > 0 && (
                <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Achievements
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {learningStats.completedCourses >= 1 && (
                      <span className="rounded-full bg-[#EA902E]/10 px-2.5 py-1 text-[9px] font-bold text-[#EA902E]">
                        🎓 First Certificate
                      </span>
                    )}
                    {learningStats.completedCourses >= 3 && (
                      <span className="rounded-full bg-[#4EC54D]/10 px-2.5 py-1 text-[9px] font-bold text-[#4EC54D]">
                        ⚡ Triple Threat
                      </span>
                    )}
                    {learningStats.totalModulesCompleted >= 10 && (
                      <span className="rounded-full bg-purple-500/10 px-2.5 py-1 text-[9px] font-bold text-purple-500">
                        🏆 10+ Modules
                      </span>
                    )}
                    {learningStats.estimatedLearningHours >= 20 && (
                      <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[9px] font-bold text-blue-500">
                        📚 20h Scholar
                      </span>
                    )}
                    {memberDays >= 30 && (
                      <span className="rounded-full bg-[#0F1F2E]/10 px-2.5 py-1 text-[9px] font-bold text-[var(--text-primary)]">
                        🗓️ 30-Day Member
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right content */}
          <div>
            {/* Section tabs */}
            <div className="mb-6 flex gap-0 border-b border-[var(--border-subtle)]">
              {(["profile", "password", "activity"] as const).map((section) => (
                <button
                  key={section}
                  onClick={() => setActiveSection(section)}
                  className={`relative px-5 py-3 text-sm font-bold capitalize transition ${
                    activeSection === section
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {section === "profile"
                    ? "Account Settings"
                    : section === "password"
                      ? "Change Password"
                      : "Recent Activity"}
                  {activeSection === section && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full bg-[#0F1F2E]" />
                  )}
                </button>
              ))}
            </div>

            {/* Account Settings */}
            {activeSection === "profile" && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                <h3 className="mb-6 text-lg font-bold text-[var(--text-primary)]">
                  Account Settings
                </h3>
                <div className="space-y-5 max-w-lg">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Full Name
                    </label>
                    <div className="relative">
                      <User
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                      />
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border-default)] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#0F1F2E] focus:ring-1 focus:ring-[#0F1F2E]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Email
                    </label>
                    <div className="relative">
                      <Mail
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                      />
                      <input
                        value={profile.email}
                        disabled
                        className="w-full cursor-not-allowed rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-disabled)] py-2.5 pl-10 pr-4 text-sm text-[var(--text-muted)]"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                      Email cannot be changed. Contact admin for assistance.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Role
                    </label>
                    <div className="relative">
                      <Shield
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                      />
                      <input
                        value={profile.role.replace("_", " ")}
                        disabled
                        className="w-full cursor-not-allowed rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-disabled)] py-2.5 pl-10 pr-4 text-sm capitalize text-[var(--text-muted)]"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => void saveProfile()}
                    disabled={saving || name === profile.name}
                    className="flex items-center gap-2 rounded-lg bg-[#0F1F2E] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#1a3148] disabled:opacity-50"
                  >
                    {saving ? (
                      <LoaderCircle className="animate-spin" size={14} />
                    ) : (
                      <Save size={14} />
                    )}
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {/* Change Password */}
            {activeSection === "password" && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                <h3 className="mb-2 text-lg font-bold text-[var(--text-primary)]">
                  Change Password
                </h3>
                <p className="mb-6 text-sm text-[var(--text-muted)]">
                  Use at least 12 characters with a mix of letters, numbers, and symbols.
                </p>
                <div className="space-y-5 max-w-lg">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Current Password
                    </label>
                    <div className="relative">
                      <Lock
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                      />
                      <input
                        type={showOldPw ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border-default)] py-2.5 pl-10 pr-10 text-sm outline-none focus:border-[#0F1F2E] focus:ring-1 focus:ring-[#0F1F2E]"
                      />
                      <button
                        onClick={() => setShowOldPw(!showOldPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                      >
                        {showOldPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                      />
                      <input
                        type={showNewPw ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        minLength={12}
                        className="w-full rounded-lg border border-[var(--border-default)] py-2.5 pl-10 pr-10 text-sm outline-none focus:border-[#0F1F2E] focus:ring-1 focus:ring-[#0F1F2E]"
                      />
                      <button
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                      >
                        {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {newPassword && (
                      <div className="mt-2 flex gap-1">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full ${
                              newPassword.length >= level * 4
                                ? level <= 1
                                  ? "bg-red-400"
                                  : level <= 2
                                    ? "bg-orange-400"
                                    : level <= 3
                                      ? "bg-yellow-400"
                                      : "bg-[#4EC54D]"
                                : "bg-[var(--border-subtle)]"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                      />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border-default)] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#0F1F2E] focus:ring-1 focus:ring-[#0F1F2E]"
                      />
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="mt-1 text-[11px] text-red-500">Passwords do not match</p>
                    )}
                  </div>
                  <button
                    onClick={() => void saveProfile()}
                    disabled={
                      saving ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword ||
                      newPassword !== confirmPassword
                    }
                    className="flex items-center gap-2 rounded-lg bg-[#0F1F2E] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#1a3148] disabled:opacity-50"
                  >
                    {saving ? (
                      <LoaderCircle className="animate-spin" size={14} />
                    ) : (
                      <Lock size={14} />
                    )}
                    Update Password
                  </button>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Changing your password will sign you out of all other devices.
                  </p>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            {activeSection === "activity" && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--card-shadow)]">
                <h3 className="mb-6 text-lg font-bold text-[var(--text-primary)]">
                  Recent Activity
                </h3>
                {recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity.map((activity, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-4 rounded-xl border border-[var(--border-subtle)] p-4"
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#4EC54D]/10">
                          <TrendingUp size={16} className="text-[#4EC54D]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[var(--text-primary)]">
                            Completed module in{" "}
                            <Link
                              href={`/it-portal/courses/${activity.courseSlug}`}
                              className="text-[#4EC54D] hover:underline"
                            >
                              {activity.courseTitle}
                            </Link>
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {new Date(activity.completedAt).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Clock size={40} className="mx-auto mb-3 text-[var(--text-muted)]" />
                    <p className="text-sm text-[var(--text-muted)]">
                      No activity yet. Start learning to see your progress here.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
