/**
 * Compatibility bridge — keeps the existing flat `theme` API working while the
 * app migrates to the structured design system under `src/theme` + components.
 *
 * Values now come from the official tokens (src/theme/*), so existing screens
 * automatically pick up the correct Ykay palette, spacing & radius.
 */
import { Colors } from "@/src/theme/colors";
import { Spacing } from "@/src/theme/spacing";
import { Radius } from "@/src/theme/radius";
import { Gradients } from "@/src/theme/gradients";

export const theme = {
  colors: {
    bgPrimary: Colors.background.primary,
    bgSecondary: Colors.background.secondary,
    bgTertiary: Colors.background.tertiary,
    bgCard: Colors.background.elevated,
    bgCardHover: Colors.brand.navyLight,
    bgLight: Colors.text.primary,
    primary: Colors.brand.green,
    primaryDark: Colors.brand.greenDark,
    primaryLight: Colors.brand.greenLight,
    accent: Colors.brand.greenLight,
    secondary: Colors.brand.orange,
    secondaryDark: Colors.brand.orangeDark,
    accentSecondary: Colors.brand.orangeLight,
    textPrimary: Colors.text.primary,
    textSecondary: Colors.text.secondary,
    textMuted: Colors.text.muted,
    textFaint: Colors.text.muted,
    textGhost: "#64748b",
    textInverse: Colors.text.inverse,
    textLink: Colors.brand.greenLight,
    success: Colors.success,
    warning: Colors.warning,
    danger: Colors.danger,
    error: Colors.danger,
    info: Colors.info,
    border: "rgba(255,255,255,0.08)",
    borderDefault: "rgba(255,255,255,0.15)",
    borderStrong: "rgba(255,255,255,0.25)",
    surface: Colors.background.elevated,
    surfaceHover: Colors.brand.navyLight,
    surfaceAlt: Colors.background.secondary,
    overlay: "rgba(0,0,0,0.75)",
  },
  gradient: Gradients.hero,
  fonts: { display: "Anton", body: "DM Sans" },
  radius: { xs: Radius.xs, sm: Radius.sm, md: Radius.md, lg: Radius.lg, xl: Radius.xl, pill: Radius.round },
  spacing: Spacing,
  card: { backgroundColor: Colors.background.elevated, borderRadius: Radius.lg, padding: 16 } as const,
  buttonPrimary: { backgroundColor: Colors.brand.green, borderRadius: Radius.md, paddingVertical: 16, alignItems: "center" as const } as const,
  tabBar: {
    backgroundColor: Colors.background.elevated,
    borderTopColor: "rgba(255,255,255,0.08)",
    activeTintColor: Colors.brand.greenLight,
    inactiveTintColor: "#64748b",
  } as const,
} as const;

export type Theme = typeof theme;
