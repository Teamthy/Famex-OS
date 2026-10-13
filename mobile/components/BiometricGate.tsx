import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { authenticate, biometricEnrolled } from "@/lib/biometric";
import { logout } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { Button } from "@/src/components/buttons";
import { H2, Body } from "@/src/components/typography";
import { FadeIn } from "@/src/components/animation";
import { Fingerprint, LogOut } from "lucide-react-native";

/**
 * Quick-unlock gate. When a session exists and the device has biometrics
 * enrolled, the app prompts Face ID / fingerprint on launch instead of
 * dropping the user straight in. Falls back to password (logout → login).
 */
export function BiometricGate({ children }: { children: React.ReactNode }) {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const [state, setState] = useState<"checking" | "locked" | "unlocked" | "off">("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enrolled = await biometricEnrolled();
      if (!enrolled) { if (!cancelled) setState("off"); return; }
      const ok = await authenticate();
      if (cancelled) return;
      if (ok) { haptic("success"); setState("unlocked"); } else setState("locked");
    })();
    return () => { cancelled = true; };
  }, []);

  if (state === "off" || state === "unlocked") return <>{children}</>;

  async function tryUnlock() {
    const ok = await authenticate();
    if (ok) { haptic("success"); setState("unlocked"); } else haptic("error");
  }
  async function usePassword() {
    await logout();
    router.replace("/login");
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>
      <FadeIn>
        <View style={{ alignItems: "center", width: "100%", maxWidth: 360 }}>
          <View style={{ width: 88, height: 88, borderRadius: 26, backgroundColor: colors.brand.green, justifyContent: "center", alignItems: "center", marginBottom: spacing.lg }}>
            <Fingerprint size={44} color={colors.brand.white} />
          </View>
          <H2 style={{ textAlign: "center" }}>Ykay College is locked</H2>
          <Body style={{ textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.xxl }}>Authenticate to continue where you left off.</Body>
          <Button fullWidth size="lg" leftIcon={<Fingerprint size={18} color={colors.brand.white} />} onPress={tryUnlock}>Unlock with Biometrics</Button>
          <Button variant="ghost" onPress={usePassword} leftIcon={<LogOut size={16} color={colors.text.muted} />} style={{ marginTop: spacing.md }}>Use password instead</Button>
        </View>
      </FadeIn>
    </View>
  );
}
