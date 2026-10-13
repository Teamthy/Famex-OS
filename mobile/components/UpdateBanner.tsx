import { useEffect, useState } from "react";
import { View, TouchableOpacity, ActivityIndicator } from "react-native";
import { Download } from "lucide-react-native";
import { useTheme } from "@/src/theme";
import { Caption } from "@/src/components/typography";
import { Linking } from "react-native";
import { applyUpdateNow, checkForUpdate, checkMinimumVersion } from "@/lib/updates";

/**
 * "An update is ready — restart to apply."
 *
 * This matters far more when the app is sideloaded than it would on a store.
 * With a Play Store listing, a stale install eventually gets nagged by the
 * store itself. With a shared APK there is no such backstop: a parent can run
 * a months-old build indefinitely and nobody would know.
 *
 * The update is already downloaded by the time this shows. Applying is a
 * reload, not a download, so it is fast and works offline.
 *
 * Deliberately dismissible and never automatic — reloading under someone
 * mid-exam or mid-payment would be worse than the bug being fixed.
 */
export function UpdateBanner() {
  const { colors, spacing, radius } = useTheme();
  const [ready, setReady] = useState(false);
  const [applying, setApplying] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [stale, setStale] = useState<{ apkUrl: string | null; message: string | null } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // A too-old NATIVE build cannot be fixed over the air, so ask the server
      // first — that verdict outranks any JS update.
      const version = await checkMinimumVersion();
      if (cancelled) return;
      if (version.outdated) {
        setStale({ apkUrl: version.apkUrl, message: version.message });
        return;
      }
      const result = await checkForUpdate();
      if (!cancelled && result.status === "downloaded") setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Unsupported build. NOT dismissible — an OTA cannot rescue this one, and
  // letting it be waved away just moves the confusion to a later screen.
  if (stale) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          backgroundColor: `${colors.danger}1A`,
          borderWidth: 1,
          borderColor: `${colors.danger}55`,
        }}
      >
        <Download size={15} color={colors.danger} />
        <Caption style={{ flex: 1, color: colors.danger }}>
          {stale.message ?? "This version is no longer supported."}
        </Caption>
        {stale.apkUrl ? (
          <TouchableOpacity
            onPress={() => void Linking.openURL(stale.apkUrl as string)}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Caption style={{ color: colors.danger, fontWeight: "700" }}>Download</Caption>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (!ready || dismissed) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: `${colors.brand.greenLight}1A`,
        borderWidth: 1,
        borderColor: `${colors.brand.greenLight}55`,
      }}
    >
      <Download size={15} color={colors.brand.greenLight} />
      <Caption style={{ flex: 1, color: colors.brand.greenLight }}>
        An update is ready. Restart to apply it.
      </Caption>

      {applying ? (
        <ActivityIndicator size="small" color={colors.brand.greenLight} />
      ) : (
        <>
          <TouchableOpacity
            onPress={() => {
              setApplying(true);
              // reloadAsync never resolves — the JS context is replaced.
              void applyUpdateNow();
            }}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Caption style={{ color: colors.brand.greenLight, fontWeight: "700" }}>
              Restart
            </Caption>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setDismissed(true)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss update notice"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Caption style={{ color: colors.text.muted }}>Later</Caption>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
