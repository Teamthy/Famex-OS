import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, RefreshControl, TouchableOpacity, Linking } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { adminApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Badge } from "@/src/components/badges";
import { Avatar } from "@/src/components/avatar";
import { Skeleton, EmptyState } from "@/src/components/feedback";
import { Metric, MetricGrid, InlineError, SectionHeading } from "@/src/components/dashboard";
import { roleLabel } from "@/lib/useSession";
import { bodyFont } from "@/src/theme/typography";
import {
  ArrowLeft,
  Mail,
  Phone,
  Layers,
  Users,
  BookOpen,
  ClipboardCheck,
} from "lucide-react-native";

export default function AdminStaffDetail() {
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
      const res = await adminApi.staffMember(id);
      setData(res?.staff ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this staff member.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const t = data;
  const assignments = t?.classAssignments || [];
  const formClasses = assignments.filter((a: any) => a.role === "FORM_TEACHER");

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
        <Caption>Staff</Caption>
      </TouchableOpacity>

      {error ? <InlineError message={error} onRetry={() => void load()} /> : null}

      <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
        {loading ? (
          <>
            <Skeleton width={88} height={88} radius={26} />
            <Skeleton width={170} height={22} radius={6} style={{ marginTop: 14 }} />
            <Skeleton width={120} height={14} radius={6} style={{ marginTop: 8 }} />
          </>
        ) : (
          <>
            <Avatar name={t?.displayName || name} uri={t?.photoUrl} size="xl" />
            <H2 style={{ marginTop: spacing.md, textAlign: "center", fontSize: 22 }}>
              {t?.displayName || name || "—"}
            </H2>
            <Caption style={{ marginTop: 3 }}>
              {t?.roleLabel || roleLabel(t?.user?.role) || "Staff"}
              {t?.badgeCode ? ` · ${t.badgeCode}` : ""}
            </Caption>

            <View style={{ flexDirection: "row", gap: 6, marginTop: spacing.sm }}>
              <Badge tone={t?.isActive === false ? "danger" : "success"}>
                {t?.isActive === false ? "INACTIVE" : "ACTIVE"}
              </Badge>
              {formClasses.length > 0 ? <Badge tone="accent">FORM TEACHER</Badge> : null}
            </View>

            {/* Contact actions */}
            {!loading && (t?.phone || t?.user?.email) ? (
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
                {t?.phone ? (
                  <ContactButton
                    icon={<Phone size={16} color={colors.brand.greenLight} />}
                    label="Call"
                    onPress={() => Linking.openURL(`tel:${String(t.phone).replace(/\s/g, "")}`)}
                  />
                ) : null}
                {t?.user?.email ? (
                  <ContactButton
                    icon={<Mail size={16} color={colors.brand.greenLight} />}
                    label="Email"
                    onPress={() => Linking.openURL(`mailto:${t.user.email}`)}
                  />
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </View>

      {loading ? (
        <MetricGrid style={{ marginBottom: spacing.xl }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width="48%" height={100} radius={16} />
          ))}
        </MetricGrid>
      ) : (
        <MetricGrid style={{ marginBottom: spacing.xl }}>
          <Metric
            icon={<Layers size={18} color={colors.brand.greenLight} />}
            label="Classes"
            value={assignments.length}
          />
          <Metric
            icon={<Users size={18} color={colors.brand.greenLight} />}
            label="Students reached"
            value={t?.totalStudents ?? 0}
          />
          <Metric
            icon={<BookOpen size={18} color={colors.brand.greenLight} />}
            label="Subjects"
            value={(t?.subjects || []).length}
          />
          <Metric
            icon={<ClipboardCheck size={18} color={colors.brand.greenLight} />}
            label="Registers taken"
            value={t?._count?.attendanceSessions ?? 0}
          />
        </MetricGrid>
      )}

      <SectionHeading title="Class assignments" />
      {loading ? (
        <Skeleton width="100%" height={72} radius={16} />
      ) : assignments.length === 0 ? (
        <Card variant="bordered" padding={spacing.lg} style={{ marginBottom: spacing.xl }}>
          <EmptyState
            icon={<Layers size={32} color={colors.border.strong} />}
            title="No classes assigned"
            message="Assign classes from the web portal."
          />
        </Card>
      ) : (
        <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
          {assignments.map((a: any) => (
            <Card
              key={a.id}
              variant="default"
              padding={spacing.md}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.sm + 2,
                  backgroundColor: colors.brand.green + "1A",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Layers size={17} color={colors.brand.greenLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Body tone="primary" style={{ fontFamily: bodyFont("bold") }}>
                  {a.classroom?.displayName}
                </Body>
                <Caption style={{ marginTop: 2 }}>
                  {a.subjectName ? `${a.subjectName} · ` : ""}
                  {a.classroom?._count?.students ?? 0} students
                </Caption>
              </View>
              <Badge tone={a.role === "FORM_TEACHER" ? "accent" : "neutral"}>
                {a.role === "FORM_TEACHER" ? "FORM" : "SUBJECT"}
              </Badge>
            </Card>
          ))}
        </View>
      )}

      {!loading && t ? (
        <>
          <SectionHeading title="Account" />
          <Card variant="default" padding={0}>
            <DetailRow label="Email" value={t.user?.email || "—"} />
            <DetailRow label="Phone" value={t.phone || "—"} />
            <DetailRow label="System role" value={roleLabel(t.user?.role) || "—"} />
            <DetailRow
              label="Last sign-in"
              value={
                t.user?.lastLoginAt
                  ? new Date(t.user.lastLoginAt).toLocaleDateString("en", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Never"
              }
            />
            <DetailRow
              label="Joined"
              value={
                t.createdAt
                  ? new Date(t.createdAt).toLocaleDateString("en", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"
              }
              last
            />
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

function ContactButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingVertical: 9,
        paddingHorizontal: spacing.md,
        borderRadius: radius.round,
        backgroundColor: colors.surface.card,
        borderWidth: 1,
        borderColor: colors.border.default,
      }}
    >
      {icon}
      <Caption style={{ color: colors.text.primary, fontFamily: bodyFont("medium") }}>
        {label}
      </Caption>
    </TouchableOpacity>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
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
      <Body
        tone="primary"
        style={{ fontFamily: bodyFont("medium"), fontSize: 14, flexShrink: 1 }}
        numberOfLines={1}
      >
        {value}
      </Body>
    </View>
  );
}
