/** Ykay College — typography. Anton (display) + DM Sans (body, 3 weights). */

export const Typography = {
  fontFamily: {
    display: "Anton",
    body: "DM Sans", // regular
    bodyMedium: "DM Sans Medium",
    bodyBold: "DM Sans Bold",
  },
  fontSize: {
    h1: 32,
    h2: 24,
    h3: 20,
    body: 16,
    caption: 13,
    label: 12,
    micro: 11,
  },
  fontWeight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    heavy: "800",
  },
  lineHeight: { tight: 1.1, normal: 1.5, relaxed: 1.7 },
  letterSpacing: { tight: 0.02, normal: 0, wide: 0.15 },
} as const;

/** Map a logical weight to the registered DM Sans family. */
export function bodyFont(weight?: "regular" | "medium" | "semibold" | "bold" | "heavy"): string {
  switch (weight) {
    case "bold":
    case "heavy":
      return Typography.fontFamily.bodyBold;
    case "medium":
    case "semibold":
      return Typography.fontFamily.bodyMedium;
    default:
      return Typography.fontFamily.body;
  }
}

export type Typography = typeof Typography;
