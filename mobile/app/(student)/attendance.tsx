import { useEffect, useState } from "react";
import { View, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { studentApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { InlineError } from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { H2, Caption, Label } from "@/src/components/typography";
import { Screen, AppBar, Row, Column } from "@/src/components/layout";
import { Check, X, Clock } from "lucide-react-native";

export default function StudentAttendance() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setData(await studentApi.attendance());
    } catch (err) {
      // Previously `catch {}` — a failed request rendered an empty
      // screen indistinguishable from "there is nothing here".
      setError(err instanceof Error ? err.message : "Couldn't load your attendance.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  const rate = data?.summary ? Math.round((data.summary.present / data.summary.total) * 100) : 0;

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand.greenLight} />}>
      <AppBar title="My Attendance" onBack={() => router.back()} />
      {error ? <InlineError message={error} onRetry={() => { void load(); }} /> : null}

      <Card variant="bordered" style={{ alignItems: "center", marginBottom: spacing.lg }}>
        <Label>Attendance Rate</Label>
        <H2 style={{ fontSize: 48, color: rate >= 75 ? colors.success : colors.danger, marginTop: spacing.xs }}>{rate}%</H2>
        <Row gap={spacing.lg} style={{ marginTop: spacing.md }}>
          <Stat label="Present" value={data?.summary?.present || 0} color={colors.success} />
          <Stat label="Absent" value={data?.summary?.absent || 0} color={colors.danger} />
          <Stat label="Late" value={data?.summary?.late || 0} color={colors.warning} />
        </Row>
      </Card>

      {data?.entries?.length > 0 && (
        <Column gap={spacing.xs + 2}>
          <Label style={{ marginBottom: spacing.xs + 2 }}>Recent</Label>
          {data.entries.slice(0, 20).map((entry: any, i: number) => {
            const color = entry.status === "PRESENT" ? colors.success : entry.status === "LATE" ? colors.warning : colors.danger;
            return (
              <Row key={i} gap={spacing.sm} align="center">
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${color}15`, justifyContent: "center", alignItems: "center" }}>
                  {entry.status === "PRESENT" ? <Check size={16} color={colors.success} /> : entry.status === "LATE" ? <Clock size={16} color={colors.warning} /> : <X size={16} color={colors.danger} />}
                </View>
                <Column style={{ flex: 1 }}>
                  <Caption style={{ color: colors.text.primary, fontFamily: "DM Sans Medium" }}>{new Date(entry.date).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}</Caption>
                  <Caption>{entry.status}</Caption>
                </Column>
              </Row>
            );
          })}
        </Column>
      )}
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center" }}>
      <H2 style={{ color, fontSize: 22 }}>{value}</H2>
      <Caption>{label}</Caption>
    </View>
  );
}
