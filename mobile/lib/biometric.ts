import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

/**
 * Biometric helpers (Face ID / fingerprint / device PIN).
 * Requires: npx expo install expo-local-authentication
 * No-ops gracefully on web / when unavailable.
 */
export async function biometricAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    // hasHardwareAsync() resolves to a boolean, not { available }. The old
    // destructure yielded undefined, so this always returned false and
    // biometric unlock never engaged on any device.
    return await LocalAuthentication.hasHardwareAsync();
  } catch {
    return false;
  }
}

export async function biometricEnrolled(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    // Same again: isEnrolledAsync() resolves to a boolean.
    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}

export async function authenticate(reason = "Unlock Ykay College"): Promise<boolean> {
  if (Platform.OS === "web") return true;
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: "Use password",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    return res.success;
  } catch {
    return false;
  }
}
