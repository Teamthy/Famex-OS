import { redirect } from "next/navigation";

// E-Exams consolidated with the live CBT/exams page (this was a hardcoded mock).
export default function EExamsPage() {
  redirect("/student/exams");
}
