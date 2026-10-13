import React, { useRef } from "react";
import { Animated, PanResponder, TouchableOpacity, View, Dimensions } from "react-native";
import { useTheme } from "@/src/theme";
import { Caption } from "@/src/components/typography";
import { haptic } from "@/lib/haptics";
import { X, Trash2 } from "lucide-react-native";

const SCREEN_W = Dimensions.get("window").width;
const SWIPE_THRESHOLD = 90;

/**
 * Wraps a card so it can be dismissed either by swiping left or by tapping the
 * X in its top-right corner.
 *
 * Deliberately built on PanResponder + the Animated API rather than
 * react-native-gesture-handler's Swipeable: RNGH requires a
 * GestureHandlerRootView at the app root, which this app does not mount. Using
 * RNGH here would have failed silently on Android — the swipe simply would not
 * fire — so this uses the primitives that work with the current app shell.
 */
export function Dismissible({
  children,
  onDismiss,
  /** Hides the corner button when you only want the swipe. */
  showCloseButton = true,
  closeLabel = "Dismiss",
}: {
  children: React.ReactNode;
  onDismiss: () => void;
  showCloseButton?: boolean;
  closeLabel?: string;
}) {
  const { colors, spacing, radius } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const height = useRef(new Animated.Value(1)).current; // 1 = natural, animates to 0
  const opacity = useRef(new Animated.Value(1)).current;

  function runDismiss(direction: -1 | 1 = -1) {
    haptic("medium");
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: direction * SCREEN_W,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss());
  }

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture once it is clearly a horizontal drag, so the
      // parent ScrollView keeps vertical scrolling.
      onMoveShouldSetPanResponder: (_evt, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderMove: (_evt, g) => {
        // Left swipe only; allow a small elastic pull to the right.
        translateX.setValue(g.dx > 0 ? g.dx * 0.25 : g.dx);
      },
      onPanResponderRelease: (_evt, g) => {
        if (g.dx < -SWIPE_THRESHOLD) {
          runDismiss(-1);
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  // Red "delete" affordance revealed as the card slides left.
  const hintOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -20, 0],
    outputRange: [1, 0.35, 0],
    extrapolate: "clamp",
  });

  return (
    <Animated.View style={{ opacity, transform: [{ scaleY: height }] }}>
      <View>
        {/* Behind-the-card hint */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: 96,
            borderRadius: radius.lg,
            backgroundColor: colors.status.errorBg,
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            opacity: hintOpacity,
          }}
        >
          <Trash2 size={18} color={colors.status.errorText} />
          <Caption style={{ color: colors.status.errorText, fontSize: 10.5 }}>Hide</Caption>
        </Animated.View>

        <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
          {children}

          {showCloseButton ? (
            <TouchableOpacity
              onPress={() => runDismiss(-1)}
              accessibilityLabel={closeLabel}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                position: "absolute",
                top: spacing.sm,
                right: spacing.sm,
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: "rgba(255,255,255,0.10)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={14} color={colors.text.muted} />
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </View>
    </Animated.View>
  );
}
