import { useEffect, useRef } from "react";
import { Animated, ViewStyle } from "react-native";
import React from "react";

/**
 * Fade + slide-up entrance animation. Wrap any content to animate it in on mount.
 * <FadeIn delay={80}><Card>…</Card></FadeIn>
 */
export function FadeIn({
  children,
  delay = 0,
  duration = 340,
  distance = 14,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration, delay, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, delay, duration]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], ...style }}>
      {children}
    </Animated.View>
  );
}

/** Staggered list entrance — children appear one after another. */
export function Stagger({ children, itemDelay = 60, baseDelay = 0 }: { children: React.ReactNode[]; itemDelay?: number; baseDelay?: number }) {
  return (
    <>
      {React.Children.toArray(children).map((child, i) => (
        <FadeIn key={i} delay={baseDelay + i * itemDelay}>{child}</FadeIn>
      ))}
    </>
  );
}
