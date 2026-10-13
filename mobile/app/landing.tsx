import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/src/theme";
import { YkayLogo } from "@/components/YkayLogo";
import { Button } from "@/src/components/buttons";
import { BackgroundCarousel } from "@/src/components/carousel";
import { haptic } from "@/lib/haptics";
import { setPref } from "@/lib/prefs";
import { ArrowRight, GraduationCap, CreditCard, ClipboardCheck } from "lucide-react-native";

const CAROUSEL_IMAGES = [
  require("../assets/carousel/1-students.jpg"),
  require("../assets/carousel/5-school.jpg"),
  require("../assets/carousel/3-staff.jpg"),
];

const HIGHLIGHTS = [
  { icon: GraduationCap, label: "Results" },
  { icon: ClipboardCheck, label: "Attendance" },
  { icon: CreditCard, label: "Fees" },
];

/**
 * Welcome screen for signed-out users who have already seen the wizard.
 *
 * Kept deliberately lighter than /onboarding: one photograph, one promise,
 * one primary action — with a route back into the wizard for anyone who
 * wants the full tour again.
 */
export default function LandingScreen() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <View style={StyleSheet.absoluteFill}>
        <BackgroundCarousel images={CAROUSEL_IMAGES} intervalMs={5200} />
      </View>

      <LinearGradient
        colors={["rgba(5,12,20,0.42)", "rgba(5,12,20,0.80)", "rgba(5,12,20,0.97)", "#050C14"]}
        locations={[0, 0.4, 0.7, 0.92]}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(78,197,77,0.06)" }]}
      />

      <View style={{ flex: 1, padding: spacing.lg, paddingTop: 62, paddingBottom: 44 }}>
        <YkayLogo size={38} textSize={16} />

        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Text
            style={{
              color: colors.brand.greenLight,
              fontSize: 11,
              letterSpacing: 2.2,
              fontFamily: "DM Sans Bold",
              marginBottom: spacing.sm,
            }}
          >
            YKAY COLLEGE &amp; LEADERSHIP ACADEMY
          </Text>

          <Text
            style={{
              color: colors.text.primary,
              fontFamily: "Anton",
              fontSize: 40,
              lineHeight: 44,
            }}
          >
            Your school,{"\n"}on your phone
          </Text>

          <Text
            style={{
              color: colors.text.secondary,
              fontFamily: "DM Sans",
              fontSize: 15.5,
              lineHeight: 25,
              marginTop: spacing.md,
              maxWidth: 340,
            }}
          >
            Results, attendance, exams and school fees — for students, parents and staff.
          </Text>

          {/* Three quiet proof-points instead of a second paragraph */}
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl }}>
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <View
                key={label}
                style={{
                  flex: 1,
                  alignItems: "center",
                  gap: 7,
                  paddingVertical: spacing.md - 2,
                  borderRadius: radius.lg,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderWidth: 1,
                  borderColor: colors.border.subtle,
                }}
              >
                <Icon size={19} color={colors.brand.greenLight} />
                <Text
                  style={{
                    color: colors.text.secondary,
                    fontSize: 12,
                    fontFamily: "DM Sans Medium",
                  }}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Button
          fullWidth
          size="lg"
          onPress={() => {
            haptic("light");
            router.push("/login");
          }}
          rightIcon={<ArrowRight size={19} color={colors.brand.white} />}
          style={{ marginTop: spacing.xl }}
        >
          Sign In
        </Button>

        <TouchableOpacity
          onPress={async () => {
            haptic("light");
            // Let the user re-run the tour on demand.
            await setPref("seenOnboarding", false);
            router.push("/onboarding");
          }}
          style={{ marginTop: spacing.md, alignSelf: "center" }}
          hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
        >
          <Text style={{ color: colors.text.muted, fontSize: 13, fontFamily: "DM Sans" }}>
            New here?{" "}
            <Text style={{ color: colors.brand.greenLight, fontFamily: "DM Sans Bold" }}>
              Take the tour
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
