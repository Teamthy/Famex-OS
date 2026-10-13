import React from "react";
import { View, Text, ViewStyle } from "react-native";
import { useTheme } from "@/src/theme";
import { bodyFont } from "@/src/theme/typography";

type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

export interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  icon?: React.ReactNode;
  solid?: boolean;
  style?: ViewStyle;
}

export function Badge({ children, tone = "neutral", icon, solid, style }: BadgeProps) {
  const { colors, radius } = useTheme();

  const toneColor: Record<BadgeTone, string> = {
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    info: colors.info,
    accent: colors.brand.greenLight,
    neutral: colors.text.muted,
  };
  const c = toneColor[tone];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: radius.round,
        backgroundColor: solid ? c : `${c}20`,
        borderWidth: solid ? 0 : 1,
        borderColor: `${c}40`,
        ...style,
      }}
    >
      {icon}
      <Text style={{ color: solid ? colors.brand.white : c, fontSize: 10, fontWeight: "700", fontFamily: bodyFont("bold") }}>{children}</Text>
    </View>
  );
}
