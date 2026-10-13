import { brandCard, OG_SIZE, OG_CONTENT_TYPE } from "@/components/og";

export const alt = "Admissions open at Ykay College — apply online";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OgImage() {
  return brandCard({
    eyebrow: "Admissions",
    title: "ADMISSIONS OPEN.",
    subtitle: "JSS1 to SS3 · Apply online and track your application",
    footer: "ykaycollege.edu.ng/admissions",
  });
}
