import { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/src/theme";
import { YkayLogo } from "@/components/YkayLogo";
import { Button } from "@/src/components/buttons";
import { haptic } from "@/lib/haptics";
import { setPref } from "@/lib/prefs";
import {
  GraduationCap,
  ClipboardCheck,
  CreditCard,
  ArrowRight,
  Check,
} from "lucide-react-native";

const { width: SCREEN_W } = Dimensions.get("window");

/**
 * Three-page welcome wizard shown to users who have never signed in.
 *
 * Each page pairs a real classroom photograph with one promise. The images are
 * the same set the login carousel uses, so the very first impression of the
 * app is consistent with the sign-in screen the user lands on next.
 *
 * Colours come exclusively from the Ykay tokens (which mirror globals.css) —
 * no new brand values are introduced here.
 */
const PAGES = [
  {
    key: "results",
    image: require("../assets/carousel/1-students.jpg"),
    icon: GraduationCap,
    eyebrow: "RESULTS & PROGRESS",
    title: "Every result,\nin your pocket",
    body: "Termly report cards, subject grades, class position and teacher remarks — the moment they are released.",
  },
  {
    key: "attendance",
    image: require("../assets/carousel/3-staff.jpg"),
    icon: ClipboardCheck,
    eyebrow: "EXAMS & ATTENDANCE",
    title: "Sit exams,\ntrack every day",
    body: "Take computer-based tests, practise past questions and follow attendance day by day. Works offline too.",
  },
  {
    key: "fees",
    image: require("../assets/carousel/2-parents.jpg"),
    icon: CreditCard,
    eyebrow: "SCHOOL FEES",
    title: "Pay fees\nwithout the queue",
    body: "Settle school fees securely by card, see every invoice and download receipts — all from your phone.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [page, setPage] = useState(0);

  const last = page === PAGES.length - 1;

  /** Leave the wizard, remembering not to show it again on this device. */
  async function finish() {
    await setPref("seenOnboarding", true);
    router.replace("/login");
  }

  function goTo(index: number) {
    scrollRef.current?.scrollTo({ x: index * SCREEN_W, animated: true });
    setPage(index);
  }

  function next() {
    haptic("light");
    if (last) {
      void finish();
    } else {
      goTo(page + 1);
    }
  }

  function onMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (i !== page) {
      setPage(i);
      haptic("light");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* ── Photo layer: parallax-free crossfade per page ── */}
      <View style={StyleSheet.absoluteFill}>
        {PAGES.map((p, i) => {
          const opacity = scrollX.interpolate({
            inputRange: [(i - 1) * SCREEN_W, i * SCREEN_W, (i + 1) * SCREEN_W],
            outputRange: [0, 1, 0],
            extrapolate: "clamp",
          });
          return (
            <Animated.View key={p.key} style={[StyleSheet.absoluteFill, { opacity }]}>
              <Image source={p.image} style={{ flex: 1, width: "100%" }} resizeMode="cover" />
            </Animated.View>
          );
        })}
      </View>

      {/* Scrim — keeps text legible over any photograph. Mirrors the
          --hero-overlay / --gradient-banner treatment used on the web. */}
      <LinearGradient
        colors={[
          "rgba(5,12,20,0.55)",
          "rgba(5,12,20,0.82)",
          "rgba(5,12,20,0.97)",
          "#050C14",
        ]}
        locations={[0, 0.45, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(78,197,77,0.06)" }]}
      />

      {/* ── Header ── */}
      <View
        style={{
          position: "absolute",
          top: 58,
          left: spacing.lg,
          right: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 5,
        }}
      >
        <YkayLogo size={34} textSize={15} />
        {!last ? (
          <TouchableOpacity
            onPress={() => {
              haptic("light");
              void finish();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: radius.round,
              backgroundColor: "rgba(255,255,255,0.10)",
              borderWidth: 1,
              borderColor: colors.border.default,
            }}
          >
            <Text
              style={{
                color: colors.text.secondary,
                fontSize: 12.5,
                fontFamily: "DM Sans Medium",
              }}
            >
              Skip
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Swipeable pages ── */}
      <Animated.ScrollView
        ref={scrollRef as never}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {PAGES.map((p) => {
          const Icon = p.icon;
          return (
            <View
              key={p.key}
              style={{
                width: SCREEN_W,
                flex: 1,
                justifyContent: "flex-end",
                paddingHorizontal: spacing.lg,
                paddingBottom: 220,
              }}
            >
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: radius.lg + 2,
                  backgroundColor: colors.brand.green,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: spacing.lg,
                  shadowColor: colors.brand.green,
                  shadowOpacity: 0.45,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 10,
                }}
              >
                <Icon size={27} color={colors.brand.white} />
              </View>

              <Text
                style={{
                  color: colors.brand.greenLight,
                  fontSize: 11,
                  letterSpacing: 2.2,
                  fontFamily: "DM Sans Bold",
                  marginBottom: spacing.sm,
                }}
              >
                {p.eyebrow}
              </Text>

              <Text
                style={{
                  color: colors.text.primary,
                  fontFamily: "Anton",
                  fontSize: 38,
                  lineHeight: 42,
                  letterSpacing: 0.2,
                }}
              >
                {p.title}
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
                {p.body}
              </Text>
            </View>
          );
        })}
      </Animated.ScrollView>

      {/* ── Footer: dots + CTA ── */}
      <View
        style={{
          position: "absolute",
          left: spacing.lg,
          right: spacing.lg,
          bottom: 46,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            marginBottom: spacing.lg,
          }}
        >
          {PAGES.map((p, i) => {
            const active = i === page;
            return (
              <TouchableOpacity
                key={p.key}
                onPress={() => goTo(i)}
                hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
              >
                <View
                  style={{
                    width: active ? 30 : 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: active ? colors.brand.green : "rgba(255,255,255,0.28)",
                  }}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <Button
          fullWidth
          size="lg"
          onPress={next}
          rightIcon={
            last ? (
              <Check size={19} color={colors.brand.white} />
            ) : (
              <ArrowRight size={19} color={colors.brand.white} />
            )
          }
        >
          {last ? "Get Started" : "Continue"}
        </Button>

        <TouchableOpacity
          onPress={() => {
            haptic("light");
            void finish();
          }}
          style={{ marginTop: spacing.md, alignSelf: "center" }}
          hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
        >
          <Text
            style={{
              color: colors.text.muted,
              fontSize: 13,
              fontFamily: "DM Sans",
            }}
          >
            Already have an account?{" "}
            <Text style={{ color: colors.brand.greenLight, fontFamily: "DM Sans Bold" }}>
              Sign in
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
