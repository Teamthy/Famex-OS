import { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { parentApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { H2 } from "@/src/components/typography";
import { ListItem } from "@/src/components/lists";
import { EmptyState } from "@/src/components/feedback";
import { useToast } from "@/components/MobileToast";
import { Calendar, Megaphone, AlertCircle, Info } from "lucide-react-native";

export default function ParentEvents() {
  const { colors, spacing } = useTheme();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() { try { setData(await parentApi.events()); } catch { toast("We couldn’t refresh events right now.", "error"); } finally { setRefreshing(false); } }
  useEffect(() => { load(); }, []);

  const events = data?.events || [];
  const toneFor = (k: string) => (k === "ALERT" ? colors.danger : k === "EVENT" ? colors.brand.greenLight : colors.text.muted);
  const iconFor = (k: string) => (k === "ALERT" ? <AlertCircle size={20} color={colors.danger} /> : k === "EVENT" ? <Megaphone size={20} color={colors.brand.greenLight} /> : <Info size={20} color={colors.text.muted} />);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand.greenLight} />}>
      <H2 style={{ marginBottom: spacing.lg }}>Events</H2>
      {events.length > 0 ? (
        events.map((ev: any) => (
          <ListItem key={ev.id} leftIcon={iconFor(ev.kind)} accentColor={toneFor(ev.kind)} title={ev.title} subtitle={ev.description ? `${new Date(ev.at).toLocaleDateString("en", { month: "short", day: "numeric" })} · ${ev.description}` : new Date(ev.at).toLocaleDateString("en", { month: "short", day: "numeric" })} />
        ))
      ) : (
        <EmptyState icon={<Calendar size={48} color={colors.border.strong} />} title="No upcoming events" />
      )}
    </ScrollView>
  );
}
