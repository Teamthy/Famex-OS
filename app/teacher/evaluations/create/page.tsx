import { redirect } from "next/navigation";

// Exam/evaluation creation lives in the CBT center.
export default function CreateEvaluationPage() {
  redirect("/teacher/cbt-center");
}
