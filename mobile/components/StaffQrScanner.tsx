import { useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useTheme } from "@/src/theme";
import { ScanLine, CameraOff, X } from "lucide-react-native";

/**
 * QR camera scanner for staff attendance badges.
 *
 * Uses expo-camera's barcode scanner (Android/iOS). On a successful decode it
 * calls `onScan(code)` once, then cools down briefly so the same badge is not
 * read twice in a row. Requires a native development build (expo-camera is a
 * native module — it does NOT work in Expo Go).
 *
 * Also supports `onDetectFromImage` for web, but the primary path is the native
 * camera view.
 */
export function StaffQrScanner({
  onScan,
  onClose,
}: {
  onScan: (code: string) => void;
  onClose?: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [cooldown, setCooldown] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (cooldown || !result.data) return;
    setCooldown(true);
    onScan(result.data);
    // Avoid duplicate reads of the same badge.
    cooldownRef.current = setTimeout(() => setCooldown(false), 3000);
  };

  return (
    <View style={styles.container}>
      {permission && !permission.granted ? (
        <View style={{ alignItems: "center", padding: spacing.lg }}>
          <CameraOff size={40} color={colors.text.muted} />
          <Text style={{ color: colors.text.primary, fontFamily: "DM Sans", fontSize: 15, marginTop: spacing.md, textAlign: "center" }}>
            Camera access is needed to scan staff QR badges.
          </Text>
          {permission.canAskAgain ? (
            <TouchableOpacity
              onPress={() => void requestPermission()}
              style={{ marginTop: spacing.md, backgroundColor: colors.brand.green, paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: radius.md }}
            >
              <Text style={{ color: colors.brand.white, fontWeight: "700" }}>Grant camera access</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleBarcode}
        >
          {/* Overlay guide */}
          <View style={StyleSheet.absoluteFill}>
            <View style={styles.guide}>
              <ScanLine size={48} color={colors.brand.greenLight} />
              <Text style={{ color: colors.brand.white, fontFamily: "DM Sans", fontSize: 13, marginTop: spacing.sm }}>
                Point at a staff QR badge
              </Text>
            </View>
            {cooldown ? (
              <View style={styles.cooldown}>
                <ActivityIndicator color={colors.brand.greenLight} />
                <Text style={{ color: colors.brand.white, fontSize: 13, marginLeft: 8 }}>Reading…</Text>
              </View>
            ) : null}
            {onClose ? (
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={22} color={colors.brand.white} />
              </TouchableOpacity>
            ) : null}
          </View>
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: "#000",
  },
  camera: {
    width: "100%",
    height: 260,
  },
  guide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cooldown: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
