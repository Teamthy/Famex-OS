import { useEffect, useState } from "react";
import { ScrollView, RefreshControl } from "react-native";
import { adminApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { InlineError } from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Badge } from "@/src/components/badges";
import { Column } from "@/src/components/layout";
import { EmptyState } from "@/src/components/feedback";
import { bodyFont } from "@/src/theme/typography";
import { FileText } from "lucide-react-native";

function statusTone(status: string): any {
  if (status === "ACCEPTED" || status === "ENROLLED") return "success";
  if (status === "REJECTED") return "danger";
  if (status === "PENDING_REVIEW") return "warning";
  return "neutral";
}

export default function AdminAdmissions() {
  const { colors, spacing } = useTheme();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    try {
      setError(null);
      setData(await adminApi.admissions());
    } catch (err) {
      // Previously `catch {}` — a failed request rendered an empty
      // screen indistinguishable from "there is nothing here".
      setError(err instanceof Error ? err.message : "Couldn't load admissions.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  const apps = data?.applications || [];
  const pending = apps.filter((a: any) => a.status === "PENDING_REVIEW").length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand.greenLight} />}>
      <H2 style={{ marginBottom: spacing.xs }}>Admissions</H2>
      {error ? <InlineError message={error} onRetry={() => { void load(); }} /> : null}
      <Caption style={{ marginBottom: spacing.lg }}>{apps.length} applications · {pending} pending review</Caption>

      {apps.length > 0 ? (
        <Column gap={spacing.xs + 2}>
          {apps.map((a: any) => (
            <Card key={a.applicationId} variant="default" padding={spacing.md}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Column style={{ flex: 1, marginRight: 8 }}>
                  <Body tone="primary" style={{ fontFamily: bodyFont("bold") }}>{a.firstName} {a.lastName}</Body>
                  <Caption style={{ marginTop: 2 }}>Applying: {a.classApplying}{a.preferredArm ? ` (${a.preferredArm})` : ""}</Caption>
                </Column>
                <Badge tone={statusTone(a.status)}>{a.status?.replace("_", " ")}</Badge>
              </View>
              <Caption style={{ marginTop: spacing.xs + 2 }}>👤 {a.parentEmail}{a.parentPhone ? ` · ${a.parentPhone}` : ""}</Caption>
              {a.previousSchool ? <Caption>Previous: {a.previousSchool}</Caption> : null}
              {a.paymentStatus ? <Caption style={{ color: colors.brand.greenLight }}>Payment: {a.paymentStatus}</Caption> : null}
              {a.submittedAt ? <Caption style={{ marginTop: 2 }}>Submitted {new Date(a.submittedAt).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}</Caption> : null}
            </Card>
          ))}
        </Column>
      ) : (
        <EmptyState icon={<FileText size={48} color={colors.border.strong} />} title="No applications" message="Admission applications will appear here." />
      )}
    </ScrollView>
  );
}

import { View } from "react-native";
