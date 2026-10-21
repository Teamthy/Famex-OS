import { brandCard, OG_SIZE, OG_CONTENT_TYPE } from "@/components/og";

export const alt = "Famex International Schools — Excellence in Education";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OgImage() {
  return brandCard({
    eyebrow: "Famex International Schools",
    title: "EXCELLENCE IN EDUCATION.",
    subtitle: "Premium day secondary school · JSS1 to SS3",
    footer: "ykaycollege.edu.ng",
  });
}
