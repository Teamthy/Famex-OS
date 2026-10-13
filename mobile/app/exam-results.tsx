import { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { studentApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Screen, AppBar, Row, Column } from "@/src/components/layout";
import { EmptyState } from "@/src/components/feedback";
import { bodyFont } from "@/src/theme/typography";
import { BarChart3, TrendingUp, TrendingDown, Target } from "lucide-react-native";

/** Colour a result: ≥70 strong, ≥50 pass, <50 needs attention. */
function toneFor(pct: number, colors: any) {
  if (pct >= 70) return colors.success;
  if (pct >= 50) return colors.warning;
  return colors.danger;
}

export default function ExamResults() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setData(await studentApi.exams());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your results.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  // Graded attempts where results are visible (percent != null).
  const graded = (data?.exams || []).filter((e: any) => e.attempt?.percent != null);
  const bySubject = new Map<string, number[]>();
  for (const e of graded) {
    const key = e.subjectName || "General";
    const arr = bySubject.get(key) || [];
    arr.push(e.attempt.percent);
    bySubject.set(key, arr);
  }
  const subjects = [...bySubject.entries()].map(([name, pcts]) => ({
    name,
    count: pcts.length,
    avg: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
    best: Math.max(...pcts),
  }));
  subjects.sort((a, b) => a.avg - b.avg); // weakest first

  const overall =
    graded.length > 0
      ? Math.round(graded.reduce((a: number, e: any) => a + e.attempt.percent, 0) / graded.length)
      : null;

  const weak = subjects.filter((s) => s.avg < 50);
  const strong = subjects.filter((s) => s.avg >= 70);

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.brand.greenLight} />
      }
    >
      <AppBar title="Exam Results" onBack={() => router.back()} />
      <H2 style={{ marginBottom: spacing.xs }}>Results &amp; progress</H2>
      <Caption style={{ marginBottom: spacing.lg }}>Your graded exam attempts.</Caption>

      {error ? (
        <EmptyState icon={<BarChart3 size={44} color={colors.border.strong} />} title={error} />
      ) : graded.length === 0 ? (
        <EmptyState
          icon={<BarChart3 size={48} color={colors.border.strong} />}
          title="No results yet"
          message="Graded exam results will appear here once released."
        />
      ) : (
        <>
          {/* ── Overall ── */}
          <Card variant="bordered" padding={spacing.lg} style={{ alignItems: "center", marginBottom: spacing.lg }}>
            <Caption>Overall average</Caption>
            <H2 style={{ fontSize: 44, color: overall == null ? colors.text.primary : toneFor(overall, colors), marginTop: 4 }}>
              {overall}%
            </H2>
            <Caption>{graded.length} graded attempt{graded.length === 1 ? "" : "s"}</Caption>
          </Card>

          {/* ── Weak vs strong ── */}
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
            <Card variant="default" padding={spacing.md} style={{ flex: 1 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${colors.danger}1F`, justifyContent: "center", alignItems: "center", marginBottom: spacing.sm }}>
                <TrendingDown size={18} color={colors.danger} />
              </View>
              <Body tone="primary" style={{ fontFamily: bodyFont("bold"), fontSize: 22 }}>{weak.length}</Body>
              <Caption>Need attention</Caption>
            </Card>
            <Card variant="default" padding={spacing.md} style={{ flex: 1 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${colors.success}1F`, justifyContent: "center", alignItems: "center", marginBottom: spacing.sm }}>
                <TrendingUp size={18} color={colors.success} />
              </View>
              <Body tone="primary" style={{ fontFamily: bodyFont("bold"), fontSize: 22 }}>{strong.length}</Body>
              <Caption>Strong subjects</Caption>
            </Card>
          </View>

          {/* ── Per-subject ── */}
          <Label style={{ marginBottom: spacing.sm }}>By subject</Label>
          <Column gap={spacing.xs + 2}>
            {subjects.map((s) => {
              const color = toneFor(s.avg, colors);
              return (
                <Card key={s.name} variant="default" padding={spacing.sm + 4}>
                  <Row justify="space-between">
                    <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>{s.name}</Body>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <Caption>{s.count} attempt{s.count === 1 ? "" : "s"} · best {s.best}%</Caption>
                      <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: `${color}22`, borderWidth: 1, borderColor: `${color}55` }}>
                        <Caption style={{ color, fontFamily: bodyFont("bold") }}>{s.avg}%</Caption>
                      </View>
                    </View>
                  </Row>
                  <View style={{ height: 6, backgroundColor: colors.border.subtle, borderRadius: 3, overflow: "hidden", marginTop: spacing.sm }}>
                    <View style={{ width: `${Math.min(100, s.avg)}%`, height: 6, backgroundColor: color, borderRadius: 3 }} />
                  </View>
                </Card>
              );
            })}
          </Column>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.lg }}>
            <Target size={14} color={colors.text.muted} />
            <Caption>Focus on subjects in red — a quick practice test helps.</Caption>
          </View>
        </>
      )}
    </Screen>
  );
}
