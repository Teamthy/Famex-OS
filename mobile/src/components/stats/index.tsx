import React from "react";
import { View, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { Body, Caption, Label } from "@/src/components/typography";
import { bodyFont } from "@/src/theme/typography";

type Trend = "up" | "down" | "flat";

export interface StatCardProps {
  /** Short uppercase label, e.g. "ATTENDANCE". */
  label: string;
  /** The headline figure, e.g. "94%". */
  value: string | number;
  /** Optional supporting line under the value. */
  hint?: string;
  icon?: React.ReactNode;
  /** Accent colour for the icon chip. Defaults to brand green. */
  accent?: string;
  trend?: Trend;
  trendValue?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Dashboard metric tile. Used across all four role dashboards so a
 * "number that matters" always looks the same everywhere in the app.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
  trend,
  trendValue,
  onPress,
  style,
}: StatCardProps) {
  const { colors, spacing, radius } = useTheme();
  const accentColor = accent ?? colors.brand.greenLight;

  const trendColor =
    trend === "up" ? colors.success : trend === "down" ? colors.danger : colors.text.muted;
  const trendGlyph = trend === "up" ? "▲" : trend === "down" ? "▼" : "•";

  return (
    <Card
      variant="default"
      padding={spacing.md}
      onPress={onPress}
      style={[{ flex: 1, minWidth: 150 }, style] as StyleProp<ViewStyle>}
    >
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.sm + 2,
            backgroundColor: accentColor + "1F",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.sm,
          }}
        >
          {icon}
        </View>
      ) : null}

      <Label style={{ marginBottom: 2 }}>{label}</Label>

      <Body
        tone="primary"
        style={{ fontFamily: bodyFont("bold"), fontSize: 26, lineHeight: 32 }}
      >
        {value}
      </Body>

      {trend && trendValue ? (
        <Caption style={{ color: trendColor, marginTop: 2 }}>
          {trendGlyph} {trendValue}
        </Caption>
      ) : null}

      {hint ? <Caption style={{ marginTop: 2 }}>{hint}</Caption> : null}
    </Card>
  );
}

/** Two-column responsive grid for StatCards. */
export function StatGrid({ children, gap }: { children: React.ReactNode; gap?: number }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: gap ?? spacing.sm + 2 }}>
      {children}
    </View>
  );
}
