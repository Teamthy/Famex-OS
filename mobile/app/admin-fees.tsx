import { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl, Alert } from "react-native";
import { adminApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { InlineError } from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Button } from "@/src/components/buttons";
import { Column } from "@/src/components/layout";
import { bodyFont } from "@/src/theme/typography";
import { CreditCard, Send } from "lucide-react-native";

const naira = (n: number) => "₦" + Number(n || 0).toLocaleString();

export default function AdminFees() {
  const { colors, spacing } = useTheme();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      setError(null);
      setData(await adminApi.fees());
    } catch (err) {
      // Previously `catch {}` — a failed request rendered an empty
      // screen indistinguishable from "there is nothing here".
      setError(err instanceof Error ? err.message : "Couldn't load fees.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function sendReminders() {
    setSending(true);
    try { await adminApi.sendFeeReminders(); Alert.alert("Sent", "Fee reminders queued for outstanding balances."); }
    catch (e: any) { Alert.alert("Failed", e.message || "Could not send reminders."); }
    finally { setSending(false); }
  }

  const s = data?.summary || {};

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand.greenLight} />}>
      <H2 style={{ marginBottom: spacing.lg }}>Fees</H2>
      {error ? <InlineError message={error} onRetry={() => { void load(); }} /> : null}

      <Card variant="bordered" style={{ marginBottom: spacing.md, borderColor: s.totalOutstanding > 0 ? colors.danger : colors.success }}>
        <Row2 icon={<CreditCard size={18} color={s.totalOutstanding > 0 ? colors.danger : colors.success} />} label="Outstanding" />
        <H2 style={{ color: s.totalOutstanding > 0 ? colors.danger : colors.success, fontSize: 30, marginTop: spacing.xs }}>{naira(s.totalOutstanding)}</H2>
        <Caption style={{ marginTop: 4 }}>Collected {naira(s.totalCollected)} of {naira(s.totalBilled)} ({s.collectionRate ?? 0}%)</Caption>
      </Card>

      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
        <Mini label="Paid" value={s.paidInvoices ?? 0} color={colors.success} />
        <Mini label="Partial" value={s.partialInvoices ?? 0} color={colors.warning} />
        <Mini label="Unpaid" value={s.unpaidInvoices ?? 0} color={colors.danger} />
      </View>

      <Label style={{ marginBottom: spacing.sm }}>Fee Reminders</Label>
      <Card variant="default" padding={spacing.md}>
        <Body>Send payment reminders to parents with outstanding balances across all {s.invoiceCount ?? 0} invoices.</Body>
        <Button fullWidth loading={sending} leftIcon={<Send size={16} color={colors.brand.white} />} onPress={sendReminders} style={{ marginTop: spacing.md }}>
          {sending ? "Sending…" : "Send Reminders"}
        </Button>
      </Card>
    </ScrollView>
  );
}

function Row2({ icon, label }: { icon: React.ReactNode; label: string }) {
  const { spacing } = useTheme();
  return (<View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>{icon}<Label>{label}</Label></View>);
}
function Mini({ label, value, color }: { label: string; value: number; color: string }) {
  const { spacing } = useTheme();
  return (<Card variant="default" padding={spacing.sm + 2} style={{ flex: 1, alignItems: "center" }}><Body style={{ color, fontFamily: bodyFont("bold"), fontSize: 20 }}>{value}</Body><Caption>{label}</Caption></Card>);
}
