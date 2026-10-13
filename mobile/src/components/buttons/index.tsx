import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle } from "react-native";
import { useTheme } from "@/src/theme";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Button({
  children, variant = "primary", size = "md", loading, disabled, fullWidth,
  leftIcon, rightIcon, onPress, style,
}: ButtonProps) {
  const { colors, radius, typography } = useTheme();
  const isDisabled = disabled || loading;

  const bg: Record<Variant, string> = {
    primary: colors.brand.green,
    secondary: colors.brand.orange,
    outline: "transparent",
    ghost: "transparent",
  };
  const fg: Record<Variant, string> = {
    primary: colors.brand.white,
    secondary: colors.brand.white,
    outline: colors.text.primary,
    ghost: colors.text.primary,
  };

  const padV = size === "sm" ? 10 : size === "lg" ? 18 : 14;
  const fontSize = size === "sm" ? 13 : size === "lg" ? 17 : 15;

  const primaryShadow: ViewStyle =
    variant === "primary"
      ? { shadowColor: colors.brand.green, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 }
      : {};

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: padV,
        paddingHorizontal: size === "sm" ? 14 : 24,
        borderRadius: radius.md,
        backgroundColor: bg[variant],
        borderWidth: variant === "outline" ? 2 : 0,
        borderColor: variant === "outline" ? colors.text.primary : "transparent",
        opacity: isDisabled ? 0.5 : 1,
        alignSelf: fullWidth ? "stretch" : "flex-start",
        ...primaryShadow,
        ...style,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg[variant]} />
      ) : (
        <>
          {leftIcon}
          <Text style={{ color: fg[variant], fontSize, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily.bodyBold }}>
            {children}
          </Text>
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
}
