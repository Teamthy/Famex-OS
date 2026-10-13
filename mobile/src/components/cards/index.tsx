import React from "react";
import { View, TouchableOpacity, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "@/src/theme";

type CardVariant = "default" | "elevated" | "interactive" | "glass" | "bordered";

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function Card({ children, variant = "default", padding = 16, style, onPress }: CardProps) {
  const { colors, radius, shadows } = useTheme();

  const variantStyle: ViewStyle =
    variant === "elevated"
      ? { backgroundColor: colors.background.elevated, ...shadows.card }
      : variant === "glass"
        ? { backgroundColor: "rgba(12,24,36,0.7)" }
        : variant === "bordered"
          ? { backgroundColor: colors.background.elevated, borderWidth: 1, borderColor: colors.border.default }
          : variant === "interactive"
            ? { backgroundColor: colors.background.elevated, borderWidth: 1, borderColor: colors.border.subtle, ...shadows.card }
            : { backgroundColor: colors.background.elevated, borderWidth: 1, borderColor: colors.border.subtle };

  const composed: StyleProp<ViewStyle> = [
    { borderRadius: radius.lg, padding },
    variantStyle,
    style,
  ];

  // `onPress` was accepted but ignored, so "interactive" cards were dead
  // to the touch. Render a touchable when a handler is supplied.
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={composed}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={composed}>{children}</View>;
}
