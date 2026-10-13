import { useCallback, useEffect, useState } from "react";
import { View, RefreshControl } from "react-native";
import { parentApi } from "@/lib/api";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { useCurrentTerm } from "@/lib/useCurrentTerm";
import { AppHeader } from "@/src/components/navigation";
import {
  DashboardGreeting,
  Metric,
  MetricGrid,
  QuickActions,
  SectionHeading,
  ChildSwitcher,
  InlineError,
  TermChip,
} from "@/src/components/dashboard";
import { Screen } from "@/src/components/layout";
import { Card } from "@/src/components/cards";
import { H3, Body, Caption } from "@/src/components/typography";
import { Skeleton, EmptyState } from "@/src/components/feedback";
import { ProgressRing } from "@/src/components/progress";
import { Button } from "@/src/components/buttons";
import { bodyFont } from "@/src/theme/typography";
import { haptic } from "@/lib/haptics";
import {
  CreditCard,
  Calendar,
  Bell,
  GraduationCap,
  FileText,
  Megaphone,
  Mail,
  Newspaper,
  School,
  CalendarDays,
  ArrowRight,
} from "lucide-react-native";

const naira = (n: number) => "₦" + Number(n || 0).toLocaleString();

export default function ParentDashboard() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const { term } = useCurrentTerm();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);

  const load = useCallback(async (id?: string | null) => {
    try {
      setError(null);
      const res = await parentApi.dashboard(id || undefined);
      setData(res);
      setChildId(res?.selectedChild?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your dashboard.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function switchChild(id: string) {
    if (id === childId) return;
    haptic("light");
    setChildId(id);
    setLoading(true);
    void load(id);
  }

  const child = data?.selectedChild;
  const fin = data?.finance;
  const att = data?.attendance;
  const outstanding = Number(fin?.totalOutstanding ?? 0);
  const hasOutstanding = outstanding > 0;
  const attendanceRate = Number(att?.attendanceRate ?? 0);
  const firstName = child?.displayName?.split(" ")[0] || "your ward";

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load(childId);
          }}
          tintColor={colors.brand.greenLight}
        />
      }
    >
      <AppHeader onBellPress={() => router.push("/parent-events")} />

      <DashboardGreeting
        name={data?.parent?.displayName || (loading ? "" : "Parent")}
        subtitle={child ? `Viewing ${child.displayName}` : null}
        onAvatarPress={() => router.push("/(parent)/profile")}
      />

      <TermChip
        sessionLabel={term?.sessionLabel}

        termLabel={term?.termLabel}

        estimated={term?.isEstimated}

        style={{ marginBottom: spacing.md }}
      />

      {error ? <InlineError message={error} onRetry={() => void load(childId)} /> : null}

      {/* Now functional: tapping a ward refetches scoped to that student.
          The API previously hardcoded children[0], so siblings were
          unreachable and these chips did nothing. */}
      {data?.children?.length > 1 ? (
        <ChildSwitcher children={data.children} selectedId={childId} onSelect={switchChild} />
      ) : null}

      {!loading && data && data.children?.length === 0 ? (
        <Card variant="bordered" padding={spacing.xl}>
          <EmptyState
            icon={<GraduationCap size={38} color={colors.border.strong} />}
            title="No children linked yet"
            message="The school will link your ward's profile to this account."
          />
        </Card>
      ) : null}

      {loading ? (
        <>
          <Skeleton width="100%" height={132} radius={16} style={{ marginBottom: 10 }} />
          <MetricGrid>
            {[0, 1].map((i) => (
              <Skeleton key={i} width="48%" height={104} radius={16} />
            ))}
          </MetricGrid>
        </>
      ) : child ? (
        <>
          {/* Fees lead the parent view — it is the action with a deadline. */}
          <Card
            variant="bordered"
            padding={spacing.md}
            onPress={() => router.push("/(parent)/fees")}
            style={{
              marginBottom: spacing.sm + 2,
              borderColor: hasOutstanding ? colors.status.errorBorder : colors.status.successBorder,
              backgroundColor: hasOutstanding ? colors.status.errorBg : colors.status.successBg,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <CreditCard
                size={17}
                color={hasOutstanding ? colors.status.errorText : colors.status.successText}
              />
              <Caption
                style={{
                  flex: 1,
                  color: hasOutstanding ? colors.status.errorText : colors.status.successText,
                  fontFamily: bodyFont("bold"),
                  letterSpacing: 0.6,
                }}
              >
                {hasOutstanding ? "OUTSTANDING FEES" : "FEES SETTLED"}
              </Caption>
            </View>

            <Body
              tone="primary"
              style={{
                fontFamily: "Anton",
                fontSize: 30,
                lineHeight: 36,
                marginTop: spacing.xs,
                color: hasOutstanding ? colors.status.errorText : colors.status.successText,
              }}
            >
              {naira(outstanding)}
            </Body>
            <Caption style={{ marginTop: 2 }}>
              Paid {naira(fin?.totalPaid)} of {naira(fin?.totalBilled)}
            </Caption>

            {hasOutstanding ? (
              <Button
                fullWidth
                size="sm"
                onPress={() => router.push("/(parent)/fees")}
                rightIcon={<ArrowRight size={15} color={colors.brand.white} />}
                style={{ marginTop: spacing.md }}
              >
                Pay now
              </Button>
            ) : null}
          </Card>

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
              size={80}
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
                {firstName}&apos;s attendance
              </Body>
              <Caption style={{ marginTop: 3 }}>
                {att?.present ?? 0} present · {att?.absent ?? 0} absent · {att?.late ?? 0} late
              </Caption>
              <Caption
                style={{
                  marginTop: 8,
                  color: colors.brand.greenLight,
                  fontFamily: bodyFont("medium"),
                }}
                onPress={() => router.push("/(parent)/attendance")}
              >
                View record →
              </Caption>
            </View>
          </Card>

          <MetricGrid style={{ marginBottom: spacing.lg }}>
            <Metric
              icon={<GraduationCap size={18} color={colors.brand.greenLight} />}
              label="Class"
              value={child.className || "—"}
              compact
            />
            <Metric
              icon={<FileText size={18} color={colors.brand.greenLight} />}
              label="Latest invoice"
              value={fin?.latestInvoice?.status || "—"}
              compact
              hint={fin?.latestInvoice?.termLabel || undefined}
              onPress={() => router.push("/(parent)/fees")}
            />
          </MetricGrid>

          <SectionHeading title="Quick actions" />
          <QuickActions
            style={{ marginBottom: spacing.lg }}
            actions={[
              {
                label: "Report cards",
                icon: <FileText size={18} color={colors.brand.greenLight} />,
                onPress: () => router.push("/(parent)/report-cards"),
              },
              {
                label: "Attendance",
                icon: <Calendar size={18} color={colors.brand.greenLight} />,
                onPress: () => router.push("/(parent)/attendance"),
              },
              {
                label: "Fees & payments",
                icon: <CreditCard size={18} color={colors.brand.greenLight} />,
                onPress: () => router.push("/(parent)/fees"),
              },
              {
                label: "School events",
                icon: <Megaphone size={18} color={colors.brand.greenLight} />,
                onPress: () => router.push("/parent-events"),
              },
              {
                label: "School News",
                icon: <Newspaper size={18} color={colors.brand.greenLight} />,
                onPress: () => router.push("/news"),
              },
              {
                label: "School Info",
                icon: <School size={18} color={colors.brand.greenLight} />,
                onPress: () => router.push("/school-info"),
              },
              {
                label: "Timetable",
                icon: <CalendarDays size={18} color={colors.brand.greenLight} />,
                onPress: () => router.push("/(parent)/timetable"),
              },
              {
                label: "Messages",
                icon: <Mail size={18} color={colors.brand.greenLight} />,
                onPress: () => router.push("/messages"),
              },
            ]}
          />
        </>
      ) : null}

      {data?.recentAlerts?.length > 0 ? (
        <>
          <SectionHeading title="Recent alerts" />
          <View style={{ gap: spacing.sm }}>
            {data.recentAlerts.slice(0, 4).map((a: any) => (
              <Card
                key={a.id}
                variant="default"
                padding={spacing.sm + 4}
                style={{ flexDirection: "row", gap: spacing.sm + 2 }}
              >
                <Bell size={16} color={colors.warning} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Body tone="primary" numberOfLines={2} style={{ fontSize: 14 }}>
                    {a.messagePreview}
                  </Body>
                  <Caption style={{ marginTop: 3, fontSize: 11 }}>
                    {new Date(a.createdAt).toLocaleDateString("en", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Caption>
                </View>
              </Card>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
