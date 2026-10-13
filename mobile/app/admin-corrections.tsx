import { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { adminApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { InlineError } from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Badge } from "@/src/components/badges";
import { Column } from "@/src/components/layout";
import { EmptyState } from "@/src/components/feedback";
import { bodyFont } from "@/src/theme/typography";
import { ClipboardCheck } from "lucide-react-native";

function tone(s: string): any { return s === "PENDING" ? "warning" : s === "APPROVED" ? "success" : s === "REJECTED" ? "danger" : "neutral"; }

export default function AdminCorrections() {
  const { colors, spacing } = useTheme();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    try {
      setError(null);
      setData(await adminApi.attendanceCorrections());
    } catch (err) {
      // Previously `catch {}` — a failed request rendered an empty
      // screen indistinguishable from "there is nothing here".
      setError(err instanceof Error ? err.message : "Couldn't load correction requests.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  const requests = data?.requests || [];
  const pending = requests.filter((r: any) => r.status === "PENDING").length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand.greenLight} />}>
      <H2 style={{ marginBottom: spacing.xs }}>Attendance Corrections</H2>
      {error ? <InlineError message={error} onRetry={() => { void load(); }} /> : null}
      <Caption style={{ marginBottom: spacing.lg }}>{requests.length} requests · {pending} pending</Caption>

      {requests.length > 0 ? (
        <Column gap={spacing.xs + 2}>
          {requests.map((r: any) => (
            <Card key={r.id} variant="default" padding={spacing.md}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Column style={{ flex: 1, marginRight: 8 }}>
                  <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>{r.teacherProfile?.displayName || "Teacher"}</Body>
                  <Caption style={{ marginTop: 2 }}>{r.attendanceSession?.classroom?.displayName || "Class"} · {r.attendanceSession?.sessionDate ? new Date(r.attendanceSession.sessionDate).toLocaleDateString("en", { day: "numeric", month: "short" }) : "—"}</Caption>
                </Column>
                <Badge tone={tone(r.status)}>{r.status}</Badge>
              </View>
              {r.reason ? <Body style={{ marginTop: spacing.xs + 2 }}>{r.reason}</Body> : null}
              {r.resolutionNote ? <Caption style={{ color: colors.brand.greenLight, marginTop: 4 }}>Resolution: {r.resolutionNote}</Caption> : null}
              <Caption style={{ marginTop: spacing.xs + 2 }}>Requested by {r.requestedBy?.name || "—"}</Caption>
            </Card>
          ))}
        </Column>
      ) : (
        <EmptyState icon={<ClipboardCheck size={48} color={colors.border.strong} />} title="No correction requests" />
      )}
    </ScrollView>
  );
}
