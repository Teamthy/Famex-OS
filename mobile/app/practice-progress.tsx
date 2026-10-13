import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Column, Row } from "@/src/components/layout";
import { bodyFont } from "@/src/theme/typography";
import { EmptyState } from "@/src/components/feedback";
import {
  getPracticeHistory,
  getPracticeStats,
  type PracticeStats,
  type PracticeSession,
} from "@/lib/practiceHistory";
import { Flame, Target, BookOpenCheck, Trophy, History } from "lucide-react-native";

function fmtDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function PracticeProgress() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const [stats, setStats] = useState<PracticeStats | null>(null);
  const [history, setHistory] = useState<PracticeSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const [s, h] = await Promise.all([getPracticeStats(), getPracticeHistory()]);
    setStats(s);
    setHistory(h);
  }
  useEffect(() => {
    void load();
  }, []);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background.primary }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.greenLight} />
      }
    >
      <Row justify="space-between" align="center">
        <H2 style={{ fontSize: 26 }}>Practice Progress</H2>
      </Row>
      <Caption style={{ marginTop: 4, marginBottom: spacing.lg }}>Your effort, saved on this device.</Caption>

      {!stats ? null : stats.sessions === 0 ? (
        <Card variant="bordered" padding={spacing.lg} style={{ marginTop: spacing.md }}>
          <EmptyState
            icon={<BookOpenCheck size={40} color={colors.brand.greenLight} />}
            title="No practice yet"
            message="Complete a practice test to start building your streak and history."
            actionLabel="Start practising"
            onAction={() => router.push("/practice")}
          />
        </Card>
      ) : (
        <>
          {/* ── Streak hero ── */}
          <Card variant="bordered" padding={spacing.lg} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg, borderColor: colors.brand.green }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.brand.orange, justifyContent: "center", alignItems: "center" }}>
              <Flame size={34} color={colors.brand.white} />
            </View>
            <View style={{ flex: 1 }}>
              <H2 style={{ color: colors.brand.orange, fontSize: 32 }}>{stats.currentStreak} day{stats.currentStreak === 1 ? "" : "s"}</H2>
              <Body style={{ marginTop: 2 }}>Current practice streak</Body>
              {stats.lastSessionDay ? (
                <Caption style={{ marginTop: 4 }}>Last practised {fmtDay(stats.lastSessionDay)}</Caption>
              ) : null}
            </View>
          </Card>

          {/* ── Metric grid ── */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            <MetricTile icon={<Target size={20} color={colors.brand.greenLight} />} label="Best score" value={`${stats.bestPct}%`} />
            <MetricTile icon={<BookOpenCheck size={20} color={colors.brand.greenLight} />} label="Sessions" value={String(stats.sessions)} />
            <MetricTile icon={<History size={20} color={colors.brand.greenLight} />} label="Questions" value={String(stats.questionsAttempted)} />
            <MetricTile icon={<Trophy size={20} color={colors.brand.greenLight} />} label="Correct" value={String(stats.correct)} />
          </View>

          {/* ── Recent sessions ── */}
          <Label style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Recent sessions</Label>
          {history.length === 0 ? (
            <Caption>No completed sessions yet.</Caption>
          ) : (
            <Column gap={spacing.xs + 2}>
              {history.map((s) => (
                <Card key={s.id} variant="default" padding={spacing.sm + 2} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>{fmtDay(s.day)}</Body>
                    <Caption>{s.correct} of {s.total} correct</Caption>
                  </View>
                  <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: s.pct >= 50 ? colors.status.successBg : colors.status.warningBg }}>
                    <Caption style={{ color: s.pct >= 50 ? colors.status.successText : colors.status.warningText, fontFamily: bodyFont("bold") }}>{s.pct}%</Caption>
                  </View>
                </Card>
              ))}
            </Column>
          )}
        </>
      )}
    </ScrollView>
  );
}

function MetricTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={{ width: "47%", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface.card, borderWidth: 1, borderColor: colors.border.subtle, marginBottom: spacing.sm }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${colors.brand.green}1F`, justifyContent: "center", alignItems: "center", marginBottom: spacing.sm }}>
        {icon}
      </View>
      <Body tone="primary" style={{ fontFamily: bodyFont("bold"), fontSize: 22 }}>{value}</Body>
      <Caption>{label}</Caption>
    </View>
  );
}
