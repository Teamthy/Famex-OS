import { redirect } from "next/navigation";

export default function CbtSubjectPage() {
  redirect("/login?next=/student/exams");
}
