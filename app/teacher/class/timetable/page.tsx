"use client";

import PortalTopbar from "@/components/PortalTopbar";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useApi } from "@/lib/useApi";
import { School, Clock, MapPin, User } from "lucide-react";

const TIMETABLE = [
  {
    day: "Monday",
    periods: [
      { time: "08:00", subject: "Mathematics", teacher: "Dr. Grace Okonkwo", room: "Room 12" },
      { time: "09:10", subject: "English Literature", teacher: "Mr. Tunde Bakare", room: "Room 8" },
      { time: "10:20", subject: "Break", teacher: "", room: "" },
      { time: "10:40", subject: "Physics", teacher: "Dr. Grace Okonkwo", room: "Lab 1" },
      { time: "11:50", subject: "Chemistry", teacher: "Mrs. Amina Sule", room: "Lab 2" },
      { time: "13:00", subject: "Lunch", teacher: "", room: "" },
      { time: "14:00", subject: "History", teacher: "Mr. Tunde Bakare", room: "Room 8" },
    ],
  },
  {
    day: "Tuesday",
    periods: [
      { time: "08:00", subject: "Biology", teacher: "Mrs. Amina Sule", room: "Lab 2" },
      { time: "09:10", subject: "Mathematics", teacher: "Dr. Grace Okonkwo", room: "Room 12" },
      { time: "10:20", subject: "Break", teacher: "", room: "" },
      { time: "10:40", subject: "Economics", teacher: "Ms. Ruth Okafor", room: "Room 5" },
      { time: "11:50", subject: "English Literature", teacher: "Mr. Tunde Bakare", room: "Room 8" },
      { time: "13:00", subject: "Lunch", teacher: "", room: "" },
      { time: "14:00", subject: "ICT", teacher: "Mr. Kolawole Adeyemi", room: "Computer Lab" },
    ],
  },
  {
    day: "Wednesday",
    periods: [
      { time: "08:00", subject: "Physics", teacher: "Dr. Grace Okonkwo", room: "Lab 1" },
      { time: "09:10", subject: "Chemistry", teacher: "Mrs. Amina Sule", room: "Lab 2" },
      { time: "10:20", subject: "Break", teacher: "", room: "" },
      { time: "10:40", subject: "Mathematics", teacher: "Dr. Grace Okonkwo", room: "Room 12" },
      { time: "11:50", subject: "Government", teacher: "Mr. Tunde Bakare", room: "Room 8" },
      { time: "13:00", subject: "Lunch", teacher: "", room: "" },
      { time: "14:00", subject: "Physical Education", teacher: "Coach Tunde", room: "Field" },
    ],
  },
  {
    day: "Thursday",
    periods: [
      { time: "08:00", subject: "English Language", teacher: "Mr. Tunde Bakare", room: "Room 8" },
      { time: "09:10", subject: "Physics", teacher: "Dr. Grace Okonkwo", room: "Lab 1" },
      { time: "10:20", subject: "Break", teacher: "", room: "" },
      { time: "10:40", subject: "Biology", teacher: "Mrs. Amina Sule", room: "Lab 2" },
      { time: "11:50", subject: "Mathematics", teacher: "Dr. Grace Okonkwo", room: "Room 12" },
      { time: "13:00", subject: "Lunch", teacher: "", room: "" },
      { time: "14:00", subject: "Music", teacher: "Ms. Blessing", room: "Arts Room" },
    ],
  },
  {
    day: "Friday",
    periods: [
      { time: "08:00", subject: "Chemistry", teacher: "Mrs. Amina Sule", room: "Lab 2" },
      { time: "09:10", subject: "Economics", teacher: "Ms. Ruth Okafor", room: "Room 5" },
      { time: "10:20", subject: "Break", teacher: "", room: "" },
      { time: "10:40", subject: "Mathematics", teacher: "Dr. Grace Okonkwo", room: "Room 12" },
      { time: "11:50", subject: "History", teacher: "Mr. Tunde Bakare", room: "Room 8" },
      { time: "13:00", subject: "Lunch", teacher: "", room: "" },
      { time: "14:00", subject: "Assembly", teacher: "", room: "Main Hall" },
    ],
  },
];

export default function ClassTimetablePage() {
  const { data, loading: _apiLoading, error: _apiError } = useApi<any>("/api/teacher/profile");
  const teacher = data?.teacher || ({} as any);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <>
      <PortalTopbar />
      <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
        <section className="pt-24 pb-10 bg-brand-navy px-6">
          <div className="mx-auto max-w-7xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-orange/20 border border-brand-orange/40 text-brand-orange text-[10px] font-bold uppercase tracking-widest mb-3">
              <School size={11} /> Form Teacher · {teacher.formClass}
            </span>
            <h1 className="font-display text-4xl md:text-5xl tracking-widest text-white mb-2">
              CLASS <span className="text-brand-orange">TIMETABLE</span>
            </h1>
            <p className="text-white/60 text-sm">
              Full weekly schedule for {teacher.formClass}. Today: {today}
            </p>
          </div>
        </section>

        <section className="py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-8">
            <TeacherSidebar />

            <div className="flex-1 min-w-0 space-y-6">
              {TIMETABLE.map((day) => (
                <div
                  key={day.day}
                  className={`rounded-2xl overflow-hidden shadow-[var(--card-shadow)] ${day.day === today ? "border-2 border-brand-orange" : "border border-[var(--border-subtle)]"}`}
                >
                  <div
                    className={`px-6 py-4 ${day.day === today ? "bg-gradient-to-r from-brand-orange to-brand-orange-dark" : "bg-brand-navy"}`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-xl text-white tracking-widest">{day.day}</h3>
                      {day.day === today && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest">
                          <Clock size={10} /> Today
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-[var(--surface-card)]">
                    {day.periods.map((period, i) => {
                      const isBreak = period.subject === "Break" || period.subject === "Lunch";
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-4 px-4 py-3 rounded-xl ${
                            isBreak
                              ? "bg-brand-orange/5 my-2 border border-brand-orange/20"
                              : "hover:bg-[var(--surface-disabled)]"
                          } transition-colors`}
                        >
                          <div className="w-20 shrink-0">
                            <div className="text-xs font-display font-bold tracking-widest text-brand-green">
                              {period.time}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div
                              className={`font-bold text-sm ${isBreak ? "text-brand-orange" : "text-[var(--text-primary)]"}`}
                            >
                              {period.subject}
                            </div>
                            {period.teacher && (
                              <div className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                                <User size={10} /> {period.teacher}
                              </div>
                            )}
                          </div>
                          {period.room && (
                            <div className="text-xs text-[var(--text-muted)] flex items-center gap-1 shrink-0">
                              <MapPin size={11} /> {period.room}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
