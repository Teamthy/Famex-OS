import React from "react";
import { View, ScrollView, TouchableOpacity, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { Badge } from "@/src/components/badges";
import { Body, Caption, Label } from "@/src/components/typography";
import { Avatar } from "@/src/components/avatar";
import { bodyFont } from "@/src/theme/typography";
import { ChevronRight, AlertCircle, CalendarRange } from "lucide-react-native";

/**
 * Shared dashboard building blocks.
 *
 * All four role dashboards previously declared their own near-identical
 * `StatCard` / `ActionRow` / `Stat` helpers, each with slightly different
 * widths ("48%" vs "47%" vs flex:1) and type sizes. Consolidating them here
 * means a metric tile looks the same whichever portal you are in, and there
 * is one place to change it.
 */

// ── Greeting ────────────────────────────────────────────────

export function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Greeting + name + optional subtitle, with an avatar on the right. */
export function DashboardGreeting({
  name,
  subtitle,
  photoUrl,
  onAvatarPress,
}: {
  name?: string | null;
  subtitle?: string | null;
  photoUrl?: string | null;
  onAvatarPress?: () => void;
}) {
  const { spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginTop: spacing.lg,
        marginBottom: spacing.lg,
      }}
    >
      <View style={{ flex: 1 }}>
        <Caption>{greetingFor()},</Caption>
        <Body
          tone="primary"
          numberOfLines={1}
          style={{ fontFamily: "Anton", fontSize: 25, lineHeight: 30, marginTop: 3 }}
        >
          {name || "—"}
        </Body>
        {subtitle ? <Caption style={{ marginTop: 3 }}>{subtitle}</Caption> : null}
      </View>

      <TouchableOpacity onPress={onAvatarPress} disabled={!onAvatarPress} activeOpacity={0.8}>
        <Avatar name={name ?? undefined} uri={photoUrl} size="md" />
      </TouchableOpacity>
    </View>
  );
}

// ── Metric tile ─────────────────────────────────────────────

export interface MetricProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  accent?: string;
  onPress?: () => void;
  /** Render the value smaller — for text values like a class name. */
  compact?: boolean;
}

/**
 * Half-width metric tile. Two per row via `MetricGrid`.
 *
 * Uses a fixed `48%` basis rather than `flex: 1` so a trailing odd tile
 * stays half-width instead of stretching across the row.
 */
