import { brandCard, OG_SIZE, OG_CONTENT_TYPE } from "@/components/og";

export const alt = "Ykay Virtual — the online arm of the Ykay family";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OgImage() {
  return brandCard({
    eyebrow: "The Ykay family",
    title: "TWO SCHOOLS. ONE FAMILY.",
    subtitle: "Ykay Virtual: live classes, 1-on-1 tuition, exam prep — online",
    footer: "ykaycollege.edu.ng/virtual",
  });
}
