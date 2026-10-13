import React, { useEffect, useRef } from "react";
import { View, Animated, ViewStyle, StyleProp } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/src/theme";
import { Body, Caption } from "@/src/components/typography";
import { bodyFont } from "@/src/theme/typography";

function clamp(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export interface ProgressBarProps {
  /** 0–100. Values outside the range are clamped. */
  value: number;
  height?: number;
  color?: string;
  trackColor?: string;
  /** Animate width changes. */
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({
  value,
  height = 8,
  color,
  trackColor,
  animated = true,
  style,
}: ProgressBarProps) {
  const { colors, radius } = useTheme();
  const pct = clamp(value);
  const anim = useRef(new Animated.Value(animated ? 0 : pct)).current;

  useEffect(() => {
    if (!animated) {
      anim.setValue(pct);
      return;
    }
    Animated.timing(anim, {
      toValue: pct,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [pct, animated, anim]);

  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View
      style={[
        {
          height,
          borderRadius: radius.round,
          backgroundColor: trackColor ?? colors.surface.cardHover,
          overflow: "hidden",
          width: "100%",
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          height: "100%",
          width,
          borderRadius: radius.round,
          backgroundColor: color ?? colors.brand.green,
        }}
      />
    </View>
  );
}

export interface ProgressRingProps {
  /** 0–100. */
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  /** Big text in the middle. Defaults to the rounded percentage. */
  label?: string;
  /** Small text under the label. */
  caption?: string;
}

/**
 * Circular progress indicator — used for attendance rate and exam scores.
 * Built on react-native-svg (already a dependency).
 */
export function ProgressRing({
  value,
  size = 96,
  strokeWidth = 8,
  color,
  trackColor,
  label,
  caption,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const pct = clamp(value);
  const radiusPx = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radiusPx;
  const dash = (pct / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
          stroke={trackColor ?? colors.surface.cardHover}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
          stroke={color ?? colors.brand.green}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          fill="none"
          // Start the arc at 12 o'clock instead of 3 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: "center" }}>
        <Body
          tone="primary"
          style={{ fontFamily: bodyFont("bold"), fontSize: size * 0.24, lineHeight: size * 0.3 }}
        >
          {label ?? `${Math.round(pct)}%`}
        </Body>
        {caption ? <Caption style={{ fontSize: 10 }}>{caption}</Caption> : null}
      </View>
    </View>
  );
}
