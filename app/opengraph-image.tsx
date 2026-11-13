import { brandCard, OG_SIZE, OG_CONTENT_TYPE } from "@/components/og";

export const alt = "FAMEX SCHOOLS — Excellence in Education";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OgImage() {
  return brandCard({
    eyebrow: "FAMEX SCHOOLS",
    title: "EXCELLENCE IN EDUCATION.",
    subtitle: "Premium day secondary school · JSS1 to SS3",
    footer: "ykaycollege.edu.ng",
  });
}
