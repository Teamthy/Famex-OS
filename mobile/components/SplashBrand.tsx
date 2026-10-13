import React, { useEffect, useRef } from "react";
import { View, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/src/theme/colors";
import { Gradients } from "@/src/theme/gradients";
import { YkayCrest } from "@/components/YkayLogo";

/**
 * Branded launch state.
 *
 * Replaces the bare ActivityIndicator that used to show while the session
 * resolves. The first thing a user sees is the Ykay crest on the brand
 * gradient with a soft expanding brand ring and a gentle shimmer line — a
 * calm, premium first impression rather than a grey spinner.
 *
 * Colours come exclusively from the Ykay tokens.
 */
export function SplashBrand({ tagline = "Your school, on the go" }: { tagline?: string }) {
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(14)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Soft expanding brand ring behind the crest.
    const ringLoop = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 2200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    ringLoop.start();

    // Shimmering progress line sweeping across the bottom.
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: -1,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    shimmerLoop.start();

    return () => {
      ringLoop.stop();
      shimmerLoop.stop();
    };
  }, [fade, lift, ring, shimmer]);

  return (
    <LinearGradient colors={[...Gradients.hero]} style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {/* Expanding brand ring behind the crest */}
        <Animated.View
          style={{
            position: "absolute",
            width: 150,
            height: 150,
            borderRadius: 75,
            borderWidth: 1.5,
            borderColor: "rgba(78,197,77,0.5)",
            opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
            transform: [
              {
                scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.5] }),
              },
            ],
          }}
        />

        <Animated.View style={{ opacity: fade, transform: [{ translateY: lift }] }}>
          {/* Clean square mark — no rounded tile, no shadow (per brand note). */}
          <View
            style={{
              width: 88,
              height: 88,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <YkayCrest size={72} />
          </View>
        </Animated.View>

        <Animated.Text
          style={{
            opacity: fade,
            color: Colors.text.primary,
            fontFamily: "Anton",
            fontSize: 24,
            letterSpacing: 1.2,
            marginTop: 26,
          }}
        >
          Ykay College
        </Animated.Text>
        <Animated.Text
          style={{
            opacity: fade,
            color: Colors.brand.greenLight,
            fontFamily: "DM Sans",
            fontSize: 12,
            letterSpacing: 3.2,
            marginTop: 8,
          }}
        >
          &amp; LEADERSHIP ACADEMY
        </Animated.Text>

        <Animated.Text
          style={{
            opacity: fade,
            color: Colors.text.muted,
            fontFamily: "DM Sans",
            fontSize: 13,
            marginTop: 30,
            letterSpacing: 0.3,
          }}
        >
          {tagline}
        </Animated.Text>
      </View>

      {/* Shimmer progress line */}
      <View style={{ overflow: "hidden", height: 2, backgroundColor: "rgba(255,255,255,0.06)" }}>
        <Animated.View
          style={{
            width: "45%",
            height: 2,
            backgroundColor: Colors.brand.greenLight,
            transform: [
              {
                translateX: shimmer.interpolate({
                  inputRange: [-1, 1],
                  outputRange: [-150, 500],
                }),
              },
            ],
          }}
        />
      </View>

      <Animated.Text
        style={{
          opacity: fade,
          textAlign: "center",
          color: Colors.text.muted,
          fontFamily: "DM Sans",
          fontSize: 11,
          paddingTop: 18,
          paddingBottom: 22,
        }}
      >
        Sango Ota, Ogun State
      </Animated.Text>
    </LinearGradient>
  );
}
