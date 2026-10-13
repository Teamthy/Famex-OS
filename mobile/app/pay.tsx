import { useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body } from "@/src/components/typography";
import { Button } from "@/src/components/buttons";
import { useToast } from "@/components/MobileToast";
import { ActivityIndicator } from "react-native";
import { CheckCircle2, X } from "lucide-react-native";

export default function PayScreen() {
  const { url, reference } = useLocalSearchParams<{ url: string; reference: string }>();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const { toast } = useToast();
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);

  function onNav(navState: any) {
    const u: string = navState.url || "";
    if (!done && (u.includes("verify=") || u.includes("status=success") || u.includes("parent/fees"))) {
      setDone(true);
      toast("Payment received. We’re verifying it now.", "success");
    }
  }

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary, justifyContent: "center", alignItems: "center", padding: spacing.lg }}>
        <CheckCircle2 size={60} color={colors.success} />
        <H2 style={{ marginTop: spacing.md }}>Payment received</H2>
        <Body style={{ textAlign: "center", marginTop: spacing.xs }}>Your payment is being verified. Your invoice will update shortly.{"\n"}Ref: {reference}</Body>
        <Button variant="primary" size="lg" style={{ marginTop: spacing.xxl }} onPress={() => router.replace("/(parent)/fees")}>Back to Fees</Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: 52, paddingBottom: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border.subtle }}>
        <Body tone="primary" style={{ fontFamily: "DM Sans Bold" }}>Secure Payment</Body>
        <X size={22} color={colors.text.muted} onPress={() => router.back()} />
      </View>
      {loading && (
        <View style={{ position: "absolute", top: "50%", left: 0, right: 0, alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.brand.greenLight} />
          <Body style={{ marginTop: spacing.sm + 2 }}>Loading secure checkout…</Body>
        </View>
      )}
      <WebView source={{ uri: url }} onNavigationStateChange={onNav} onLoadEnd={() => setLoading(false)} style={{ flex: 1, backgroundColor: colors.background.primary }} />
    </View>
  );
}
