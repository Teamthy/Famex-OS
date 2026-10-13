import { useCallback, useEffect, useMemo, useState } from "react";
import { View, ScrollView, TextInput, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { adminApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Button } from "@/src/components/buttons";
import { Chip, ChipRow } from "@/src/components/chips";
import { Modal } from "@/src/components/modals";
import { EmptyState, Skeleton } from "@/src/components/feedback";
import { InlineError, SectionHeading, Metric, MetricGrid } from "@/src/components/dashboard";
import { ProgressBar } from "@/src/components/progress";
import { Dismissible } from "@/src/components/dismissible";
import { useToast } from "@/components/MobileToast";
import { bodyFont } from "@/src/theme/typography";
import { haptic } from "@/lib/haptics";
import {
  ArrowLeft,
  Plus,
  Receipt,
  Wallet,
  Layers,
  Search,
  X,
  Calendar,
} from "lucide-react-native";

const naira = (n: number) => "₦" + Number(n || 0).toLocaleString();

/** Common school spend buckets, offered as quick picks. */
const CATEGORIES = [
  "Utilities",
  "Salaries",
  "Maintenance",
  "Supplies",
  "Transport",
  "Food",
  "Events",
  "Other",
];

const METHODS = ["CASH", "BANK_TRANSFER", "CARD", "OTHER"] as const;
type Method = (typeof METHODS)[number];

export default function AdminExpenses() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { toast } = useToast();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);

  // Capture sheet
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Supplies");
  const [vendor, setVendor] = useState("");
  const [method, setMethod] = useState<Method>("CASH");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await adminApi.expenses());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load expenses.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const all = useMemo(() => data?.expenses || [], [data]);
  const summary = data?.summary || {};
  const byCategory: { category: string; amount: number }[] = summary.byCategory || [];
  const totalSpent = Number(summary.totalSpent ?? 0);

  const visible = useMemo(() => {
    let list = all;
    if (catFilter) list = list.filter((e: any) => e.category === catFilter);
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((e: any) =>
        `${e.title} ${e.vendor || ""} ${e.category}`.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [all, q, catFilter]);

  /** Group by month so a long ledger reads chronologically. */
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const e of visible) {
      const d = new Date(e.spentAt);
      const key = d.toLocaleDateString("en", { month: "long", year: "numeric" });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()];
  }, [visible]);

  function resetForm() {
    setTitle("");
    setAmount("");
    setCategory("Supplies");
    setVendor("");
    setMethod("CASH");
    setNotes("");
    setFormError(null);
  }

  async function save() {
    const cleanTitle = title.trim();
    // The API takes an integer amount; strip separators a user may type.
    const numeric = Number(amount.replace(/[^0-9.]/g, ""));
    if (cleanTitle.length < 2) {
      setFormError("Give the expense a short title.");
      haptic("warning");
      return;
    }
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setFormError("Enter an amount greater than zero.");
      haptic("warning");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await adminApi.createExpense({
        title: cleanTitle,
        amount: Math.round(numeric),
        category,
        vendor: vendor.trim() || undefined,
        paymentMethod: method,
        notes: notes.trim() || undefined,
      });
      haptic("success");
      toast(`${naira(Math.round(numeric))} recorded.`, "success");
      resetForm();
      setShowAdd(false);
      void load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save the expense.");
      haptic("error");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(expense: any) {
    // Deleting money records is destructive and audit-logged server-side, so
    // it always asks first even though the swipe already felt deliberate.
    Alert.alert(
      "Delete expense?",
      `${expense.title} — ${naira(expense.amount)}. This cannot be undone.`,
      [
        { text: "Keep", style: "cancel", onPress: () => void load() },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await adminApi.deleteExpense(expense.id);
              haptic("success");
              toast("Expense deleted.", "info");
              void load();
            } catch (e) {
              toast(e instanceof Error ? e.message : "Could not delete.", "error");
              void load();
            }
          },
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 58, paddingBottom: 104 }}
        keyboardShouldPersistTaps="handled"
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
          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md }}
        >
          <ArrowLeft size={20} color={colors.text.muted} />
          <Caption>Finance</Caption>
        </TouchableOpacity>

        <H2 style={{ marginBottom: 3 }}>Expenses</H2>
        <Caption style={{ marginBottom: spacing.md }}>
          {summary.count ?? 0} records · {naira(totalSpent)} total
        </Caption>

        {error ? <InlineError message={error} onRetry={() => void load()} /> : null}

        {loading ? (
          <>
            <Skeleton width="100%" height={104} radius={16} style={{ marginBottom: 10 }} />
            <MetricGrid style={{ marginBottom: spacing.lg }}>
              {[0, 1].map((i) => (
                <Skeleton key={i} width="48%" height={100} radius={16} />
              ))}
            </MetricGrid>
          </>
        ) : (
          <>
            <MetricGrid style={{ marginBottom: spacing.lg }}>
              <Metric
                icon={<Wallet size={18} color={colors.brand.greenLight} />}
                label="Total spent"
                value={naira(totalSpent)}
                compact
              />
              <Metric
                icon={<Layers size={18} color={colors.brand.greenLight} />}
                label="Categories"
                value={byCategory.length}
              />
            </MetricGrid>

            {/* Where the money went — a bar per category reads faster than a
                table, and shows proportion at a glance. */}
            {byCategory.length > 0 ? (
              <>
                <SectionHeading title="By category" />
                <Card variant="default" padding={spacing.md} style={{ marginBottom: spacing.lg }}>
                  {[...byCategory]
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 6)
                    .map((c, i) => (
                      <View key={c.category} style={{ marginTop: i === 0 ? 0 : spacing.md }}>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginBottom: 6,
                          }}
                        >
                          <Caption tone="secondary" style={{ fontFamily: bodyFont("medium") }}>
                            {c.category}
                          </Caption>
                          <Caption tone="primary" style={{ fontFamily: bodyFont("bold") }}>
                            {naira(c.amount)}
                          </Caption>
                        </View>
                        <ProgressBar
                          value={totalSpent > 0 ? (c.amount / totalSpent) * 100 : 0}
                          height={6}
                        />
                      </View>
                    ))}
                </Card>
              </>
            ) : null}
          </>
        )}

        {/* Search */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            backgroundColor: colors.surface.input,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            marginBottom: spacing.sm + 2,
            borderWidth: 1,
            borderColor: colors.border.default,
          }}
        >
          <Search size={18} color={colors.text.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search title or vendor…"
            placeholderTextColor={colors.text.disabled}
            style={{
              flex: 1,
              color: colors.text.primary,
              paddingVertical: 12,
              fontFamily: "DM Sans",
              fontSize: 15,
            }}
          />
          {q ? (
            <TouchableOpacity onPress={() => setQ("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={16} color={colors.text.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {byCategory.length > 0 ? (
          <ChipRow style={{ marginBottom: spacing.lg }}>
            <Chip
              label={`All (${all.length})`}
              selected={!catFilter}
              onPress={() => {
                haptic("light");
                setCatFilter(null);
              }}
            />
            {byCategory.map((c) => (
              <Chip
                key={c.category}
                label={c.category}
                selected={catFilter === c.category}
                onPress={() => {
                  haptic("light");
                  setCatFilter(catFilter === c.category ? null : c.category);
                }}
              />
            ))}
          </ChipRow>
        ) : null}

        {loading ? (
          <View style={{ gap: spacing.sm }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height={64} radius={16} />
            ))}
          </View>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Receipt size={44} color={colors.border.strong} />}
            title={q || catFilter ? "No matches" : "No expenses recorded"}
            message={
              q || catFilter
                ? "Try a different search or category."
                : "Tap Record expense to log your first one."
            }
          />
        ) : (
          grouped.map(([month, list]) => (
            <View key={month} style={{ marginBottom: spacing.lg }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: spacing.sm,
                }}
              >
                <Label>{month}</Label>
                <Caption style={{ fontSize: 11 }}>
                  {naira(list.reduce((s: number, e: any) => s + e.amount, 0))}
                </Caption>
              </View>

              <View style={{ gap: spacing.xs + 2 }}>
                {list.map((e: any) => (
                  <Dismissible
                    key={e.id}
                    onDismiss={() => confirmDelete(e)}
                    showCloseButton={false}
                  >
                    <Card
                      variant="default"
                      padding={spacing.sm + 2}
                      style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 }}
                    >
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: radius.sm + 2,
                          backgroundColor: colors.brand.green + "1A",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Receipt size={17} color={colors.brand.greenLight} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Body
                          tone="primary"
                          style={{ fontFamily: bodyFont("bold"), fontSize: 15 }}
                          numberOfLines={1}
                        >
                          {e.title}
                        </Body>
                        <Caption style={{ marginTop: 1 }} numberOfLines={1}>
                          {e.category}
                          {e.vendor ? ` · ${e.vendor}` : ""}
                          {" · "}
                          {new Date(e.spentAt).toLocaleDateString("en", {
                            day: "numeric",
                            month: "short",
                          })}
                        </Caption>
                      </View>

                      <Body
                        tone="primary"
                        style={{ fontFamily: bodyFont("bold"), fontSize: 14 }}
                      >
                        {naira(e.amount)}
                      </Body>
                    </Card>
                  </Dismissible>
                ))}
              </View>
            </View>
          ))
        )}

        {visible.length > 0 ? (
          <Caption style={{ textAlign: "center", fontSize: 11, marginTop: spacing.sm }}>
            Swipe a row left to delete
          </Caption>
        ) : null}
      </ScrollView>

      <View
        style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg }}
      >
        <Button
          fullWidth
          size="lg"
          leftIcon={<Plus size={18} color={colors.brand.white} />}
          onPress={() => {
            haptic("light");
            setShowAdd(true);
          }}
        >
          Record expense
        </Button>
      </View>

      <Modal
        visible={showAdd}
        onClose={() => {
          setShowAdd(false);
          resetForm();
        }}
        title="Record expense"
      >
        <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.md }}>
            <Field label="What was it for?">
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Diesel for generator"
                placeholderTextColor={colors.text.disabled}
                style={inputStyle(colors, radius)}
              />
            </Field>

            <Field label="Amount (₦)">
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={colors.text.disabled}
                keyboardType="numeric"
                style={{ ...inputStyle(colors, radius), fontSize: 19, fontFamily: "DM Sans Bold" }}
              />
            </Field>

            <Field label="Category">
              <ChipRow>
                {CATEGORIES.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    selected={category === c}
                    onPress={() => setCategory(c)}
                  />
                ))}
              </ChipRow>
            </Field>

            <Field label="Paid by">
              <ChipRow>
                {METHODS.map((m) => (
                  <Chip
                    key={m}
                    label={m.replace("_", " ")}
                    selected={method === m}
                    onPress={() => setMethod(m)}
                  />
                ))}
              </ChipRow>
            </Field>

            <Field label="Vendor (optional)">
              <TextInput
                value={vendor}
                onChangeText={setVendor}
                placeholder="Who was paid"
                placeholderTextColor={colors.text.disabled}
                style={inputStyle(colors, radius)}
              />
            </Field>

            <Field label="Notes (optional)">
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Anything worth remembering"
                placeholderTextColor={colors.text.disabled}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={{ ...inputStyle(colors, radius), minHeight: 76 }}
              />
            </Field>

            {formError ? <Caption style={{ color: colors.danger }}>{formError}</Caption> : null}

            <Button fullWidth size="lg" loading={saving} onPress={save}>
              {saving ? "Saving…" : "Save expense"}
            </Button>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Calendar size={12} color={colors.text.muted} />
              <Caption style={{ fontSize: 11 }}>Dated today</Caption>
            </View>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

function inputStyle(colors: any, radius: any) {
  return {
    backgroundColor: colors.surface.input,
    color: colors.text.primary,
    borderRadius: radius.md,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border.default,
    fontFamily: "DM Sans",
    fontSize: 15,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Label>{label}</Label>
      {children}
    </View>
  );
}
