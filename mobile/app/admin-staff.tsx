import { useCallback, useEffect, useMemo, useState } from "react";
import { View, ScrollView, TextInput, RefreshControl, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { adminApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, H3, Body, Caption, Label } from "@/src/components/typography";
import { Button } from "@/src/components/buttons";
import { Avatar } from "@/src/components/avatar";
import { Badge } from "@/src/components/badges";
import { Chip, ChipRow, SegmentedControl } from "@/src/components/chips";
import { Modal } from "@/src/components/modals";
import { EmptyState, Skeleton } from "@/src/components/feedback";
import { InlineError, SectionHeading } from "@/src/components/dashboard";
import { useToast } from "@/components/MobileToast";
import { bodyFont } from "@/src/theme/typography";
import { haptic } from "@/lib/haptics";
import {
  Search,
  Users,
  ChevronRight,
  X,
  ArrowLeft,
  UserPlus,
  Layers,
} from "lucide-react-native";

const ROLES = ["TEACHER", "HOD", "COORDINATOR", "BURSAR", "DIRECTOR", "ADMIN"];

export default function AdminStaff() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { toast } = useToast();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "form" | "subject">("all");

  // Create-staff form lives in a sheet so the roster is the primary view.
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("TEACHER");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await adminApi.staffList());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the staff roster.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const all = useMemo(() => data?.teachers || [], [data]);

  const staff = useMemo(() => {
    let list = all;
    if (tab === "form") {
      list = list.filter((t: any) =>
        (t.assignments || []).some((a: any) => a.role === "FORM_TEACHER"),
      );
    } else if (tab === "subject") {
      list = list.filter((t: any) =>
        (t.assignments || []).some((a: any) => a.role === "SUBJECT_TEACHER"),
      );
    }
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((t: any) =>
        `${t.name} ${t.email || ""} ${t.role || ""}`.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [all, q, tab]);

  async function create() {
    if (!name.trim() || !email.trim()) {
      setFormError("Name and email are required.");
      haptic("warning");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const res: any = await adminApi.createStaff({
        name: name.trim(),
        email: email.trim(),
        role,
        phone: phone.trim() || undefined,
      });
      haptic("success");
      toast(
        `Account created. Temporary password: ${res?.tempPassword || "see audit log"}`,
        "success",
      );
      setName("");
      setEmail("");
      setPhone("");
      setRole("TEACHER");
      setShowCreate(false);
      void load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not create staff.");
      haptic("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 58, paddingBottom: 100 }}
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

        <H2 style={{ marginBottom: 3 }}>Staff</H2>
        <Caption style={{ marginBottom: spacing.md }}>
          {all.length} members · {(data?.classes || []).length} classes
        </Caption>

        {error ? <InlineError message={error} onRetry={() => void load()} /> : null}

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
            placeholder="Search name, email or role…"
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

        <SegmentedControl
          options={[
            { label: "All", value: "all" },
            { label: "Form", value: "form" },
            { label: "Subject", value: "subject" },
          ]}
          value={tab}
          onChange={(v) => {
            haptic("light");
            setTab(v);
          }}
          style={{ marginBottom: spacing.lg }}
        />

        {loading ? (
          <View style={{ gap: spacing.sm }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} width="100%" height={68} radius={16} />
            ))}
          </View>
        ) : staff.length === 0 ? (
          <EmptyState
            icon={<Users size={44} color={colors.border.strong} />}
            title={q ? "No matches" : "No staff yet"}
            message={q ? "Try a different search." : "Create the first staff account below."}
          />
        ) : (
          <View style={{ gap: spacing.xs + 2 }}>
            {staff.map((t: any) => {
              const assignments = t.assignments || [];
              const isForm = assignments.some((a: any) => a.role === "FORM_TEACHER");
              const subjects = [
                ...new Set(assignments.map((a: any) => a.subjectName).filter(Boolean)),
              ];
              return (
                <Card
                  key={t.id}
                  variant="default"
                  padding={spacing.sm + 2}
                  onPress={() => {
                    haptic("light");
                    router.push(
                      `/admin-staff-detail?id=${encodeURIComponent(t.id)}&name=${encodeURIComponent(t.name || "")}` as never,
                    );
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 }}
                >
                  <Avatar name={t.name} size="md" />
                  <View style={{ flex: 1 }}>
                    <Body
                      tone="primary"
                      style={{ fontFamily: bodyFont("bold"), fontSize: 15 }}
                      numberOfLines={1}
                    >
                      {t.name}
                    </Body>
                    <Caption style={{ marginTop: 1 }} numberOfLines={1}>
                      {subjects.length > 0
                        ? subjects.slice(0, 2).join(", ")
                        : t.email || "—"}
                      {assignments.length > 0 ? ` · ${assignments.length} class${assignments.length > 1 ? "es" : ""}` : ""}
                    </Caption>
                  </View>
                  {isForm ? <Badge tone="accent">FORM</Badge> : null}
                  <ChevronRight size={18} color={colors.text.muted} />
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Primary action pinned so it's reachable from anywhere in the list */}
      <View
        style={{
          position: "absolute",
          left: spacing.lg,
          right: spacing.lg,
          bottom: spacing.lg,
        }}
      >
        <Button
          fullWidth
          size="lg"
          leftIcon={<UserPlus size={18} color={colors.brand.white} />}
          onPress={() => {
            haptic("light");
            setShowCreate(true);
          }}
        >
          Add staff member
        </Button>
      </View>

      <Modal visible={showCreate} onClose={() => setShowCreate(false)} title="New staff account">
        <View style={{ gap: spacing.md }}>
          <Field label="Full name">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Mr. Emeka Nwosu"
              placeholderTextColor={colors.text.disabled}
              style={inputStyle(colors, radius)}
            />
          </Field>
          <Field label="Email">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="staff@ykaycollege.com"
              placeholderTextColor={colors.text.disabled}
              keyboardType="email-address"
              autoCapitalize="none"
              style={inputStyle(colors, radius)}
            />
          </Field>
          <Field label="Phone (optional)">
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="080…"
              placeholderTextColor={colors.text.disabled}
              keyboardType="phone-pad"
              style={inputStyle(colors, radius)}
            />
          </Field>
          <Field label="Role">
            <ChipRow>
              {ROLES.map((r) => (
                <Chip key={r} label={r} selected={role === r} onPress={() => setRole(r)} />
              ))}
            </ChipRow>
          </Field>

          {formError ? (
            <Caption style={{ color: colors.danger }}>{formError}</Caption>
          ) : null}

          <Button fullWidth size="lg" loading={saving} onPress={create}>
            {saving ? "Creating…" : "Create account"}
          </Button>
          <Caption style={{ textAlign: "center", fontSize: 11 }}>
            A temporary password is issued; they change it on first sign-in.
          </Caption>
        </View>
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
