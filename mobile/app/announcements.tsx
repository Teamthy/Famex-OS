import { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { studentApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { H2, Caption } from "@/src/components/typography";
import { ListItem } from "@/src/components/lists";
import { EmptyState } from "@/src/components/feedback";
import { useToast } from "@/components/MobileToast";
import { Bell, Megaphone, AlertCircle, Info } from "lucide-react-native";

export default function Announcements() {
  const { colors, spacing } = useTheme();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() { try { setData(await studentApi.announcements()); } catch { toast("We couldn’t refresh announcements right now.", "error"); } finally { setRefreshing(false); } }
  useEffect(() => { load(); }, []);

  const items = data?.announcements || [];
  const toneFor = (k: string) => (k === "ALERT" ? colors.danger : k === "EXAM" || k === "RESULT" ? colors.brand.greenLight : colors.text.muted);
  const iconFor = (k: string) => (k === "ALERT" ? <AlertCircle size={20} color={colors.danger} /> : k === "EXAM" || k === "RESULT" ? <Megaphone size={20} color={colors.brand.greenLight} /> : <Info size={20} color={colors.text.muted} />);
  const timeAgo = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand.greenLight} />}>
      <H2 style={{ marginBottom: spacing.lg }}>Announcements</H2>
      {items.length > 0 ? (
        items.map((n: any) => (
          <ListItem
            key={n.id}
            leftIcon={iconFor(n.kind)}
            accentColor={toneFor(n.kind)}
            title={n.title}
            subtitle={n.body ? `${timeAgo(n.at)} · ${n.body}` : timeAgo(n.at)}
            unread={!n.read}
            right={!n.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand.greenLight }} /> : undefined}
          />
        ))
      ) : (
        <EmptyState icon={<Bell size={48} color={colors.border.strong} />} title="No announcements yet" message="School updates will appear here." />
      )}
    </ScrollView>
  );
}
