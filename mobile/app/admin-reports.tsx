import { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl, Alert } from "react-native";
import { adminApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { InlineError } from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Badge } from "@/src/components/badges";
import { Button } from "@/src/components/buttons";
import { Column } from "@/src/components/layout";
import { EmptyState } from "@/src/components/feedback";
import { bodyFont } from "@/src/theme/typography";
import { FileText, Sparkles } from "lucide-react-native";

export default function AdminReports() {
  const { colors, spacing } = useTheme();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function load() {
    try {
      setError(null);
      setData(await adminApi.reportCards());
    } catch (err) {
      // Previously `catch {}` — a failed request rendered an empty
      // screen indistinguishable from "there is nothing here".
      setError(err instanceof Error ? err.message : "Couldn't load report cards.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    setGenerating(true);
    try { await adminApi.generateReports(); Alert.alert("Queued", "Report card generation has been queued."); load(); }
    catch (e: any) { Alert.alert("Failed", e.message || "Could not generate reports."); }
    finally { setGenerating(false); }
  }

  const s = data?.summary || {};
  const reports = data?.reports || [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand.greenLight} />}>
      <H2 style={{ marginBottom: spacing.lg }}>Report Cards</H2>
      {error ? <InlineError message={error} onRetry={() => { void load(); }} /> : null}

      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
        <Mini label="Total" value={s.totalReports ?? 0} color={colors.text.primary} />
        <Mini label="Released" value={s.releasedReports ?? 0} color={colors.success} />
        <Mini label="Drafts" value={s.draftReports ?? 0} color={colors.warning} />
      </View>

      {s.averageScore ? (
        <Card variant="default" padding={spacing.md} style={{ marginBottom: spacing.md }}>
          <Caption>School average score across reports</Caption>
          <Body tone="primary" style={{ fontFamily: bodyFont("bold"), fontSize: 22, color: colors.brand.greenLight, marginTop: 4 }}>{s.averageScore}%</Body>
        </Card>
      ) : null}

      <Button fullWidth loading={generating} leftIcon={<Sparkles size={16} color={colors.brand.white} />} onPress={generate} style={{ marginBottom: spacing.lg }}>
        {generating ? "Generating…" : "Generate Report Cards"}
      </Button>

      <Label style={{ marginBottom: spacing.xs + 2 }}>Recent Reports</Label>
      <Column gap={spacing.xs}>
        {reports.slice(0, 30).map((r: any) => (
          <Card key={r.id} variant="default" padding={12} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Column style={{ flex: 1 }}>
              <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>{r.reportNumber}</Body>
              <Caption>{r.termLabel} {r.sessionLabel} · {r.classNameSnapshot}</Caption>
            </Column>
            <View style={{ alignItems: "flex-end" }}>
              <Body style={{ fontFamily: bodyFont("bold") }}>{r.overallAverage}</Body>
              <Badge tone={r.status === "RELEASED" ? "success" : "warning"}>{r.status}</Badge>
            </View>
          </Card>
        ))}
        {reports.length === 0 && <EmptyState icon={<FileText size={48} color={colors.border.strong} />} title="No report cards yet" />}
      </Column>
    </ScrollView>
  );
}

function Mini({ label, value, color }: { label: string; value: number; color: string }) {
  const { spacing } = useTheme();
  return (<Card variant="default" padding={spacing.sm + 2} style={{ flex: 1, alignItems: "center" }}><Body style={{ color, fontFamily: bodyFont("bold"), fontSize: 20 }}>{value}</Body><Caption>{label}</Caption></Card>);
}
