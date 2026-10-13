import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Lightweight haptics wrapper. No-ops on web.
 * Requires: npx expo install expo-haptics
 */
export function haptic(
  type: "light" | "medium" | "heavy" | "success" | "warning" | "error" = "light",
) {
  if (Platform.OS === "web") return;
  try {
    switch (type) {
      case "success":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case "warning":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case "error":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case "medium":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case "heavy":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      default:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    /* haptics unavailable — ignore */
  }
}
