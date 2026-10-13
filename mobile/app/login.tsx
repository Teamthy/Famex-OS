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
import { login, logout } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { useTheme } from "@/src/theme";
import { Input } from "@/src/components/inputs";
import { Button } from "@/src/components/buttons";
import { BackgroundCarousel } from "@/src/components/carousel";
import { YkayLogo } from "@/components/YkayLogo";
import { useToast } from "@/components/MobileToast";
import { Mail, Lock, ArrowRight, ShieldCheck, Eye, EyeOff, WifiOff } from "lucide-react-native";

const ALLOWED_ROLES = ["STUDENT", "IT_STUDENT", "PARENT", "TEACHER", "HOD", "ADMIN"];

// 5-image carousel: students, parents, staff, admin, school life.
const CAROUSEL_IMAGES = [
  require("../assets/carousel/1-students.jpg"),
  require("../assets/carousel/2-parents.jpg"),
  require("../assets/carousel/3-staff.jpg"),
  require("../assets/carousel/4-admin.jpg"),
  require("../assets/carousel/5-school.jpg"),
];

export default function LoginScreen() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      // Inline error instead of a modal Alert — the old flow fired a toast AND
      // an OS dialog for the same mistake, which meant two dismissals.
      setFormError("Enter both your email and password.");
      haptic("warning");
      return;
    }
    setFormError(null);
    setLoading(true);
    try {
      const { user } = await login(email.trim(), password);
      if (!ALLOWED_ROLES.includes(user.role)) {
        await logout();
        // Be specific about the role so a Bursar or Director isn't left wondering
        // whether their account is broken — it's fine, it's just web-managed.
        const roleName = user.role?.replaceAll("_", " ").toLowerCase() || "this account";
        setFormError(
          `${roleName} access is managed from the web portal — please sign in on a computer.`,
        );
        haptic("error");
        return;
      }
      haptic("success");
      toast("Signed in successfully.", "success");
      if (user.role === "TEACHER" || user.role === "HOD") router.replace("/(teacher)/dashboard");
      else if (user.role === "PARENT") router.replace("/(parent)/dashboard");
      else if (user.role === "ADMIN") router.replace("/(admin)/dashboard");
      else router.replace("/(student)/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid email or password.";
      setFormError(msg);
      haptic("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Photography behind everything */}
      <View style={StyleSheet.absoluteFill}>
        <BackgroundCarousel images={CAROUSEL_IMAGES} />
      </View>

      {/* Scrim: light at the top so faces stay visible, solid at the bottom so
          the form has a calm, high-contrast surface to sit on. */}
      <LinearGradient
        colors={[
          "rgba(5,12,20,0.35)",
          "rgba(5,12,20,0.72)",
          "rgba(5,12,20,0.95)",
          "#050C14",
        ]}
        locations={[0, 0.34, 0.62, 0.86]}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(78,197,77,0.05)" }]}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "flex-end",
            padding: spacing.lg,
            paddingTop: 96,
            paddingBottom: 40,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Brand + welcome ── */}
          <View style={{ marginBottom: spacing.xl }}>
            <YkayLogo size={46} textSize={19} />

            <Text
              style={{
                color: colors.text.primary,
                fontFamily: "Anton",
                fontSize: 34,
                lineHeight: 38,
                marginTop: spacing.lg,
              }}
            >
              Welcome back
            </Text>
            <Text
              style={{
                color: colors.text.secondary,
                fontFamily: "DM Sans",
                fontSize: 15,
                lineHeight: 23,
                marginTop: 6,
                maxWidth: 320,
              }}
            >
              Sign in to your Ykay College portal.
            </Text>
          </View>

          {/* ── Form ── */}
          <View style={{ gap: spacing.md }}>
            <Input
              label="Email"
              placeholder="you@ykaycollege.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (formError) setFormError(null);
              }}
              leftIcon={<Mail size={18} color={colors.text.muted} />}
            />

            <Input
              label="Password"
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              autoComplete="password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (formError) setFormError(null);
              }}
              onSubmitEditing={handleLogin}
              returnKeyType="go"
              leftIcon={<Lock size={18} color={colors.text.muted} />}
              rightIcon={
                <TouchableOpacity
                  onPress={() => setShowPassword((s) => !s)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={colors.brand.greenLight} />
                  ) : (
                    <Eye size={18} color={colors.text.muted} />
                  )}
                </TouchableOpacity>
              }
            />
          </View>

          {/* One shared error slot, so a failure reads in a single place */}
          {formError ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginTop: spacing.md,
                padding: spacing.sm + 2,
                borderRadius: radius.md,
                backgroundColor: colors.status.errorBg,
                borderWidth: 1,
                borderColor: colors.status.errorBorder,
              }}
            >
              <WifiOff size={15} color={colors.status.errorText} />
              <Text
                style={{
                  flex: 1,
                  color: colors.status.errorText,
                  fontFamily: "DM Sans",
                  fontSize: 13,
                }}
              >
                {formError}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={() => router.push("/forgot-password")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ alignSelf: "flex-end", marginTop: spacing.md }}
          >
            <Text
              style={{
                color: colors.brand.greenLight,
                fontSize: 13.5,
                fontFamily: "DM Sans Medium",
              }}
            >
              Forgot password?
            </Text>
          </TouchableOpacity>

          <Button
            fullWidth
            size="lg"
            loading={loading}
            onPress={handleLogin}
            rightIcon={!loading ? <ArrowRight size={19} color={colors.brand.white} /> : undefined}
            style={{ marginTop: spacing.lg }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </Button>

          {/* ── Trust footer ── */}
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
            <Text style={{ color: colors.text.muted, fontSize: 11.5, fontFamily: "DM Sans" }}>
              Secure access for students, parents &amp; staff
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
