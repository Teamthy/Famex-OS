import React from "react";
import { ScrollView, TouchableOpacity, View, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "@/src/theme";
import { Body, Caption } from "@/src/components/typography";
import { bodyFont } from "@/src/theme/typography";

export interface ChipProps {
  label: string;
  selected?: boolean;
  icon?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Selectable pill — used for term/subject/child filters. */
export function Chip({ label, selected, icon, onPress, disabled, style }: ChipProps) {
  const { colors, radius, spacing } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.8}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: spacing.md - 2,
          borderRadius: radius.round,
          backgroundColor: selected ? colors.brand.green : colors.surface.card,
          borderWidth: 1,
          borderColor: selected ? colors.brand.green : colors.border.default,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {icon}
      <Caption
        style={{
          color: selected ? colors.brand.white : colors.text.secondary,
          fontFamily: bodyFont(selected ? "bold" : "medium"),
        }}
      >
        {label}
      </Caption>
    </TouchableOpacity>
  );
}

/** Horizontally scrolling row of chips. */
export function ChipRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { spacing } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.md }}
      style={style}
    >
      {children}
    </ScrollView>
  );
}

export interface SegmentedControlProps<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

/** iOS-style segmented switch for 2–4 mutually exclusive views. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedControlProps<T>) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          backgroundColor: colors.surface.card,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border.subtle,
          padding: 3,
        },
        style,
      ]}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: radius.sm + 2,
              alignItems: "center",
              backgroundColor: active ? colors.brand.green : "transparent",
            }}
          >
            <Body
              style={{
                fontSize: 13,
                fontFamily: bodyFont(active ? "bold" : "medium"),
                color: active ? colors.brand.white : colors.text.muted,
              }}
            >
              {opt.label}
            </Body>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
