import React from "react";
import { TouchableOpacity, View, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "@/src/theme";
import { Body, Caption } from "@/src/components/typography";
import { bodyFont } from "@/src/theme/typography";

export type NotificationTone = "info" | "success" | "warning" | "danger" | "neutral";

export interface NotificationRowProps {
  title: string;
  message?: string;
  /** Pre-formatted relative time, e.g. "2h ago". */
  time?: string;
  icon?: React.ReactNode;
  tone?: NotificationTone;
  unread?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * A single announcement / alert row. Unread items get a tinted surface and a
 * dot so a parent can scan the list and see what's new at a glance.
 */
export function NotificationRow({
  title,
  message,
  time,
  icon,
  tone = "neutral",
  unread,
  onPress,
  style,
}: NotificationRowProps) {
  const { colors, spacing, radius } = useTheme();

  const toneColor: Record<NotificationTone, string> = {
    info: colors.info,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    neutral: colors.brand.greenLight,
  };
  const accent = toneColor[tone];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      style={[
        {
          flexDirection: "row",
          gap: spacing.sm + 2,
          padding: spacing.md - 2,
          borderRadius: radius.lg,
          backgroundColor: unread ? colors.surface.cardHover : colors.background.elevated,
          borderWidth: 1,
          borderColor: unread ? accent + "55" : colors.border.subtle,
        },
        style,
      ]}
    >
      {icon ? (
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.sm + 2,
            backgroundColor: accent + "1F",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
          <Body
            tone="primary"
            style={{ flex: 1, fontFamily: bodyFont(unread ? "bold" : "medium"), fontSize: 15 }}
          >
            {title}
          </Body>
          {unread ? (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: accent,
                marginTop: 6,
              }}
            />
          ) : null}
        </View>

        {message ? (
          <Caption tone="secondary" style={{ marginTop: 2 }} numberOfLines={2}>
            {message}
          </Caption>
        ) : null}

        {time ? <Caption style={{ marginTop: 4, fontSize: 11 }}>{time}</Caption> : null}
      </View>
    </TouchableOpacity>
  );
}
