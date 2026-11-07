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
import { api, logout } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { useTheme } from "@/src/theme";
import { Input } from "@/src/components/inputs";
import { Button } from "@/src/components/buttons";
import { FISLogo } from "@/components/FISLogo";
import { useToast } from "@/components/MobileToast";
import { Lock, ShieldCheck, Eye, EyeOff, LogOut } from "lucide-react-native";

/**
 * Set a new password, before anything else.
 *
 * Every account a clerk creates arrives with a temporary password that somebody
 * else has seen. The web portal has always refused to render anything but this
 * form until it is replaced; the app sent the user straight to a dashboard, so
 * the same temporary password opened the portal's data on the phone — fees,
 * results, messages — and stayed valid indefinitely.
 *
 * The server does the enforcement (middleware returns 403
 * PASSWORD_CHANGE_REQUIRED for every other route). This screen exists so that
 * refusal lands somewhere useful instead of as an error toast on a dashboard.
 */
export default function ChangePasswordScreen() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /** Matches the server's rule exactly, so the reason is not a surprise. */
  function validationError(): string | null {
    if (!currentPassword) return "Enter the password you signed in with.";
    if (newPassword.length < 12) return "Your new password must be at least 12 characters.";
    if (!/[A-Z]/.test(newPassword)) return "Include at least one capital letter.";
    if (!/[a-z]/.test(newPassword)) return "Include at least one small letter.";
    if (!/[0-9]/.test(newPassword)) return "Include at least one number.";
    if (newPassword !== confirmPassword) return "The two new passwords do not match.";
    if (newPassword === currentPassword) return "Choose a password you have not used here before.";
    return null;
  }

  async function handleSubmit() {
    const problem = validationError();
    if (problem) {
      setFormError(problem);
      haptic("warning");
      return;
    }
    setFormError(null);
    setLoading(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      haptic("success");
      toast("Password updated. Sign in with your new password.", "success");
      // The server revokes every session on a password change, including this
      // one, so there is nothing to go back to — signing in again is the path.
      await logout();
      router.replace("/login");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not change your password.";
      setFormError(message);
      haptic("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background.primary }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
          <FISLogo size={64} />
          <Text
            style={{
              color: colors.text.primary,
              fontSize: 22,
              fontWeight: "800",
              marginTop: spacing.md,
              textAlign: "center",
            }}
          >
            Choose your password
          </Text>
          <Text
            style={{
              color: colors.text.muted,
              fontSize: 13,
              marginTop: spacing.xs,
              textAlign: "center",
            }}
          >
            You signed in with a temporary password. Set your own before continuing — it keeps
            your account to yourself.
          </Text>
        </View>

        <View
          style={{
            backgroundColor: colors.surface.card,
            borderRadius: radius.lg,
            padding: spacing.lg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border.subtle,
          }}
        >
          <Input
            label="Temporary password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="The password you were given"
            secureTextEntry={!showPassword}
            leftIcon={<Lock size={16} color={colors.text.muted} />}
            rightIcon={
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                {showPassword ? (
                  <EyeOff size={16} color={colors.text.muted} />
                ) : (
                  <Eye size={16} color={colors.text.muted} />
                )}
              </TouchableOpacity>
            }
          />
          <Input
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 12 characters, with a capital and a number"
            secureTextEntry={!showPassword}
            leftIcon={<ShieldCheck size={16} color={colors.text.muted} />}
          />
          <Input
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Type it again"
            secureTextEntry={!showPassword}
            leftIcon={<Lock size={16} color={colors.text.muted} />}
          />

          {formError ? (
            <Text style={{ color: colors.danger, fontSize: 12, marginTop: spacing.sm }}>
              {formError}
            </Text>
          ) : null}

          <View style={{ marginTop: spacing.md }}>
            <Button onPress={handleSubmit} loading={loading} disabled={loading} fullWidth>
              {loading ? "Saving…" : "Set my password"}
            </Button>
          </View>

          <TouchableOpacity
            onPress={async () => {
              await logout();
              router.replace("/login");
            }}
            style={{
              marginTop: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <LogOut size={14} color={colors.text.muted} />
            <Text style={{ color: colors.text.muted, fontSize: 12 }}>Sign out instead</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
