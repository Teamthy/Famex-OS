import { View, Text, Image } from "react-native";
import { Colors } from "@/src/theme/colors";

/**
 * Reusable Ykay College brand mark — logo image + wordmark.
 * Uses assets/icon.png (replace with the designer's final logo anytime).
 *
 * The mark renders as a clean square with square corners (no rounded
 * border-radius) and no shadow, so it sits crisply on any background. If the
 * source asset ever carries a white/rounded backing, that should be removed in
 * the asset itself — the component intentionally adds no background, rounding
 * or elevation of its own.
 */
export function YkayLogo({ size = 42, showText = true, textSize = 18 }: { size?: number; showText?: boolean; textSize?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Image
        source={require("../assets/icon.png")}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
      {showText && (
        <Text style={{ color: Colors.text.primary, fontSize: textSize, fontWeight: "800", letterSpacing: 0.3, fontFamily: "Anton" }} allowFontScaling={false}>
          Ykay College
        </Text>
      )}
    </View>
  );
}

/** The brand mark alone (no wordmark), rendered as a clean square, no shadow. */
export function YkayCrest({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={require("../assets/icon.png")}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}
