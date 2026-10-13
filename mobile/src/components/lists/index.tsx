import React from "react";
import { TouchableOpacity, View, ViewStyle } from "react-native";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { Body, Caption } from "@/src/components/typography";
import { bodyFont } from "@/src/theme/typography";

export interface ListItemProps {
  leftIcon?: React.ReactNode;
  avatar?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  unread?: boolean;
  accentColor?: string;
  style?: ViewStyle;
}

/** Reusable list row — icon/avatar + title/subtitle + trailing node. */
export function ListItem({ leftIcon, avatar, title, subtitle, right, onPress, unread, accentColor, style }: ListItemProps) {
  const { spacing } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <Card variant={unread ? "elevated" : "default"} padding={14} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, marginBottom: spacing.xs + 2, ...style }}>
        {avatar ?? (leftIcon && <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: accentColor ? `${accentColor}20` : undefined, justifyContent: "center", alignItems: "center" }}>{leftIcon}</View>)}
        <View style={{ flex: 1 }}>
          <Body tone="primary" style={{ fontFamily: bodyFont(unread ? "bold" : "semibold") }} numberOfLines={1}>{title}</Body>
          {subtitle && <Caption style={{ marginTop: 2 }} numberOfLines={2}>{subtitle}</Caption>}
        </View>
        {right}
      </Card>
    </TouchableOpacity>
  );
}