export function Metric({ label, value, hint, icon, accent, onPress, compact }: MetricProps) {
  const { colors, spacing, radius } = useTheme();
  const accentColor = accent ?? colors.brand.greenLight;

  return (
    <Card
      variant="default"
      padding={spacing.md}
      onPress={onPress}
      style={{ width: "48%" }}
    >
      {icon ? (
        <View
          style={{
            width: 34,
            height: 34,
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

      <Body
        tone="primary"
        numberOfLines={1}
        style={{
          fontFamily: bodyFont("bold"),
          fontSize: compact ? 17 : 25,
          lineHeight: compact ? 23 : 30,
        }}
      >
        {value}
      </Body>
      <Caption style={{ marginTop: 3 }} numberOfLines={1}>
        {label}
      </Caption>
      {hint ? (
        <Caption style={{ marginTop: 1, fontSize: 11 }} numberOfLines={1}>
          {hint}
        </Caption>
      ) : null}
    </Card>
  );
}

/** Two-column wrap container for `Metric`. */
export function MetricGrid({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { spacing } = useTheme();
  return (
    <View
      style={[
        { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm + 2 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── Action row ──────────────────────────────────────────────

export function ActionRow({
  icon,
  label,
  hint,
  badge,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  badge?: string | number;
  onPress: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Card
      variant="default"
      padding={spacing.sm + 4}
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.sm + 2,
          backgroundColor: colors.brand.green + "1A",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>

      <View style={{ flex: 1 }}>
        <Body tone="primary" style={{ fontFamily: bodyFont("medium") }}>
          {label}
        </Body>
        {hint ? <Caption style={{ marginTop: 1 }}>{hint}</Caption> : null}
      </View>

      {badge != null && badge !== "" && Number(badge) !== 0 ? (
        <Badge tone="accent">{String(badge)}</Badge>
      ) : null}
      <ChevronRight size={18} color={colors.text.muted} />
    </Card>
  );
}

// ── Section heading ─────────────────────────────────────────

export function SectionHeading({
  title,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.sm,
        },
        style,
      ]}
    >
      <Label>{title}</Label>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Caption style={{ color: colors.brand.greenLight, fontFamily: bodyFont("medium") }}>
            {actionLabel}
          </Caption>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ── Child switcher (parent portal) ──────────────────────────

export interface ChildOption {
  id: string;
  displayName: string;
  className?: string | null;
}

/**
 * Horizontal ward selector. Highlights the active child and reports taps so
 * the dashboard can refetch scoped to that student.
 */
export function ChildSwitcher({
  children: options,
  selectedId,
  onSelect,
}: {
  children: ChildOption[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
}) {
  const { colors, spacing, radius } = useTheme();
  if (options.length < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.md }}
      style={{ marginBottom: spacing.md }}
    >
      {options.map((c) => {
        const active = c.id === selectedId;
        return (
          <TouchableOpacity
            key={c.id}
            onPress={() => onSelect(c.id)}
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingVertical: 8,
              paddingHorizontal: 10,
              paddingRight: 16,
              borderRadius: radius.round,
              backgroundColor: active ? colors.brand.green : colors.surface.card,
              borderWidth: 1,
              borderColor: active ? colors.brand.green : colors.border.default,
            }}
          >
            <Avatar
              name={c.displayName}
              size={26}
              color={active ? "rgba(255,255,255,0.25)" : colors.brand.green}
            />
            <View>
              <Caption
                style={{
                  color: active ? colors.brand.white : colors.text.primary,
                  fontFamily: bodyFont("bold"),
                  fontSize: 12.5,
                }}
              >
                {c.displayName}
              </Caption>
              {c.className ? (
                <Caption
                  style={{
                    color: active ? "rgba(255,255,255,0.85)" : colors.text.muted,
                    fontSize: 10.5,
                  }}
                >
                  {c.className}
                </Caption>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ── Inline error banner ─────────────────────────────────────

/**
 * Dashboards used to `catch {}` and render an empty screen, which is
 * indistinguishable from "you have no data". This surfaces the failure and
 * offers a retry.
 */
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        padding: spacing.md - 2,
        borderRadius: radius.md,
        backgroundColor: colors.status.errorBg,
        borderWidth: 1,
        borderColor: colors.status.errorBorder,
        marginBottom: spacing.md,
      }}
    >
      <AlertCircle size={17} color={colors.status.errorText} />
      <Caption style={{ flex: 1, color: colors.status.errorText }}>{message}</Caption>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Caption style={{ color: colors.status.errorText, fontFamily: bodyFont("bold") }}>
            Retry
          </Caption>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * "2026/2027 · Second Term" — which term the figures on this screen belong to.
 *
 * The app showed marks, invoices and attendance with no indication of the term
 * they came from, so a parent looking at a balance could not tell whether it
 * was this term's or last. Renders nothing when the term is unknown: a wrong
 * term label is worse than none.
 *
 * `estimated` marks a month-based guess (no term configured) in brand orange
 * rather than presenting it as fact.
 */
export function TermChip({
  sessionLabel,
  termLabel,
  estimated,
  style,
}: {
  sessionLabel?: string | null;
  termLabel?: string | null;
  estimated?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, spacing, radius } = useTheme();
  if (!sessionLabel || !termLabel) return null;

  const tint = estimated ? colors.brand.orange : colors.brand.greenLight;

  return (
    <View
      style={[
        {
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: spacing.sm + 2,
          paddingVertical: 4,
          borderRadius: radius.sm,
          backgroundColor: `${tint}1A`,
          borderWidth: 1,
          borderColor: `${tint}55`,
        },
        style,
      ]}
    >
      <CalendarRange size={12} color={tint} />
      <Caption style={{ color: tint, fontFamily: bodyFont("bold"), fontSize: 11 }}>
        {sessionLabel} · {termLabel}
        {estimated ? " (estimated)" : ""}
      </Caption>
    </View>
  );
}

// ── Quick actions grid ─────────────────────────────────────

export interface QuickAction {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  /** Optional tint; defaults to brand green. */
  tint?: string;
  /** Optional count badge shown at the top-right (e.g. open gradebooks). */
  badge?: string | number;
}

/**
 * Grid of primary actions (exams, reports, fees, announcements…). Gives every
 * role dashboard the same premium, tappable action surface instead of each
 * screen inventing its own list. Grid is 2 columns and wraps.
 */
export function QuickActions({ actions, style }: { actions: QuickAction[]; style?: StyleProp<ViewStyle> }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm + 2 }, style]}>
      {actions.map((a, i) => {
        const tint = a.tint ?? colors.brand.greenLight;
        return (
          <TouchableOpacity
            key={i}
            onPress={a.onPress}
            activeOpacity={0.8}
            style={{
              width: "48%",
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm + 2,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface.card,
              borderWidth: 1,
              borderColor: colors.border.subtle,
            }}
          >
            {a.badge != null && a.badge !== "" && Number(a.badge) !== 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  minWidth: 20,
                  height: 20,
                  borderRadius: 10,
                  paddingHorizontal: 5,
                  backgroundColor: colors.brand.orange,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Body tone="inverse" style={{ fontSize: 11, fontFamily: bodyFont("bold") }}>
                  {a.badge}
                </Body>
              </View>
            ) : null}
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: radius.sm + 2,
                backgroundColor: `${tint}1F`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {a.icon}
            </View>
            <Body
              tone="primary"
              numberOfLines={2}
              style={{ flex: 1, fontFamily: bodyFont("medium"), fontSize: 13.5, lineHeight: 18 }}
            >
              {a.label}
            </Body>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
