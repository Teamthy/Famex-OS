import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { requestPasswordReset } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Card, Input, Button, H3, Body, Caption } from "@/src/components";
import { YkayLogo } from "@/components/YkayLogo";
import { useToast } from "@/components/MobileToast";
import { Mail, ArrowLeft, ArrowRight, MailCheck, ShieldCheck } from "lucide-react-native";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function handleSubmit() {
    if (!emailValid) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      // Always a success state — the backend deliberately doesn't reveal
      // whether the address exists, so neither do we.
      setSent(true);
      toast("Reset link sent if the email is registered.", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send reset link.";
      setError(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <LinearGradient
        colors={["#050C14", "#0A1C16", "#050C14"]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: spacing.lg,
            paddingTop: 72,
            paddingBottom: 40,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: spacing.xl,
              alignSelf: "flex-start",
            }}
          >
            <ArrowLeft size={18} color={colors.text.muted} />
            <Caption>Back to sign in</Caption>
          </TouchableOpacity>

          <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
            <YkayLogo size={56} textSize={22} />
          </View>

          {sent ? (
            <Card variant="bordered" style={{ padding: spacing.lg, alignItems: "center" }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radius.xl,
                  backgroundColor: colors.status.successBg,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: spacing.md,
                }}
              >
                <MailCheck size={30} color={colors.success} />
              </View>

              <H3 style={{ textAlign: "center" }}>Check your email</H3>
              <Body style={{ textAlign: "center", marginTop: spacing.sm }}>
                If{" "}
                <Text style={{ color: colors.text.primary, fontFamily: "DM Sans Bold" }}>
                  {email.trim().toLowerCase()}
                </Text>{" "}
                is registered, a reset link is on its way. It expires in 30 minutes.
              </Body>

              <Button
                fullWidth
                size="lg"
                onPress={() => router.replace("/login")}
                style={{ marginTop: spacing.xl }}
              >
                Back to Sign In
              </Button>

              <TouchableOpacity
                onPress={() => {
                  setSent(false);
                  setEmail("");
                }}
                style={{ marginTop: spacing.md }}
              >
                <Caption tone="accent">Use a different email</Caption>
              </TouchableOpacity>
            </Card>
          ) : (
            <Card variant="bordered" style={{ padding: spacing.lg }}>
              <H3>Reset your password</H3>
              <Body style={{ marginTop: 4, marginBottom: spacing.lg }}>
                Enter the email linked to your Ykay College portal account and we&apos;ll send
                you a secure reset link.
              </Body>

              <Input
                label="Email"
                placeholder="you@ykaycollege.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (error) setError(null);
                }}
                onSubmitEditing={handleSubmit}
                returnKeyType="send"
                error={error ?? undefined}
                leftIcon={<Mail size={18} color={colors.text.muted} />}
              />

              <Button
                fullWidth
                size="lg"
                loading={loading}
                disabled={!emailValid}
                onPress={handleSubmit}
                rightIcon={
                  !loading ? <ArrowRight size={18} color={colors.brand.white} /> : undefined
                }
                style={{ marginTop: spacing.xl }}
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </Button>
            </Card>
          )}

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
            <Caption style={{ fontSize: 11 }}>Links expire after 30 minutes</Caption>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
