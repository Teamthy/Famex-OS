import { redirect } from "next/navigation";

/**
 * C-011: the public /signup page is the platform SaaS surface. A single-school
 * deployment (Ykay College itself) must not advertise tenant creation, so the
 * page is hidden unless ENABLE_PLATFORM_SIGNUP=true. The API route enforces
 * the same gate server-side — this layout only fixes the UX/navigation.
 */
export default function SignupGate({ children }: { children: React.ReactNode }) {
  if (process.env.ENABLE_PLATFORM_SIGNUP !== "true") {
    redirect("/");
  }
  return <>{children}</>;
}
