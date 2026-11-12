import { redirect } from "next/navigation";

/** Keep the old route useful without displaying an unverified release-history feed. */
export default function WhatsNewPage() {
  redirect("/news-events");
}
