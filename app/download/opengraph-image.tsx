import { brandCard, OG_SIZE, OG_CONTENT_TYPE } from "@/components/og";

export const alt = "Install the Ykay College app — iPhone and Android";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OgImage() {
  return brandCard({
    eyebrow: "Get the app",
    title: "THE SCHOOL IN YOUR POCKET.",
    subtitle: "Install instantly from the website — no app store needed",
    footer: "ykaycollege.edu.ng/download",
  });
}
