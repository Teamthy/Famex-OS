import { useEffect, useRef, useState } from "react";
import { View, Animated, Image, ImageSourcePropType, ViewStyle } from "react-native";

/**
 * Full-bleed background image carousel with a smooth crossfade.
 * Place behind content with a scrim on top for readability.
 */
export function BackgroundCarousel({
  images,
  intervalMs = 4500,
  style,
}: {
  images: ImageSourcePropType[];
  intervalMs?: number;
  style?: ViewStyle;
}) {
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 700, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % images.length);
        Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }).start();
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [images.length, intervalMs, fade]);

  return (
    <View style={[{ flex: 1 }, style]}>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        <Image source={images[index]} style={{ flex: 1, resizeMode: "cover" }} />
      </Animated.View>
    </View>
  );
}
