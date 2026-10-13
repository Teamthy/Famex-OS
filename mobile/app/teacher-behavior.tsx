import { useCallback, useEffect, useMemo, useState } from "react";
import { View, ScrollView, TextInput, RefreshControl, TouchableOpacity, Alert, Switch } from "react-native";
import { useRouter } from "expo-router";
import { teacherApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Button } from "@/src/components/buttons";
import { Avatar } from "@/src/components/avatar";
import { Badge } from "@/src/components/badges";
import { Chip, ChipRow, SegmentedControl } from "@/src/components/chips";
import { Modal } from "@/src/components/modals";
import { EmptyState, Skeleton } from "@/src/components/feedback";
import { InlineError, Metric, MetricGrid, SectionHeading } from "@/src/components/dashboard";
import { Dismissible } from "@/src/components/dismissible";
import { useToast } from "@/components/MobileToast";
import { bodyFont } from "@/src/theme/typography";
import { haptic } from "@/lib/haptics";
import {
  ArrowLeft,
  Plus,
  Award,
  AlertTriangle,
  FileText,
  Search,
  X,
  Heart,
  BellRing,
} from "lucide-react-native";

type RecordType = "COMMENDATION" | "WARNING" | "NOTE";

const CATEGORIES = [
  "Punctuality",
  "Teamwork",
  "Effort",
  "Uniform",
  "Homework",
  "Conduct",
  "Leadership",
];

function relativeDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en", { day: "numeric", month: "short" });
}

