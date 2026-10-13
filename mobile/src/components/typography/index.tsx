import React from "react";
import { Text, TextProps } from "react-native";
import { useTheme } from "@/src/theme";
import { bodyFont } from "@/src/theme/typography";

type Tone = "primary" | "secondary" | "muted" | "accent" | "inverse";

function toneColor(tone: Tone, colors: ReturnType<typeof useTheme>["colors"]): string {
  switch (tone) {
    case "secondary": return colors.text.secondary;
    case "muted": return colors.text.muted;
    case "accent": return colors.brand.greenLight;
    case "inverse": return colors.text.inverse;
    default: return colors.text.primary;
  }
}

export function H1({ children, tone = "primary", style, ...rest }: { children: React.ReactNode; tone?: Tone } & TextProps) {
  const { typography, colors } = useTheme();
  return <Text style={[{ fontFamily: typography.fontFamily.display, fontSize: typography.fontSize.h1, color: toneColor(tone, colors), lineHeight: typography.fontSize.h1 * typography.lineHeight.tight, letterSpacing: typography.letterSpacing.tight }, style]} {...rest}>{children}</Text>;
}

export function H2({ children, tone = "primary", style, ...rest }: { children: React.ReactNode; tone?: Tone } & TextProps) {
  const { typography, colors } = useTheme();
  return <Text style={[{ fontFamily: typography.fontFamily.display, fontSize: typography.fontSize.h2, color: toneColor(tone, colors), lineHeight: typography.fontSize.h2 * typography.lineHeight.tight }, style]} {...rest}>{children}</Text>;
}

export function H3({ children, tone = "primary", style, ...rest }: { children: React.ReactNode; tone?: Tone } & TextProps) {
  const { typography, colors } = useTheme();
  return <Text style={[{ fontFamily: bodyFont("bold"), fontSize: typography.fontSize.h3, color: toneColor(tone, colors) }, style]} {...rest}>{children}</Text>;
}

export function Body({ children, tone = "secondary", style, ...rest }: { children: React.ReactNode; tone?: Tone } & TextProps) {
  const { typography, colors } = useTheme();
  return <Text style={[{ fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.body, color: toneColor(tone, colors), lineHeight: typography.fontSize.body * typography.lineHeight.relaxed }, style]} {...rest}>{children}</Text>;
}

export function Caption({ children, tone = "muted", style, ...rest }: { children: React.ReactNode; tone?: Tone } & TextProps) {
  const { typography, colors } = useTheme();
  return <Text style={[{ fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.caption, color: toneColor(tone, colors) }, style]} {...rest}>{children}</Text>;
}

export function Label({ children, tone = "muted", style, ...rest }: { children: React.ReactNode; tone?: Tone } & TextProps) {
  const { typography, colors } = useTheme();
  return <Text style={[{ fontFamily: bodyFont("medium"), fontSize: typography.fontSize.label, color: toneColor(tone, colors), textTransform: "uppercase", letterSpacing: typography.letterSpacing.wide }, style]} {...rest}>{children}</Text>;
}
