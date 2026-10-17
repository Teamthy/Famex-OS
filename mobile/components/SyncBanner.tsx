/**
 * Small hook + banner that shows "N answers queued" and an inferred online state.
 * Subscribe to the offline module's emit so any screen that mounts this
 * re-renders when the queue grows/shrinks (e.g. mid-exam saves).
 */
import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { isOnline, pendingWrites, subscribeOffline } from "@/lib/offline/cache";
import { useTheme } from "@/src/theme";
import { Wifi, WifiOff, CloudUpload, RefreshCcw } from "lucide-react-native";
import { bodyFont } from "@/src/theme/typography";

export function useSyncStatus() {
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(pendingWrites());
  useEffect(() => {
    const unsub = subscribeOffline(() => {
      setOnline(isOnline());
      setPending(pendingWrites());
    });
    return unsub;
  }, []);
  return { online, pending };
}

export function SyncBanner() {
  const { online, pending } = useSyncStatus();
  const { colors, spacing, radius } = useTheme();

  // Don't show anything when fully online with nothing pending.
  if (online && pending === 0) return null;

  const bg = !online ? colors.status.warningBg : colors.status.successBg;
  const fg = !online ? colors.warning : colors.success;
  const Icon = !online ? WifiOff : pending > 0 ? CloudUpload : Wifi;
  const label = !online
    ? pending > 0
      ? `Offline · ${pending} item${pending > 1 ? "s" : ""} queued to send`
      : "Offline · changes will save when reconnected"
    : pending > 0
      ? `Syncing ${pending} item${pending > 1 ? "s" : ""}…`
      : "Online";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.sm + 4,
        paddingVertical: 6,
        backgroundColor: bg,
      }}
    >
      {online && pending > 0 ? (
        <RefreshCcw size={14} color={fg} />
      ) : (
        <Icon size={14} color={fg} />
      )}
      <Text
        style={{
          flex: 1,
          color: fg,
          fontSize: 11,
          fontFamily: bodyFont("semibold"),
          letterSpacing: 0.3,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
