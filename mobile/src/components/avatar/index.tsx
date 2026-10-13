import React from "react";
import { View, Image, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "@/src/theme";
import { Body } from "@/src/components/typography";
import { bodyFont } from "@/src/theme/typography";

type AvatarSize = "sm" | "md" | "lg" | "xl";

const SIZES: Record<AvatarSize, number> = { sm: 32, md: 44, lg: 64, xl: 88 };

export interface AvatarProps {
  /** Full name — initials are derived from it. */
  name?: string;
  /** Remote or local photo. Falls back to initials when absent or on error. */
  uri?: string | null;
  size?: AvatarSize | number;
  /** Background for the initials fallback. Defaults to brand green. */
  color?: string;
  /** Small coloured dot (e.g. online / present). */
  status?: "success" | "warning" | "danger" | null;
  style?: StyleProp<ViewStyle>;
}

function initialsOf(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function Avatar({ name, uri, size = "md", color, status, style }: AvatarProps) {
  const { colors, radius } = useTheme();
  const [failed, setFailed] = React.useState(false);

  const px = typeof size === "number" ? size : SIZES[size];
  // Squircle look matches the card language rather than a hard circle.
  const corner = Math.round(px * 0.3);
  const showImage = !!uri && !failed;

  const dotColor =
    status === "success"
      ? colors.success
      : status === "warning"
        ? colors.warning
        : status === "danger"
          ? colors.danger
          : null;

  return (
    <View style={[{ width: px, height: px }, style]}>
      {showImage ? (
        <Image
          source={{ uri: uri as string }}
          onError={() => setFailed(true)}
          style={{ width: px, height: px, borderRadius: corner, backgroundColor: colors.surface.card }}
        />
      ) : (
        <View
          style={{
            width: px,
            height: px,
            borderRadius: corner,
            backgroundColor: color ?? colors.brand.green,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Body
            style={{
              color: colors.brand.white,
              fontFamily: bodyFont("bold"),
              fontSize: px * 0.4,
              lineHeight: px * 0.5,
            }}
          >
            {initialsOf(name)}
          </Body>
        </View>
      )}

      {dotColor ? (
        <View
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: Math.max(10, px * 0.26),
            height: Math.max(10, px * 0.26),
            borderRadius: radius.round,
            backgroundColor: dotColor,
            borderWidth: 2,
            borderColor: colors.background.primary,
          }}
        />
      ) : null}
    </View>
  );
}
