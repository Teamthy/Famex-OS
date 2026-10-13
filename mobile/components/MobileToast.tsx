import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, Animated, Platform } from "react-native";
import { Colors } from "@/src/theme";

type ToastType = "success" | "error" | "info" | "warning";
type ToastFn = (message: string, type?: ToastType) => void;

const ToastContext = createContext<{ toast: ToastFn }>({ toast: () => {} });

/** `const { toast } = useToast();` then `toast("Saved!", "success")` */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<{ message: string; type: ToastType } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      setData({ message, type });
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setData(null));
    },
    [opacity],
  );

  const bg = {
    success: Colors.brand.green,
    error: Colors.danger,
    info: Colors.brand.navyLight,
    warning: Colors.brand.orange,
  }[data?.type ?? "info"];

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {data && (
        <Animated.View style={[styles.container, { opacity, backgroundColor: bg }]}>
          <Text style={styles.text}>{data.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 12,
    zIndex: 99999,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  text: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
