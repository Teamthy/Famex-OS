import { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { teacherApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { InlineError } from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Column } from "@/src/components/layout";
import { EmptyState } from "@/src/components/feedback";
import { bodyFont } from "@/src/theme/typography";
import { TrendingUp, ClipboardCheck, BookOpen, BarChart3 } from "lucide-react-native";

export default function TeacherAnalytics() {
  const { colors, spacing } = useTheme();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setData(await teacherApi.analytics());
    } catch (err) {
      // Previously `catch {}` — a failed request rendered an empty
      // screen indistinguishable from "there is nothing here".
      setError(err instanceof Error ? err.message : "Couldn't load analytics.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  const att = data?.attendance;
  const exams = data?.exams || [];
  const gradebooks = data?.gradebooks || [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand.greenLight} />}>
      <H2 style={{ marginBottom: spacing.xs }}>Analytics</H2>
      {error ? <InlineError message={error} onRetry={() => { void load(); }} /> : null}
      <Caption style={{ marginBottom: spacing.lg }}>Your teaching performance at a glance</Caption>

      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
        <Card variant="default" padding={spacing.md} style={{ flex: 1 }}>
          <TrendingUp size={18} color={colors.brand.greenLight} />
          <H2 style={{ fontSize: 24, marginTop: spacing.xs }}>{att?.overallRate != null ? `${att.overallRate}%` : "—"}</H2>
          <Caption style={{ marginTop: 4 }}>Attendance Rate</Caption>
        </Card>
        <Card variant="default" padding={spacing.md} style={{ flex: 1 }}>
          <ClipboardCheck size={18} color={colors.brand.greenLight} />
          <H2 style={{ fontSize: 24, marginTop: spacing.xs }}>{att?.totalSessions || 0}</H2>
          <Caption style={{ marginTop: 4 }}>Sessions (30d)</Caption>
        </Card>
      </View>

      {att?.byClass?.length > 0 && (
        <Column gap={spacing.xs + 2} style={{ marginBottom: spacing.lg }}>
          <Label>Attendance by Class</Label>
          {att.byClass.map((c: any, i: number) => <BarRow key={i} label={c.className} value={c.rate != null ? `${c.rate}%` : "—"} pct={c.rate} />)}
        </Column>
      )}

      {exams.length > 0 && (
        <Column gap={spacing.xs + 2} style={{ marginBottom: spacing.lg }}>
          <Label>Exam Averages</Label>
          {exams.slice(0, 8).map((e: any, i: number) => (
            <Card key={i} variant="default" padding={spacing.sm + 2} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 }}>
              <BookOpen size={15} color={colors.brand.greenLight} />
              <View style={{ flex: 1 }}>
                <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }} numberOfLines={1}>{e.title || e.className}</Body>
                <Caption>{e.className} · {e.attempts || 0} attempts</Caption>
              </View>
              <Body style={{ color: e.avgScore >= 50 ? colors.success : colors.warning, fontFamily: bodyFont("bold"), fontSize: 16 }}>{e.avgScore != null ? `${e.avgScore}%` : "—"}</Body>
            </Card>
          ))}
        </Column>
      )}

      {gradebooks.length > 0 && (
        <Column gap={spacing.xs + 2}>
          <Label>Gradebook Averages</Label>
          {gradebooks.map((g: any, i: number) => (
            <Card key={i} variant="default" padding={spacing.sm + 2} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 }}>
              <BarChart3 size={15} color={colors.brand.greenLight} />
              <View style={{ flex: 1 }}>
                <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>{g.subject}</Body>
                <Caption>{g.className} · {g.entryCount} students</Caption>
              </View>
              <Body style={{ color: colors.brand.greenLight, fontFamily: bodyFont("bold"), fontSize: 16 }}>{g.avgScore != null ? g.avgScore : "—"}</Body>
            </Card>
          ))}
        </Column>
      )}

      {!att?.byClass?.length && !exams.length && !gradebooks.length && (
        <EmptyState icon={<BarChart3 size={48} color={colors.border.strong} />} title="Not enough data yet" />
      )}
    </ScrollView>
  );
}

function BarRow({ label, value, pct }: { label: string; value: string; pct: number | null }) {
  const { colors, spacing } = useTheme();
  const p = Math.max(0, Math.min(100, pct || 0));
  return (
    <View style={{ marginBottom: spacing.xs + 2 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
        <Body tone="primary" style={{ fontFamily: "DM Sans Medium" }}>{label}</Body>
        <Body style={{ color: p >= 75 ? colors.success : colors.warning, fontFamily: bodyFont("bold") }}>{value}</Body>
      </View>
      <View style={{ height: 6, backgroundColor: colors.border.subtle, borderRadius: 3, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${p}%`, backgroundColor: p >= 75 ? colors.success : colors.warning, borderRadius: 3 }} />
      </View>
    </View>
  );
}
