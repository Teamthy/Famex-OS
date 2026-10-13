import { useCallback, useEffect, useState } from "react";
import { RefreshControl, View } from "react-native";
import { studentApi } from "@/lib/api";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { useCurrentTerm } from "@/lib/useCurrentTerm";
import { AppHeader } from "@/src/components/navigation";
import { Screen } from "@/src/components/layout";
import {
  DashboardGreeting,
  Metric,
  MetricGrid,
  QuickActions,
  SectionHeading,
  InlineError,
  TermChip,
} from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { Body, Caption } from "@/src/components/typography";
import { Skeleton } from "@/src/components/feedback";
import { ProgressRing } from "@/src/components/progress";
import { Badge } from "@/src/components/badges";
import { bodyFont } from "@/src/theme/typography";
import {
  Award,
  Calendar,
  TrendingUp,
  GraduationCap,
  ClipboardCheck,
  Bell,
  Users,
  CreditCard,
  Wallet,
  Mail,
  Newspaper,
  BarChart3,
  CalendarDays } from "lucide-react-native";

const naira = (n: number) => "₦" + Number(n || 0).toLocaleString();

export default function StudentDashboard() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const { term } = useCurrentTerm();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await studentApi.dashboard());
    } catch (err) {
      // Previously `catch {}` — a failed fetch rendered an empty dashboard
      // that looked identical to "you have no data".
      setError(err instanceof Error ? err.message : "Couldn't load your dashboard.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = data?.stats;
  const report = data?.latestReport;
  const attendanceRate = Number(stats?.attendanceRate ?? 0);
  const feeBalance = Number(stats?.feeBalance ?? 0);

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={colors.brand.greenLight}
        />
      }
    >
      <AppHeader onBellPress={() => router.push("/announcements")} />

      <DashboardGreeting
        name={data?.student?.displayName || (loading ? "" : "Student")}
        subtitle={
          data?.student?.className
            ? `${data.student.className} · ${data.student.studentId}`
            : null
        }
        onAvatarPress={() => router.push("/(student)/profile")}
      />


      <TermChip

        sessionLabel={term?.sessionLabel}

        termLabel={term?.termLabel}

        estimated={term?.isEstimated}

        style={{ marginBottom: spacing.md }}

      />

      {error ? <InlineError message={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <MetricGrid style={{ marginBottom: spacing.lg }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width="48%" height={104} radius={16} />
          ))}
        </MetricGrid>
      ) : (
        <>
          {/* Attendance gets the hero treatment — it is the number a student
              is asked about most often, and a ring reads faster than digits. */}
          <Card
            variant="default"
            padding={spacing.md}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.lg,
              marginBottom: spacing.sm + 2,
            }}
          >
            <ProgressRing
              value={attendanceRate}
              size={86}
              strokeWidth={8}
              caption="present"
              color={
                attendanceRate >= 75
                  ? colors.success
                  : attendanceRate >= 50
                    ? colors.warning
                    : colors.danger
              }
            />
            <View style={{ flex: 1 }}>
              <Body tone="primary" style={{ fontFamily: bodyFont("bold"), fontSize: 16 }}>
                Attendance
              </Body>
              <Caption style={{ marginTop: 3 }}>
                {attendanceRate >= 75
                  ? "You're in good standing this term."
                  : "Below the 75% benchmark — speak to your form teacher."}
              </Caption>
              <Caption
                style={{ marginTop: 8, color: colors.brand.greenLight, fontFamily: bodyFont("medium") }}
                onPress={() => router.push("/(student)/attendance")}
              >
                View record →
              </Caption>
            </View>
          </Card>

          <MetricGrid style={{ marginBottom: spacing.lg }}>
            <Metric
              icon={<Award size={18} color={colors.brand.greenLight} />}
              label="Average score"
              value={stats?.averageScore != null ? `${stats.averageScore}` : "—"}
              hint={report?.termLabel || undefined}
              onPress={() => router.push("/(student)/report-cards")}
            />
            <Metric
              icon={<TrendingUp size={18} color={colors.brand.greenLight} />}
              label="Class position"
              // classPosition lives on latestReport, not stats — reading
              // stats.classPosition always rendered a dash.
              value={report?.classPosition != null ? `${report.classPosition}` : "—"}
              hint={report?.sessionLabel || undefined}
              onPress={() => router.push("/(student)/report-cards")}
            />
            <Metric
              icon={<GraduationCap size={18} color={colors.brand.greenLight} />}
              label="Overall grade"
              value={stats?.overallGrade || "—"}
              onPress={() => router.push("/(student)/report-cards")}
            />
            <Metric
              icon={
                <Wallet
                  size={18}
                  color={feeBalance > 0 ? colors.danger : colors.brand.greenLight}
                />
              }
              accent={feeBalance > 0 ? colors.danger : undefined}
              label="Fee balance"
              value={naira(feeBalance)}
              compact
              hint={feeBalance > 0 ? "Outstanding" : "Fully paid"}
            />
          </MetricGrid>
        </>
      )}

      {/* Latest result — replaces a "Today's Schedule" block that read
          data.timetable, a field the dashboard API never returns (and the
          timetable endpoint itself still returns an empty schedule). */}
      {report ? (
        <>
          <SectionHeading
            title="Latest result"
            actionLabel="All results"
            onAction={() => router.push("/(student)/report-cards")}
          />
          <Card
            variant="bordered"
            padding={spacing.md}
            onPress={() => router.push("/(student)/report-cards")}
            style={{ marginBottom: spacing.lg }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Body tone="primary" style={{ flex: 1, fontFamily: bodyFont("bold") }}>
                {report.termLabel}
              </Body>
              {report.overallGrade ? (
                <Badge tone="success">{report.overallGrade}</Badge>
              ) : null}
            </View>
            <Caption style={{ marginTop: 4 }}>
              {report.sessionLabel}
              {report.overallAverage != null ? ` · ${report.overallAverage}% average` : ""}
              {report.classPosition != null ? ` · position ${report.classPosition}` : ""}
            </Caption>
          </Card>
        </>
      ) : null}

      <SectionHeading title="Quick actions" />
      <QuickActions
        actions={[
          {
            label: "Report cards",
            icon: <Award size={18} color={colors.brand.greenLight} />,
            onPress: () => router.push("/(student)/report-cards"),
          },
          {
            label: "Exams",
            icon: <ClipboardCheck size={18} color={colors.brand.greenLight} />,
            onPress: () => router.push("/(student)/exams"),
          },
          {
            label: "Exam results",
            icon: <BarChart3 size={18} color={colors.brand.greenLight} />,
            onPress: () => router.push("/exam-results"),
          },
          {
            label: "Timetable",
            icon: <CalendarDays size={18} color={colors.brand.greenLight} />,
            onPress: () => router.push("/(student)/timetable"),
          },
          {
            label: "Practice",
            icon: <GraduationCap size={18} color={colors.brand.greenLight} />,
            onPress: () => router.push("/practice"),
          },
          {
            label: "Attendance",
            icon: <Calendar size={18} color={colors.brand.greenLight} />,
            onPress: () => router.push("/(student)/attendance"),
          },
          {
            label: "Messages",
            icon: <Mail size={18} color={colors.brand.greenLight} />,
            onPress: () => router.push("/messages"),
          },
          {
            label: "Announcements",
            icon: <Bell size={18} color={colors.brand.greenLight} />,
            onPress: () => router.push("/announcements"),
          },
          {
            label: "School News",
            icon: <Newspaper size={18} color={colors.brand.greenLight} />,
            onPress: () => router.push("/news"),
          },
          {
            label: "My teachers",
            icon: <Users size={18} color={colors.brand.greenLight} />,
            onPress: () => router.push("/student-teachers"),
          },
          {
            label: "ID card",
            icon: <CreditCard size={18} color={colors.brand.greenLight} />,
            onPress: () => router.push("/id-card"),
          },
        ]}
        style={{ marginBottom: spacing.lg }}
      />
    </Screen>
  );
}
