import { redirect } from "next/navigation";

// Evaluations are the same as exams/CBT — consolidated with the live question bank.
export default function EvaluationsPage() {
  redirect("/teacher/question-bank");
}
