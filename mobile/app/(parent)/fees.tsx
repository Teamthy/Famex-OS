import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { parentApi } from "@/lib/api";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, H3, Body, Caption, Label } from "@/src/components/typography";
import { Badge } from "@/src/components/badges";
import { Button } from "@/src/components/buttons";
import { Row, Column, Screen, AppBar } from "@/src/components/layout";
import { EmptyState } from "@/src/components/feedback";
import { bodyFont } from "@/src/theme/typography";
import { CreditCard, CheckCircle2, Clock, AlertCircle, Receipt } from "lucide-react-native";
import { useToast } from "@/components/MobileToast";

const naira = (n: number) => "₦" + Number(n || 0).toLocaleString();

export default function ParentFees() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const [data, setData] = useState<any>(null);
  const [childId, setChildId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const { toast } = useToast();

  async function load(id?: string) {
    try {
      const res = await parentApi.fees(id || undefined);
      setData(res);
      if (!id) setChildId(res?.selectedChild?.id || "");
    } catch {
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function selectChild(id: string) {
    setChildId(id);
    load(id);
  }

  async function pay(invoice: any) {
    setPaying(invoice.id);
    try {
      const res: any = await parentApi.pay(invoice.id, "PAYSTACK");
      if (res.authorizationUrl)
        router.push({
          pathname: "/pay",
          params: { url: res.authorizationUrl, reference: res.reference },
        });
      else toast(res.message || "Payment initiated.", "success");
    } catch (e: any) {
      toast(e.message || "Could not start payment.", "error");
    } finally {
      setPaying(null);
    }
  }

  const children = data?.children || [];
  const invoices = data?.invoices || [];
  const summary = data?.summary;
  const meta = (status: string) =>
    status === "PAID"
      ? {
          tone: "success" as const,
          icon: <CheckCircle2 size={12} color={colors.success} />,
          label: "PAID",
        }
      : status === "PARTIALLY_PAID"
        ? {
            tone: "warning" as const,
            icon: <Clock size={12} color={colors.warning} />,
            label: "PARTIAL",
          }
        : status === "OVERDUE"
          ? {
              tone: "danger" as const,
              icon: <AlertCircle size={12} color={colors.danger} />,
              label: "OVERDUE",
            }
          : {
              tone: "neutral" as const,
              icon: <Clock size={12} color={colors.text.muted} />,
              label: status,
            };

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load(childId);
          }}
          tintColor={colors.brand.greenLight}
        />
      }
    >
      <AppBar title="School Fees" onBack={() => router.back()} />
      <H2 style={{ marginBottom: spacing.md }}>School Fees</H2>

      {children.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: spacing.md }}
        >
          {children.map((c: any) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => selectChild(c.id)}
              style={{
                backgroundColor: childId === c.id ? colors.brand.green : colors.background.elevated,
                borderRadius: 20,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                marginRight: spacing.sm,
              }}
            >
              <Text
                style={{
                  color: childId === c.id ? colors.text.inverse : colors.text.primary,
                  fontSize: 13,
                  fontFamily: bodyFont("semibold"),
                }}
              >
                {c.displayName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Card variant="bordered" style={{ marginBottom: spacing.lg }}>
        <Row justify="space-between">
          <Col label="Total Billed" value={naira(summary?.totalBilled)} />
          <Col label="Paid" value={naira(summary?.totalPaid)} color={colors.success} />
          <Col
            label="Outstanding"
            value={naira(summary?.totalOutstanding)}
            color={summary?.totalOutstanding > 0 ? colors.danger : colors.success}
          />
        </Row>
      </Card>

      {/* ── Receipt history ── */}
      {data?.payments?.length > 0 ? (
        <View style={{ marginBottom: spacing.lg }}>
          <Label style={{ marginBottom: spacing.sm }}>Payment receipts</Label>
          {data.payments.slice(0, 10).map((p: any) => (
            <Card
              key={p.id}
              variant="default"
              padding={spacing.sm + 4}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, marginBottom: spacing.xs + 2 }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: `${colors.brand.green}1F`,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Receipt size={18} color={colors.brand.greenLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>
                  {naira(p.amount)}
                </Body>
                <Caption numberOfLines={1}>
                  {p.receiptNumber || p.reference}{" "}
                  {p.paidAt
                    ? `· ${new Date(p.paidAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                    : ""}
                </Caption>
              </View>
              <Badge tone="success">
                {p.method === "PAYSTACK" ? "CARD" : p.method || "PAID"}
              </Badge>
            </Card>
          ))}
        </View>
      ) : null}

      {invoices.length > 0 ? (
        invoices.map((inv: any) => {
          const s = meta(inv.status);
          const due = inv.balanceDue > 0;
          return (
            <Card
              key={inv.id}
              variant="default"
              padding={spacing.md}
              style={{ marginBottom: spacing.sm + 2 }}
            >
              <Row align="flex-start" gap={spacing.xs}>
                <Column style={{ flex: 1, marginRight: spacing.xs }}>
                  <Body tone="primary" style={{ fontFamily: bodyFont("bold") }}>
                    {inv.title}
                  </Body>
                  <Caption style={{ marginTop: 3 }}>
                    {inv.invoiceNumber} · {inv.termLabel}
                  </Caption>
                </Column>
                <Badge tone={s.tone} icon={s.icon}>
                  {s.label}
                </Badge>
              </Row>
              <Row gap={spacing.lg} style={{ marginTop: spacing.sm + 2 }}>
                <Pair label="Amount" value={naira(inv.totalAmount)} />
                <Pair label="Paid" value={naira(inv.amountPaid)} color={colors.success} />
                <Pair
                  label="Balance"
                  value={naira(inv.balanceDue)}
                  color={due ? colors.danger : colors.text.primary}
                />
              </Row>
              {inv.dueDate && (
                <Caption style={{ marginTop: spacing.xs + 2 }}>
                  Due{" "}
                  {new Date(inv.dueDate).toLocaleDateString("en", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Caption>
              )}
              {due && (
                <Button
                  fullWidth
                  style={{ marginTop: spacing.sm + 4 }}
                  loading={paying === inv.id}
                  leftIcon={
                    paying === inv.id ? undefined : (
                      <CreditCard size={16} color={colors.brand.white} />
                    )
                  }
                  onPress={() => pay(inv)}
                >
                  {paying === inv.id ? "Starting…" : "Pay with Card"}
                </Button>
              )}
            </Card>
          );
        })
      ) : (
        <EmptyState
          icon={<CreditCard size={48} color={colors.border.strong} />}
          title="No invoices yet"
        />
      )}
    </Screen>
  );
}

function Col({ label, value, color }: { label: string; value: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View>
      <Caption>{label}</Caption>
      <H3 style={{ color: color ?? colors.text.primary, fontSize: 16, marginTop: 3 }}>{value}</H3>
    </View>
  );
}
function Pair({ label, value, color }: { label: string; value: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View>
      <Caption>{label}</Caption>
      <Body
        tone="primary"
        style={{
          color: color ?? colors.text.primary,
          fontFamily: bodyFont("semibold"),
          marginTop: 2,
        }}
      >
        {value}
      </Body>
    </View>
  );
}
