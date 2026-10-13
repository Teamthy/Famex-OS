import { brandCard, OG_SIZE, OG_CONTENT_TYPE } from "@/components/og";

export const alt = "IT education for the next generation — Ykay College";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OgImage() {
  return brandCard({
    eyebrow: "Flagship programme",
    title: "IT EDUCATION FOR THE NEXT GENERATION.",
    subtitle: "Python · AI · Cybersecurity · Microsoft Office",
    footer: "ykaycollege.edu.ng/it-education",
  });
}
