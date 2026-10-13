import { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { parentApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { InlineError } from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Row, Column, Screen, AppBar } from "@/src/components/layout";
import { bodyFont } from "@/src/theme/typography";
import { Bell } from "lucide-react-native";

export default function ParentAttendance() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [childId, setChildId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(id?: string) {
    try {
      setError(null);
      const res = await parentApi.attendance(id || undefined); setData(res); if (!id) setChildId(res?.selectedChild?.id || "");
    } catch (err) {
      // Previously `catch {}` — a failed request rendered an empty
      // screen indistinguishable from "there is nothing here".
      setError(err instanceof Error ? err.message : "Couldn't load attendance.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);
  function selectChild(id: string) { setChildId(id); load(id); }

  const children = data?.children || [];
  const s = data?.summary;
  const rate = s && s.total ? Math.round((s.present / s.total) * 100) : 0;

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(childId); }} tintColor={colors.brand.greenLight} />}>
      <AppBar title="Attendance" onBack={() => router.back()} />
      <H2 style={{ marginBottom: spacing.xs }}>Attendance</H2>
      {error ? <InlineError message={error} onRetry={() => { void load(childId); }} /> : null}
      {data?.monthLabel && <Caption style={{ marginBottom: spacing.md }}>{data.monthLabel}</Caption>}

      {children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          {children.map((c: any) => (
            <TouchableOpacity key={c.id} onPress={() => selectChild(c.id)} style={{ backgroundColor: childId === c.id ? colors.brand.green : colors.background.elevated, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginRight: spacing.sm }}>
              <Body tone={childId === c.id ? "inverse" : "primary"} style={{ fontFamily: bodyFont("semibold") }}>{c.displayName}</Body>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Card variant="bordered" style={{ alignItems: "center", marginBottom: spacing.lg }}>
        <Label>Attendance Rate</Label>
        <H2 style={{ fontSize: 48, color: rate >= 75 ? colors.success : colors.danger, marginTop: spacing.xs }}>{rate}%</H2>
        <Row gap={spacing.lg} style={{ marginTop: spacing.md }}>
          <Stat label="Present" value={s?.present || 0} color={colors.success} />
          <Stat label="Absent" value={s?.absent || 0} color={colors.danger} />
          <Stat label="Late" value={s?.late || 0} color={colors.warning} />
        </Row>
      </Card>

      {data?.recentAlerts?.length > 0 && (
        <Column gap={spacing.xs + 2}>
          <Label style={{ marginBottom: spacing.xs + 2 }}>Attendance Alerts</Label>
          {data.recentAlerts.slice(0, 8).map((a: any) => (
            <Card key={a.id} variant="default" padding={12} style={{ flexDirection: "row", gap: spacing.sm + 2 }}>
              <Bell size={16} color={colors.warning} />
              <Column style={{ flex: 1 }}>
                <Body tone="primary" numberOfLines={2}>{a.messagePreview}</Body>
                <Caption style={{ marginTop: 2 }}>{new Date(a.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}</Caption>
              </Column>
            </Card>
          ))}
        </Column>
      )}
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useTheme();
  return (<View style={{ alignItems: "center" }}><H2 style={{ color, fontSize: 22 }}>{value}</H2><Caption>{label}</Caption></View>);
}
