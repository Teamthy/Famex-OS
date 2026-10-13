import React from "react";
import {
  View,
  ScrollView,
  ViewStyle,
  TouchableOpacity,
  StyleProp,
  type ScrollViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { Body, Caption } from "@/src/components/typography";
import { bodyFont } from "@/src/theme/typography";
import { ChevronLeft } from "lucide-react-native";

/**
 * Shared layout primitives.
 *
 * Every screen previously hand-rolled `paddingTop: 56` (or 60) and ignored the
 * device's safe-area insets, so content could sit under a notch or dynamic
 * island on modern phones and headers looked different from screen to screen.
 * `Screen` now respects the top inset by default and `AppBar` gives every
 * screen the same premium back/heading header. One place to change it.
 */

/** Full screen wrapper with the brand background and safe-area top padding. */
export function Screen({
  children,
  scroll = true,
  style,
  padding,
  safeTop = true,
  refreshControl,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  padding?: number;
  /** Whether to offset the top by the safe-area inset (default true). */
  safeTop?: boolean;
  /** Optional RefreshControl to attach to the scroll view. */
  refreshControl?: ScrollViewProps["refreshControl"];
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = safeTop ? (insets.top || 8) + spacing.sm : 0;
  const content = (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        padding: padding ?? spacing.lg,
        paddingTop: padding !== undefined ? padding : topPad,
        ...style,
      }}
    >
      {children}
    </View>
  );
  if (scroll)
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background.primary }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {content}
      </ScrollView>
    );
  return content;
}

/**
 * Premium screen header. Back button (optional), title + optional subtitle.
 * Uses the safe-area top inset so it never collides with the status bar.
 */
export function AppBar({
  title,
  subtitle,
  onBack,
  right,
  style,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingTop: insets.top || 8,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.md,
          backgroundColor: colors.background.primary,
        },
        style,
      ]}
    >
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.sm + 2,
            backgroundColor: colors.surface.card,
            borderWidth: 1,
            borderColor: colors.border.subtle,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronLeft size={20} color={colors.text.primary} />
        </TouchableOpacity>
      ) : null}
      <View style={{ flex: 1 }}>
        <Body
          tone="primary"
          numberOfLines={1}
          style={{ fontFamily: bodyFont("bold"), fontSize: 18, lineHeight: 24 }}
        >
          {title}
        </Body>
        {subtitle ? (
          <Caption numberOfLines={1} style={{ marginTop: 1 }}>
            {subtitle}
          </Caption>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Container({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={{ width: "100%", ...style }}>{children}</View>;
}

export function Section({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { spacing } = useTheme();
  return <View style={{ marginBottom: spacing.lg, ...style }}>{children}</View>;
}

export function Row({
  children,
  gap = 8,
  align = "center",
  justify = "flex-start",
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  align?: "flex-start" | "center" | "flex-end";
  justify?: "flex-start" | "center" | "flex-end" | "space-between";
  style?: ViewStyle;
}) {
  return <View style={{ flexDirection: "row", alignItems: align, justifyContent: justify, gap, ...style }}>{children}</View>;
}

export function Column({ children, gap = 8, align = "stretch", style }: { children: React.ReactNode; gap?: number; align?: "flex-start" | "center" | "stretch"; style?: ViewStyle }) {
  return <View style={{ flexDirection: "column", gap, alignItems: align, ...style }}>{children}</View>;
}

export function Spacer({ size = 16 }: { size?: number }) {
  return <View style={{ width: size, height: size }} />;
}

export function Divider({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={{ height: 1, width: "100%", backgroundColor: colors.border.subtle, ...style }} />;
}
