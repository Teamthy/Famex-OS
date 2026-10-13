import { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { studentApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { InlineError } from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { H2, H3, Body, Caption, Label } from "@/src/components/typography";
import { Column, Screen, AppBar } from "@/src/components/layout";
import { EmptyState } from "@/src/components/feedback";
import { bodyFont } from "@/src/theme/typography";
import { FileText, Award, Share2 } from "lucide-react-native";
import { shareReport } from "@/lib/reportShare";
import { useToast } from "@/components/MobileToast";
import { useRouter } from "expo-router";

export default function ReportCards() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");

  async function load() {
    try {
      setError(null);
      const res = await studentApi.reportCards(); setData(res); setSelectedId(res?.reports?.[0]?.id || "");
    } catch (err) {
      // Previously `catch {}` — a failed request rendered an empty
      // screen indistinguishable from "there is nothing here".
      setError(err instanceof Error ? err.message : "Couldn't load your report cards.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  const selected = data?.reports?.find((r: any) => r.id === selectedId) || data?.reports?.[0];

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand.greenLight} />}>
      <AppBar title="Report Cards" onBack={() => router.back()} />
      <H2 style={{ marginBottom: spacing.lg }}>Report Cards</H2>
      {error ? <InlineError message={error} onRetry={() => { void load(); }} /> : null}

      {data?.reports?.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          {data.reports.map((r: any) => (
            <TouchableOpacity key={r.id} onPress={() => setSelectedId(r.id)} style={{ backgroundColor: selectedId === r.id ? colors.brand.green : colors.background.elevated, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginRight: spacing.sm }}>
              <Body tone={selectedId === r.id ? "inverse" : "primary"} style={{ fontFamily: bodyFont("semibold") }}>{r.termLabel} {r.sessionLabel}</Body>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {selected ? (
        <Column gap={spacing.md}>
          <Card variant="bordered">
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Mini label="Total" value={String(selected.overallTotal ?? "—")} />
              <Mini label="Average" value={String(selected.overallAverage ?? "—")} />
              <Mini label="Grade" value={selected.overallGrade || "—"} color={colors.brand.greenLight} />
            </View>
            {selected.classPosition ? (
              <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center", marginTop: spacing.sm }}>
                <Award size={16} color={colors.brand.greenLight} />
                <Body>Class Position: {selected.classPosition}</Body>
              </View>
            ) : null}
          </Card>

          <TouchableOpacity
            onPress={async () => {
              const ok = await shareReport(selected, data?.student?.displayName);
              if (ok) toast("Report shared");
              else toast("Sharing isn't available on this device", "error");
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
              paddingVertical: 12,
              borderRadius: 20,
              backgroundColor: colors.brand.green,
            }}
          >
            <Share2 size={16} color={colors.brand.white} />
            <Body tone="inverse" style={{ fontFamily: bodyFont("semibold") }}>Share this result</Body>
          </TouchableOpacity>

          <Column gap={spacing.xs}>
            <Label>Subjects</Label>
            {selected.subjects?.map((subj: any, i: number) => (
              <Card key={i} variant="default" padding={14} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Column style={{ flex: 1 }}>
                  <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>{subj.subject}</Body>
                  <Caption style={{ marginTop: 2 }}>CA: {subj.ca1 + subj.ca2} · Exam: {subj.exam}</Caption>
                </Column>
                <Column style={{ alignItems: "flex-end" }}>
                  <H3 style={{ fontSize: 18 }}>{subj.total}</H3>
                  <GradeChip grade={subj.grade} total={subj.total} />
                </Column>
              </Card>
            ))}
          </Column>

          {selected.classTeacherRemark ? (
            <Card variant="default" padding={14}>
              <Label>Teacher's Remark</Label>
              <Body style={{ marginTop: 6 }}>{selected.classTeacherRemark}</Body>
            </Card>
          ) : null}
        </Column>
      ) : (
        <EmptyState icon={<FileText size={48} color={colors.border.strong} />} title="No report cards available" />
      )}
    </Screen>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View>
      <Caption>{label}</Caption>
      <H2 style={{ color: color ?? colors.text.primary, fontSize: 26, marginTop: 2 }}>{value}</H2>
    </View>
  );
}

/** Grade pill coloured by score — green (pass, ≥70), amber (≥45), red otherwise. */
function GradeChip({ grade, total }: { grade?: string; total?: number }) {
  const { colors, radius, spacing } = useTheme();
  const tint =
    total == null ? colors.brand.greenLight : total >= 70 ? colors.success : total >= 45 ? colors.warning : colors.danger;
  return (
    <View
      style={{
        marginTop: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.sm,
        backgroundColor: `${tint}22`,
        borderWidth: 1,
        borderColor: `${tint}55`,
      }}
    >
      <Caption style={{ color: tint, fontFamily: bodyFont("bold"), fontSize: 11 }}>
        {grade || "—"}
      </Caption>
    </View>
  );
}