export default function TeacherBehavior() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { toast } = useToast();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "COMMENDATION" | "WARNING">("all");

  // Log sheet
  const [showAdd, setShowAdd] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [type, setType] = useState<RecordType>("COMMENDATION");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [notifyParent, setNotifyParent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await teacherApi.behavior());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load behaviour records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const students = data?.students || [];
  const summary = data?.summary || { total: 0, commendations: 0, warnings: 0, notes: 0 };

  const recent = useMemo(() => {
    let list = data?.recent || [];
    if (tab !== "all") list = list.filter((r: any) => r.type === tab);
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((r: any) =>
        `${r.studentName} ${r.description} ${r.category || ""}`.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [data, tab, q]);

  function resetForm() {
    setStudentId(null);
    setType("COMMENDATION");
    setCategory("");
    setDescription("");
    setNotifyParent(false);
    setFormError(null);
  }

  async function save() {
    if (!studentId) {
      setFormError("Choose a student.");
      haptic("warning");
      return;
    }
    if (description.trim().length < 2) {
      setFormError("Describe what happened.");
      haptic("warning");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await teacherApi.createBehavior({
        studentProfileId: studentId,
        type,
        category: category.trim() || undefined,
        description: description.trim(),
        notifyParent,
      });
      haptic("success");
      toast(notifyParent ? "Recorded. Guardian notified." : "Record saved.", "success");
      resetForm();
      setShowAdd(false);
      void load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save the record.");
      haptic("error");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(rec: any) {
    Alert.alert(
      "Delete record?",
      `${rec.studentName} — ${rec.description.slice(0, 60)}${rec.description.length > 60 ? "…" : ""}`,
      [
        { text: "Keep", style: "cancel", onPress: () => void load() },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await teacherApi.deleteBehavior(rec.id);
              haptic("success");
              toast("Record deleted.", "info");
              void load();
            } catch (e) {
              // The API refuses records written by a colleague, by design.
              toast(e instanceof Error ? e.message : "Could not delete.", "error");
              void load();
            }
          },
        },
      ],
    );
  }

  const toneFor = (t: RecordType) =>
    t === "COMMENDATION" ? colors.success : t === "WARNING" ? colors.warning : colors.info;

  const iconFor = (t: RecordType, size = 17) =>
    t === "COMMENDATION" ? (
      <Award size={size} color={colors.success} />
    ) : t === "WARNING" ? (
      <AlertTriangle size={size} color={colors.warning} />
    ) : (
      <FileText size={size} color={colors.info} />
    );

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
          <Caption>Dashboard</Caption>
        </TouchableOpacity>

        <H2 style={{ marginBottom: 3 }}>Behaviour</H2>
        <Caption style={{ marginBottom: spacing.md }}>
          {data?.className ? `${data.className} · ` : ""}
          {summary.total} record{summary.total === 1 ? "" : "s"}
        </Caption>

        {error ? <InlineError message={error} onRetry={() => void load()} /> : null}

        {loading ? (
          <MetricGrid style={{ marginBottom: spacing.lg }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width="48%" height={100} radius={16} />
            ))}
          </MetricGrid>
        ) : (
          <MetricGrid style={{ marginBottom: spacing.lg }}>
            <Metric
              icon={<Award size={18} color={colors.success} />}
              accent={colors.success}
              label="Commendations"
              value={summary.commendations}
            />
            <Metric
              icon={<AlertTriangle size={18} color={colors.warning} />}
              accent={colors.warning}
              label="Warnings"
              value={summary.warnings}
            />
            <Metric
              icon={<FileText size={18} color={colors.info} />}
              accent={colors.info}
              label="Notes"
              value={summary.notes}
            />
            <Metric
              icon={<Heart size={18} color={colors.brand.greenLight} />}
              label="Students"
              value={students.length}
            />
          </MetricGrid>
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
            placeholder="Search student or note…"
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
            <TouchableOpacity
              onPress={() => setQ("")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={16} color={colors.text.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <SegmentedControl
          options={[
            { label: "All", value: "all" },
            { label: "Praise", value: "COMMENDATION" },
            { label: "Warnings", value: "WARNING" },
          ]}
          value={tab}
          onChange={(v) => {
            haptic("light");
            setTab(v);
          }}
          style={{ marginBottom: spacing.lg }}
        />

        <SectionHeading title="Recent" />

        {loading ? (
          <View style={{ gap: spacing.sm }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height={76} radius={16} />
            ))}
          </View>
        ) : recent.length === 0 ? (
          <EmptyState
            icon={<Heart size={44} color={colors.border.strong} />}
            title={q || tab !== "all" ? "No matches" : "No records yet"}
            message={
              q || tab !== "all"
                ? "Try a different search or filter."
                : "Log a commendation or a concern as it happens."
            }
          />
        ) : (
          <View style={{ gap: spacing.xs + 2 }}>
            {recent.map((r: any) => (
              <Dismissible key={r.id} onDismiss={() => confirmDelete(r)} showCloseButton={false}>
                <Card
                  variant="default"
                  padding={spacing.sm + 4}
                  style={{ flexDirection: "row", gap: spacing.sm + 2 }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: radius.sm + 2,
                      backgroundColor: toneFor(r.type) + "1F",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {iconFor(r.type)}
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Body
                        tone="primary"
                        numberOfLines={1}
                        style={{ flex: 1, fontFamily: bodyFont("bold"), fontSize: 15 }}
                      >
                        {r.studentName}
                      </Body>
                      <Caption style={{ fontSize: 11 }}>{relativeDay(r.at)}</Caption>
                    </View>

                    <Caption tone="secondary" style={{ marginTop: 2 }} numberOfLines={2}>
                      {r.description}
                    </Caption>

                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      {r.category ? <Badge tone="neutral">{r.category}</Badge> : null}
                      {r.parentNotified ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                          <BellRing size={11} color={colors.brand.greenLight} />
                          <Caption style={{ fontSize: 10.5, color: colors.brand.greenLight }}>
                            Guardian told
                          </Caption>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Card>
              </Dismissible>
            ))}
          </View>
        )}

        {recent.length > 0 ? (
          <Caption style={{ textAlign: "center", fontSize: 11, marginTop: spacing.sm }}>
            Swipe left to delete your own record
          </Caption>
        ) : null}
      </ScrollView>

      {students.length > 0 ? (
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
            Log behaviour
          </Button>
        </View>
      ) : null}

      <Modal
        visible={showAdd}
        onClose={() => {
          setShowAdd(false);
          resetForm();
        }}
        title="Log behaviour"
      >
        <ScrollView style={{ maxHeight: 430 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <Label>Student</Label>
              <ChipRow>
                {students.map((s: any) => (
                  <Chip
                    key={s.id}
                    label={s.displayName}
                    selected={studentId === s.id}
                    onPress={() => setStudentId(s.id)}
                  />
                ))}
              </ChipRow>
            </View>

            <View style={{ gap: spacing.xs }}>
              <Label>Type</Label>
              <SegmentedControl
                options={[
                  { label: "Praise", value: "COMMENDATION" },
                  { label: "Warning", value: "WARNING" },
                  { label: "Note", value: "NOTE" },
                ]}
                value={type}
                onChange={(v) => setType(v as RecordType)}
              />
            </View>

            <View style={{ gap: spacing.xs }}>
              <Label>Category (optional)</Label>
              <ChipRow>
                {CATEGORIES.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    selected={category === c}
                    onPress={() => setCategory(category === c ? "" : c)}
                  />
                ))}
              </ChipRow>
            </View>

            <View style={{ gap: spacing.xs }}>
              <Label>What happened?</Label>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Keep it factual — a guardian may read this."
                placeholderTextColor={colors.text.disabled}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{
                  backgroundColor: colors.surface.input,
                  color: colors.text.primary,
                  borderRadius: radius.md,
                  padding: 13,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  fontFamily: "DM Sans",
                  fontSize: 15,
                  minHeight: 92,
                }}
              />
            </View>

            {/* Telling the guardian is part of the same intent as writing the
                note, so it is one toggle rather than a second journey. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                padding: spacing.md - 2,
                borderRadius: radius.md,
                backgroundColor: colors.surface.card,
                borderWidth: 1,
                borderColor: colors.border.subtle,
              }}
            >
              <BellRing size={17} color={colors.brand.greenLight} />
              <View style={{ flex: 1 }}>
                <Body tone="primary" style={{ fontFamily: bodyFont("medium"), fontSize: 14 }}>
                  Notify guardian
                </Body>
                <Caption style={{ fontSize: 11, marginTop: 1 }}>
                  Sends this note to the linked parents
                </Caption>
              </View>
              <Switch
                value={notifyParent}
                onValueChange={setNotifyParent}
                trackColor={{ false: colors.surface.cardHover, true: colors.brand.green }}
                thumbColor={colors.brand.white}
              />
            </View>

            {formError ? <Caption style={{ color: colors.danger }}>{formError}</Caption> : null}

            <Button fullWidth size="lg" loading={saving} onPress={save}>
              {saving ? "Saving…" : "Save record"}
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}
