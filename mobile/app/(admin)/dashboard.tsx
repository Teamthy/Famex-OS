import { useCallback, useEffect, useState } from "react";
import { View, RefreshControl, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { adminApi } from "@/lib/api";
import { getPref, setPref } from "@/lib/prefs";
import { useTheme } from "@/src/theme";
import { useCurrentTerm } from "@/lib/useCurrentTerm";
import { AppHeader } from "@/src/components/navigation";
import { Screen } from "@/src/components/layout";
import {
  DashboardGreeting,
  Metric,
  MetricGrid,
  SectionHeading,
  InlineError,
  TermChip,
} from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { Body, Caption } from "@/src/components/typography";
import { Badge } from "@/src/components/badges";
import { Skeleton } from "@/src/components/feedback";
import { Dismissible } from "@/src/components/dismissible";
import { bodyFont } from "@/src/theme/typography";
import {
  GraduationCap,
  Users,
  Layers,
  CreditCard,
  DollarSign,
  FileText,
  Megaphone,
  Bell,
  ClipboardCheck,
  Receipt,
  ScanLine,
} from "lucide-react-native";

const naira = (n: number) => "₦" + Number(n || 0).toLocaleString();

export default function AdminDashboard() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { term } = useCurrentTerm();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The outstanding-fees card is dismissible (swipe left or tap the X).
  // Persisted per device; restorable from Settings.
  const [hideOutstanding, setHideOutstanding] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPref("hideAdminOutstanding")
      .then((v) => {
        if (!cancelled) setHideOutstanding(v);
      })
      .catch(() => {
        if (!cancelled) setHideOutstanding(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function dismissOutstanding() {
    setHideOutstanding(true);
    await setPref("hideAdminOutstanding", true);
  }

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await adminApi.dashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the school overview.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const s = data?.stats;
  const outstanding = Number(s?.outstandingFees ?? 0);
  const hasOutstanding = outstanding > 0;

  const tiles = [
    {
      icon: GraduationCap,
      label: "Students",
      desc: "Roster & enrolment",
      route: "/admin-students",
      count: s?.studentCount,
    },
    {
      icon: Users,
      label: "Staff",
      desc: "Teaching & non-teaching",
      route: "/admin-staff",
      count: s?.teacherCount,
    },
    {
      icon: ScanLine,
      label: "Staff Attendance",
      desc: "Badge check-in/out",
      route: "/staff-attendance",
    },
    { icon: DollarSign, label: "Finance", desc: "Revenue & net position", route: "/admin-finance" },
    { icon: Receipt, label: "Expenses", desc: "Record & review spend", route: "/admin-expenses" },
    {
      icon: CreditCard,
      label: "Fees",
      desc: "Outstanding & collections",
      route: "/admin-fees",
      count: s?.openInvoiceCount,
      alert: hasOutstanding,
    },
    {
      icon: FileText,
      label: "Admissions",
      desc: "Applications to review",
      route: "/admin-admissions",
      count: s?.pendingApplications,
      alert: s?.pendingApplications > 0,
    },
    {
      icon: FileText,
      label: "Report Cards",
      desc: "Generate & release",
      route: "/admin-reports",
      count: s?.draftReports,
      alert: s?.draftReports > 0,
    },
    { icon: Megaphone, label: "Announcements", desc: "Post school news", route: "/admin-news" },
    { icon: Bell, label: "Notifications", desc: "Broadcast alerts", route: "/admin-notifications" },
    {
      icon: ClipboardCheck,
      label: "Attendance",
      desc: "Correction requests",
      route: "/admin-corrections",
      count: s?.pendingCorrections,
      alert: s?.pendingCorrections > 0,
    },
  ];

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
      <AppHeader onBellPress={() => router.push("/admin-notifications")} />

      <DashboardGreeting
        name={data?.admin?.name || (loading ? "" : "Administrator")}
        subtitle="School overview"
        onAvatarPress={() => router.push("/(admin)/profile")}
      />

      <TermChip
        sessionLabel={term?.sessionLabel}

        termLabel={term?.termLabel}

        estimated={term?.isEstimated}

        style={{ marginBottom: spacing.md }}
      />

      {error ? <InlineError message={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <>
          <Skeleton width="100%" height={116} radius={16} style={{ marginBottom: 10 }} />
          <MetricGrid>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width="48%" height={104} radius={16} />
            ))}
          </MetricGrid>
        </>
      ) : (
        <>
          {!hideOutstanding ? (
            <Dismissible onDismiss={dismissOutstanding} closeLabel="Hide outstanding fees card">
              <Card
                variant="bordered"
                padding={spacing.md}
                onPress={() => router.push("/admin-fees")}
                style={{
                  marginBottom: spacing.sm + 2,
                  borderColor: hasOutstanding
                    ? colors.status.errorBorder
                    : colors.status.successBorder,
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
                    OUTSTANDING FEES
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
                  {s?.openInvoiceCount || 0} open invoices
                  {s?.attendanceRateToday != null
                    ? ` · ${s.attendanceRateToday}% present today`
                    : ""}
                </Caption>
              </Card>
            </Dismissible>
          ) : null}

          <MetricGrid style={{ marginBottom: spacing.lg }}>
            <Metric
              icon={<GraduationCap size={18} color={colors.brand.greenLight} />}
              label="Students"
              value={s?.studentCount ?? "—"}
              onPress={() => router.push("/admin-students")}
            />
            <Metric
              icon={<Users size={18} color={colors.brand.greenLight} />}
              label="Staff"
              value={s?.teacherCount ?? "—"}
              onPress={() => router.push("/admin-staff")}
            />
            <Metric
              icon={<Layers size={18} color={colors.brand.greenLight} />}
              label="Classes"
              value={s?.classCount ?? "—"}
            />
            <Metric
              icon={<Users size={18} color={colors.brand.greenLight} />}
              label="Parents"
              value={s?.parentCount ?? "—"}
            />
          </MetricGrid>
        </>
      )}

      <SectionHeading title="Control center" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm + 2 }}>
        {tiles.map((t) => {
          const Icon = t.icon;
          const showBadge = t.count != null && t.count > 0;
          return (
            <TouchableOpacity
              key={t.label}
              onPress={() => router.push(t.route as never)}
              activeOpacity={0.85}
              style={{ width: "48%" }}
            >
              <Card variant="default" padding={spacing.md} style={{ height: 116 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.sm + 2,
                      backgroundColor: (t.alert ? colors.warning : colors.brand.green) + "1F",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Icon size={19} color={t.alert ? colors.warning : colors.brand.greenLight} />
                  </View>
                  {showBadge ? (
                    <Badge tone={t.alert ? "warning" : "neutral"}>{String(t.count)}</Badge>
                  ) : null}
                </View>

                <Body
                  tone="primary"
                  style={{ fontFamily: bodyFont("bold"), marginTop: spacing.sm + 2 }}
                >
                  {t.label}
                </Body>
                <Caption numberOfLines={1} style={{ fontSize: 11.5 }}>
                  {t.desc}
                </Caption>
              </Card>
            </TouchableOpacity>
          );
        })}
      </View>
    </Screen>
  );
}
