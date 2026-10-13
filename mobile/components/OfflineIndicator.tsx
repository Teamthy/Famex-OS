import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { WifiOff, CloudUpload } from "lucide-react-native";
import { isOnline, pendingWrites, subscribeOffline, flushQueue } from "@/lib/offline/cache";
import { useTheme } from "@/src/theme";

export default function OfflineIndicator() {
  const { colors } = useTheme();
  const [, setTick] = useState(0);

  useEffect(() => subscribeOffline(() => setTick((t) => t + 1)), []);
  useEffect(() => { void flushQueue(); }, []);

  const online = isOnline();
  const pending = pendingWrites();
  if (online && pending === 0) return null;

  const syncing = online && pending > 0;
  const bg = syncing ? colors.warning : colors.danger;

  return (
    <View style={{ position: "absolute", top: 46, left: 0, right: 0, alignItems: "center", zIndex: 50 }} pointerEvents="none">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: bg, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}>
        {syncing ? <CloudUpload size={13} color="#000" /> : <WifiOff size={13} color={colors.brand.white} />}
        <Text style={{ color: syncing ? "#000" : colors.brand.white, fontSize: 12, fontWeight: "700", fontFamily: "DM Sans" }}>
          {syncing ? `Syncing ${pending} change${pending > 1 ? "s" : ""}…` : `Offline · ${pending} saved change${pending > 1 ? "s" : ""} pending`}
        </Text>
      </View>
    </View>
  );
}
