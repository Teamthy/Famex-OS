import { useEffect, useState } from "react";
import { ScrollView, RefreshControl } from "react-native";
import { adminApi } from "@/lib/api";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { InlineError } from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Column } from "@/src/components/layout";
import { bodyFont } from "@/src/theme/typography";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Receipt } from "lucide-react-native";

const naira = (n: number) => "₦" + Number(n || 0).toLocaleString();

export default function AdminFinance() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    try {
      setError(null);
      setData(await adminApi.finances());
    } catch (err) {
      // Previously `catch {}` — a failed request rendered an empty
      // screen indistinguishable from "there is nothing here".
      setError(err instanceof Error ? err.message : "Couldn't load finances.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  const s = data?.summary || {};
  const income = data?.recentIncome || [];
  const expenses = data?.recentExpenses || [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand.greenLight} />}>
      <H2 style={{ marginBottom: spacing.lg }}>Finance</H2>
      {error ? <InlineError message={error} onRetry={() => { void load(); }} /> : null}

      <Card
        variant="default"
        padding={spacing.md}
        onPress={() => router.push("/admin-expenses")}
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, marginBottom: spacing.md }}
      >
        <Receipt size={18} color={colors.brand.greenLight} />
        <Body tone="primary" style={{ flex: 1, fontFamily: bodyFont("medium") }}>Record an expense</Body>
        <ArrowUpRight size={16} color={colors.text.muted} />
      </Card>

      {/* Net position */}
      <Card variant="bordered" style={{ marginBottom: spacing.md }}>
        <Row2 icon={<Wallet size={18} color={s.netPosition >= 0 ? colors.success : colors.danger} />} label="Net Position" />
        <H2 style={{ color: s.netPosition >= 0 ? colors.success : colors.danger, fontSize: 30, marginTop: spacing.xs }}>{naira(s.netPosition)}</H2>
      </Card>

      <Column gap={spacing.sm} style={{ marginBottom: spacing.lg }}>
        <Stat icon={<TrendingUp size={18} color={colors.success} />} label="Total Income" value={naira(s.totalIncome)} color={colors.success} />
        <Stat icon={<TrendingDown size={18} color={colors.danger} />} label="Total Expenses" value={naira(s.totalExpenses)} color={colors.danger} />
      </Column>

      <Card variant="default" padding={spacing.md} style={{ marginBottom: spacing.lg }}>
        <Caption>Billed {naira(s.totalBilled)} · Collected {naira(s.totalCollected)}</Caption>
        <Caption style={{ marginTop: 4, color: colors.brand.greenLight }}>Collection rate: {s.collectionRate ?? 0}%</Caption>
        {s.pendingBankTransfers > 0 && <Caption style={{ marginTop: 4, color: colors.warning }}>{s.pendingBankTransfers} bank transfers pending</Caption>}
      </Card>

      <Label style={{ marginBottom: spacing.xs + 2 }}>Recent Income</Label>
      <Column gap={spacing.xs} style={{ marginBottom: spacing.lg }}>
        {income.slice(0, 8).map((p: any) => (
          <Card key={p.id} variant="default" padding={12} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <ArrowUpRight size={16} color={colors.success} />
            <Column style={{ flex: 1 }}>
              <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>{p.studentName || "Payment"}</Body>
              <Caption>{p.receiptNumber} · {new Date(p.paidAt).toLocaleDateString("en", { month: "short", day: "numeric" })}</Caption>
            </Column>
            <Body style={{ color: colors.success, fontFamily: bodyFont("bold") }}>+{naira(p.amount)}</Body>
          </Card>
        ))}
        {income.length === 0 && <Caption>No payments yet.</Caption>}
      </Column>

      <Label style={{ marginBottom: spacing.xs + 2 }}>Recent Expenses</Label>
      <Column gap={spacing.xs}>
        {expenses.slice(0, 8).map((e: any) => (
          <Card key={e.id} variant="default" padding={12} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <ArrowDownRight size={16} color={colors.danger} />
            <Column style={{ flex: 1 }}>
              <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>{e.title || e.category}</Body>
              <Caption>{e.category} · {e.vendor || "—"}</Caption>
            </Column>
            <Body style={{ color: colors.danger, fontFamily: bodyFont("bold") }}>-{naira(e.amount)}</Body>
          </Card>
        ))}
        {expenses.length === 0 && <Caption>No expenses recorded.</Caption>}
      </Column>
    </ScrollView>
  );
}

function Row2({ icon, label }: { icon: React.ReactNode; label: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
      {icon}
      <Label>{label}</Label>
    </View>
  );
}
function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const { spacing } = useTheme();
  return (
    <Card variant="default" padding={spacing.md} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 }}>
      {icon}
      <Column style={{ flex: 1 }}>
        <Caption>{label}</Caption>
        <Body tone="primary" style={{ fontFamily: bodyFont("bold"), fontSize: 18, color }}>{value}</Body>
      </Column>
    </Card>
  );
}

import { View } from "react-native";
