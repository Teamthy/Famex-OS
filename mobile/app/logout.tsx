import { useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { logout } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption } from "@/src/components/typography";
import { Button } from "@/src/components/buttons";
import { Avatar } from "@/src/components/avatar";
import { useToast } from "@/components/MobileToast";
import { useSession } from "@/lib/useSession";
import { LogOut, ShieldCheck, ArrowLeft, WifiOff } from "lucide-react-native";

/**
 * Dedicated sign-out screen with an explicit confirmation.
 *
 * Sign-out used to be a bare button that fired immediately (or an OS Alert),
 * which is easy to hit by accident — and on a shared school device it drops
 * whatever the user was doing. This states who is signing out and what it
 * means before doing it.
 */
export default function LogoutScreen() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { toast } = useToast();
  const { user } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      haptic("warning");
      await logout();
      toast("Signed out.", "info");
      router.replace("/login");
    } catch (err) {
      // logout() clears the local token even if the network call fails, so the
      // user is signed out locally regardless — say so rather than trapping them.
      setError(err instanceof Error ? err.message : "Could not reach the server.");
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background.primary }}
      contentContainerStyle={{
        flexGrow: 1,
        padding: spacing.lg,
        paddingTop: 60,
        paddingBottom: 40,
      }}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.xl }}
      >
        <ArrowLeft size={20} color={colors.text.muted} />
        <Caption>Back</Caption>
      </TouchableOpacity>

      <View style={{ flex: 1, justifyContent: "center" }}>
        <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
          <View
            style={{
              width: 68,
              height: 68,
              borderRadius: radius.xl,
              backgroundColor: colors.status.errorBg,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: spacing.lg,
            }}
          >
            <LogOut size={30} color={colors.status.errorText} />
          </View>

          <H2 style={{ textAlign: "center" }}>Sign out?</H2>
          <Body style={{ textAlign: "center", marginTop: spacing.sm, maxWidth: 300 }}>
            You&apos;ll need your email and password to sign back in.
          </Body>
        </View>

        {user ? (
          <Card
            variant="default"
            padding={spacing.md}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              marginBottom: spacing.lg,
            }}
          >
            <Avatar name={user.name} size="md" />
            <View style={{ flex: 1 }}>
              <Body tone="primary" style={{ fontFamily: "DM Sans Bold" }} numberOfLines={1}>
                {user.name}
              </Body>
              <Caption numberOfLines={1}>{user.email}</Caption>
            </View>
          </Card>
        ) : null}

        {error ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              padding: spacing.sm + 2,
              borderRadius: radius.md,
              backgroundColor: colors.status.warningBg,
              borderWidth: 1,
              borderColor: colors.status.warningBorder,
              marginBottom: spacing.md,
            }}
          >
            <WifiOff size={15} color={colors.status.warningText} />
            <Caption style={{ flex: 1, color: colors.status.warningText }}>
              {error} You have been signed out on this device.
            </Caption>
          </View>
        ) : null}

        <Button
          fullWidth
          size="lg"
          loading={busy}
          onPress={confirm}
          leftIcon={!busy ? <LogOut size={18} color={colors.brand.white} /> : undefined}
          style={{ backgroundColor: colors.danger }}
        >
          {busy ? "Signing out…" : "Yes, sign me out"}
        </Button>

        <Button
          fullWidth
          size="lg"
          variant="outline"
          onPress={() => router.back()}
          style={{ marginTop: spacing.sm + 2 }}
        >
          Cancel
        </Button>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: spacing.xl,
          }}
        >
          <ShieldCheck size={13} color={colors.text.muted} />
          <Caption style={{ fontSize: 11 }}>Your data stays safe on the school portal</Caption>
        </View>
      </View>
    </ScrollView>
  );
}
