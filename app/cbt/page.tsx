import { redirect } from "next/navigation";

export const metadata = {
  title: "CBT Practice",
  description: "Sit computer-based tests from the Ykay College student portal.",
};

/** Public /cbt used to crash on Vercel (Prisma). Send visitors to login. */
export default function CbtPage() {
  redirect("/login?next=/student/exams");
}
