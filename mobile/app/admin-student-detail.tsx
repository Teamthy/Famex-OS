import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, RefreshControl, TouchableOpacity, Linking } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { adminApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Badge } from "@/src/components/badges";
import { Avatar } from "@/src/components/avatar";
import { Skeleton } from "@/src/components/feedback";
import { Metric, MetricGrid, InlineError, SectionHeading } from "@/src/components/dashboard";
import { bodyFont } from "@/src/theme/typography";
import {
  ArrowLeft,
  Mail,
  Phone,
  CalendarCheck,
  FileText,
  Wallet,
  BookOpen,
  ClipboardCheck,
  Users,
  GraduationCap,
} from "lucide-react-native";

export default function AdminStudentDetail() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { colors, spacing, radius } = useTheme();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const res = await adminApi.student(id);
      setData(res?.student ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this student.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const s = data;
  const counts = s?._count || {};
  const guardians = (s?.parentLinks || []).map((l: any) => l.parentProfile).filter(Boolean);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background.primary }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: 58, paddingBottom: 44 }}
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
      <TouchableOpacity
        onPress={() => router.back()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.lg }}
      >
        <ArrowLeft size={20} color={colors.text.muted} />
        <Caption>Students</Caption>
      </TouchableOpacity>

      {error ? <InlineError message={error} onRetry={() => void load()} /> : null}

      {/* ── Identity header ── */}
      <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
        {loading ? (
          <>
            <Skeleton width={88} height={88} radius={26} />
            <Skeleton width={160} height={22} radius={6} style={{ marginTop: 14 }} />
            <Skeleton width={110} height={14} radius={6} style={{ marginTop: 8 }} />
          </>
        ) : (
          <>
            <Avatar name={s?.displayName || name} uri={s?.photoUrl} size="xl" />
            <H2 style={{ marginTop: spacing.md, textAlign: "center", fontSize: 22 }}>
              {s?.displayName || name || "—"}
            </H2>
            <Caption style={{ marginTop: 3 }}>
              {s?.studentId}
              {s?.currentClass?.displayName ? ` · ${s.currentClass.displayName}` : ""}
            </Caption>
            <View style={{ flexDirection: "row", gap: 6, marginTop: spacing.sm }}>
              <Badge tone={s?.isActive === false ? "danger" : "success"}>
                {s?.isActive === false ? "INACTIVE" : "ACTIVE"}
              </Badge>
              {s?.gender ? <Badge tone="neutral">{String(s.gender)}</Badge> : null}
            </View>
          </>
        )}
      </View>

      {/* ── Record counts ── */}
      {loading ? (
        <MetricGrid style={{ marginBottom: spacing.xl }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width="48%" height={100} radius={16} />
          ))}
        </MetricGrid>
      ) : (
        <MetricGrid style={{ marginBottom: spacing.xl }}>
          <Metric
            icon={<CalendarCheck size={18} color={colors.brand.greenLight} />}
            label="Attendance records"
            value={counts.attendanceEntries ?? 0}
          />
          <Metric
            icon={<FileText size={18} color={colors.brand.greenLight} />}
            label="Report cards"
            value={counts.reportCards ?? 0}
          />
          <Metric
            icon={<Wallet size={18} color={colors.brand.greenLight} />}
            label="Invoices"
            value={counts.feeInvoices ?? 0}
          />
          <Metric
            icon={<BookOpen size={18} color={colors.brand.greenLight} />}
            label="Grade entries"
            value={counts.gradebookEntries ?? 0}
          />
          <Metric
            icon={<ClipboardCheck size={18} color={colors.brand.greenLight} />}
            label="Exam attempts"
            value={counts.examAttempts ?? 0}
          />
          <Metric
            icon={<GraduationCap size={18} color={colors.brand.greenLight} />}
            label="Class"
            value={s?.currentClass?.displayName || "—"}
            compact
          />
        </MetricGrid>
      )}

      {/* ── Guardians ── */}
      <SectionHeading title="Parents / guardians" />
      {loading ? (
        <Skeleton width="100%" height={72} radius={16} />
      ) : guardians.length === 0 ? (
        <Card variant="bordered" padding={spacing.md} style={{ marginBottom: spacing.xl }}>
          <Caption>No guardian is linked to this student yet.</Caption>
        </Card>
      ) : (
        <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
          {guardians.map((g: any) => (
            <Card
              key={g.id}
              variant="default"
              padding={spacing.md}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
            >
              <Avatar name={g.displayName} size="md" />
              <View style={{ flex: 1 }}>
                <Body tone="primary" style={{ fontFamily: bodyFont("bold") }} numberOfLines={1}>
                  {g.displayName}
                </Body>
                {g.user?.email ? <Caption numberOfLines={1}>{g.user.email}</Caption> : null}
              </View>

              {/* Contacting a guardian is the most likely reason an admin opens
                  a student record, so both actions are one tap. */}
              <View style={{ flexDirection: "row", gap: 6 }}>
                {g.phone ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${String(g.phone).replace(/\s/g, "")}`)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: radius.sm + 2,
                      backgroundColor: colors.brand.green + "1F",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Phone size={16} color={colors.brand.greenLight} />
                  </TouchableOpacity>
                ) : null}
                {g.user?.email ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`mailto:${g.user.email}`)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: radius.sm + 2,
                      backgroundColor: colors.brand.green + "1F",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Mail size={16} color={colors.brand.greenLight} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* ── Enrolment details ── */}
      {!loading && s ? (
        <>
          <SectionHeading title="Enrolment" />
          <Card variant="default" padding={0}>
            <DetailRow label="Student ID" value={s.studentId} />
            <DetailRow label="Class" value={s.currentClass?.displayName || "—"} />
            <DetailRow
              label="Admitted"
              value={
                s.admissionDate
                  ? new Date(s.admissionDate).toLocaleDateString("en", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"
              }
            />
            <DetailRow
              label="Date of birth"
              value={
                s.dateOfBirth
                  ? new Date(s.dateOfBirth).toLocaleDateString("en", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"
              }
            />
            <DetailRow label="Guardians" value={String(guardians.length)} last />
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

function DetailRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        padding: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border.subtle,
      }}
    >
      <Label>{label}</Label>
      <Body tone="primary" style={{ fontFamily: bodyFont("medium"), fontSize: 14 }} numberOfLines={1}>
        {value}
      </Body>
    </View>
  );
}
