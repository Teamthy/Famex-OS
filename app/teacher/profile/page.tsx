"use client";

import { useState } from "react";
import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useApi } from "@/lib/useApi";

import { useToast } from "@/components/Toast";
import {
  User,
  Mail,
  Phone,
  Award,
  Calendar,
  School,
  Edit3,
  Save,
  Camera,
  Lock,
  Shield,
  Info,
} from "lucide-react";

export default function TeacherProfilePage() {
  const { toast } = useToast();
  const { data, loading: _apiLoading, error: _apiError } = useApi<any>("/api/teacher/profile");
  const teacher = data?.teacher || ({} as any);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(teacher.phone);
  const [bio, setBio] = useState(teacher.bio);

  const [saving, setSaving] = useState(false);

  /**
   * Actually save.
   *
   * This was `toast("Profile updated successfully")` and nothing else — the
   * teacher was told it worked, the edit lived in React state, and the next
   * refresh threw it away.
   *
   * Only `phone` is persisted: TeacherProfile has displayName, phone,
   * roleLabel and photoUrl, and no column for Bio. Rather than invent a
   * migration nobody asked for, Bio is left as a local note and the UI says
   * so — better than accepting text and silently discarding it.
   */
  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/teacher/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone || null }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save your profile.");
      toast(body.message || "Profile saved.", "success");
      setEditing(false);
    } catch (saveError) {
      toast(saveError instanceof Error ? saveError.message : "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2">
              MY PROFILE
            </h1>
            <p className="text-white/60 text-sm">
              Manage your personal information and account settings.
            </p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <TeacherSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              {/* Info Banner */}
              <div className="p-4 rounded-xl bg-brand-orange/10 border border-brand-orange/30 flex items-start gap-3">
                <Info size={18} className="text-brand-orange shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--text-secondary)]">
                  <strong className="text-brand-orange">Some fields are locked.</strong> You can
                  update your photo, phone number, and bio. Subject assignments and class teacher
                  role are managed by the school administrator.
                </div>
              </div>

              {/* Profile Card */}
              <div className="rounded-[2rem] bg-[var(--surface-card)] border border-[var(--border-subtle)] overflow-hidden shadow-[var(--card-shadow)]">
                {/* Cover + Photo */}
                <div className="h-32 bg-gradient-to-br from-brand-navy to-brand-navy-light relative">
                  <div className="absolute -bottom-16 left-8 flex items-end gap-6">
                    <div className="relative">
                      <img
                        src={teacher.photoUrl}
                        alt={teacher.fullName}
                        className="w-32 h-32 rounded-3xl object-cover border-4 border-[var(--bg-primary)] shadow-2xl"
                      />
                      {editing && (
                        <button className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-brand-green text-brand-navy flex items-center justify-center shadow-lg hover:bg-brand-green-dark">
                          <Camera size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="absolute top-4 right-4">
                    {!editing ? (
                      <button
                        onClick={() => setEditing(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-bold hover:bg-white/20 transition-all"
                      >
                        <Edit3 size={12} /> Edit Profile
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditing(false)}
                          className="px-4 py-2 rounded-full bg-white/10 text-white text-xs font-bold hover:bg-white/20"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => void handleSave()}
                          disabled={saving}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-green text-brand-navy text-xs font-bold hover:bg-brand-green-dark"
                        >
                          <Save size={12} /> Save Changes
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Profile Details */}
                <div className="pt-20 pb-8 px-8">
                  <h2 className="font-display text-3xl text-[var(--text-primary)] mb-1">
                    {teacher.fullName}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mb-6">
                    <span className="text-brand-green text-xs font-bold uppercase tracking-widest">
                      {teacher.qualification}
                    </span>
                    <span className="text-[var(--text-muted)]">·</span>
                    <span className="text-xs text-[var(--text-muted)]">{teacher.department}</span>
                  </div>

                  {/* Two column grid */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Left: Editable */}
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-brand-green mb-3">
                        Editable Fields
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block flex items-center gap-1">
                            <Phone size={12} /> Phone Number
                          </label>
                          {editing ? (
                            <input
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className="w-full p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] focus:outline-none focus:border-brand-green"
                            />
                          ) : (
                            <div className="p-3 rounded-xl bg-[var(--surface-disabled)] text-[var(--text-primary)]">
                              {phone}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block flex items-center gap-1">
                            <User size={12} /> Bio / About Me
                          </label>
                          {editing ? (
                            <textarea
                              value={bio}
                              onChange={(e) => setBio(e.target.value)}
                              rows={4}
                              className="w-full p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--input-text)] focus:outline-none focus:border-brand-green resize-none"
                            />
                          ) : (
                            <div className="p-3 rounded-xl bg-[var(--surface-disabled)] text-[var(--text-primary)] text-sm">
                              {bio}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Locked */}
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3 flex items-center gap-1">
                        <Lock size={12} /> Managed by Admin
                      </div>
                      <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-[var(--surface-disabled)] border-l-2 border-brand-orange/50">
                          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1 flex items-center gap-1">
                            <Mail size={10} /> Email
                          </div>
                          <div className="text-sm text-[var(--text-primary)]">{teacher.email}</div>
                        </div>
                        <div className="p-3 rounded-xl bg-[var(--surface-disabled)] border-l-2 border-brand-orange/50">
                          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1 flex items-center gap-1">
                            <Award size={10} /> Qualification
                          </div>
                          <div className="text-sm text-[var(--text-primary)]">
                            {teacher.qualification}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-[var(--surface-disabled)] border-l-2 border-brand-orange/50">
                          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1 flex items-center gap-1">
                            <Calendar size={10} /> Employment Date
                          </div>
                          <div className="text-sm text-[var(--text-primary)]">
                            {teacher.employmentDate}
                          </div>
                        </div>
                        {teacher.formClass && (
                          <div className="p-3 rounded-xl bg-brand-orange/5 border-l-2 border-brand-orange">
                            <div className="text-[10px] uppercase tracking-widest text-brand-orange mb-1 flex items-center gap-1">
                              <School size={10} /> Form Teacher
                            </div>
                            <div className="text-sm font-bold text-[var(--text-primary)]">
                              Class {teacher.formClass}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subject Assignments */}
              <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 shadow-[var(--card-shadow)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg text-[var(--text-primary)]">
                    Subject Assignments
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange font-bold uppercase tracking-widest">
                    <Lock size={9} className="inline mr-1" />
                    Admin Controlled
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {(teacher.subjectAssignments || []).map((sa: any) => (
                    <div key={sa.subject} className="p-4 rounded-xl bg-[var(--surface-disabled)]">
                      <div className="font-bold text-[var(--text-primary)] mb-2">{sa.subject}</div>
                      <div className="text-xs text-[var(--text-muted)] mb-2">
                        Teaching {sa.classes.length} class arms:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {sa.classes.map((cls: any) => (
                          <span
                            key={cls}
                            className="text-[10px] px-2 py-0.5 rounded bg-brand-green/10 text-brand-green font-bold"
                          >
                            {cls}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-4">
                  To change subject or class assignments, contact the school administrator.
                </p>
              </div>

              {/* Security */}
              <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 shadow-[var(--card-shadow)]">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="text-brand-green" size={20} />
                  <h3 className="font-display text-lg text-[var(--text-primary)]">Security</h3>
                </div>
                <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-green/10 text-brand-green text-sm font-bold hover:bg-brand-green hover:text-brand-navy transition-all">
                  <Lock size={14} /> Change Password
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
