import { redirect } from "next/navigation";

export default function TeacherAttendanceRedirectPage() {
  redirect("/teacher/class/attendance");
}
