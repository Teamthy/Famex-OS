import { useCallback, useEffect, useMemo, useState } from "react";
import { View, ScrollView, RefreshControl, TextInput, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { adminApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Avatar } from "@/src/components/avatar";
import { Chip, ChipRow } from "@/src/components/chips";
import { EmptyState, Skeleton } from "@/src/components/feedback";
import { InlineError } from "@/src/components/dashboard";
import { bodyFont } from "@/src/theme/typography";
import { haptic } from "@/lib/haptics";
import { Search, GraduationCap, ChevronRight, X, ArrowLeft } from "lucide-react-native";

export default function AdminStudents() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();

  const [data, setData] = useState<any>(null);
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await adminApi.students());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load students.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const all = useMemo(() => data?.students || [], [data]);
  const classes = data?.classes || [];

  const students = useMemo(() => {
    let list = all;
    if (classFilter) list = list.filter((s: any) => s.className === classFilter);
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((s: any) =>
        `${s.displayName} ${s.studentId} ${s.className || ""}`.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [all, q, classFilter]);

  /** Group by class so a long roster is scannable instead of one flat wall. */
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of students) {
      const key = s.className || "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [students]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background.primary }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: 58, paddingBottom: 44 }}
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

      <H2 style={{ marginBottom: 3 }}>Students</H2>
      <Caption style={{ marginBottom: spacing.md }}>
        {all.length} enrolled · {classes.length} classes
      </Caption>

      {error ? <InlineError message={error} onRetry={() => void load()} /> : null}

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
          placeholder="Search name, ID or class…"
          placeholderTextColor={colors.text.disabled}
          returnKeyType="search"
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

      {/* Class filter */}
      {classes.length > 0 ? (
        <ChipRow style={{ marginBottom: spacing.lg }}>
          <Chip
            label={`All (${all.length})`}
            selected={!classFilter}
            onPress={() => {
              haptic("light");
              setClassFilter(null);
            }}
          />
          {classes.map((c: any) => (
            <Chip
              key={c.id}
              label={c.displayName}
              selected={classFilter === c.displayName}
              onPress={() => {
                haptic("light");
                setClassFilter(classFilter === c.displayName ? null : c.displayName);
              }}
            />
          ))}
        </ChipRow>
      ) : null}

      {loading ? (
        <View style={{ gap: spacing.sm }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width="100%" height={62} radius={16} />
          ))}
        </View>
      ) : students.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={44} color={colors.border.strong} />}
          title={q || classFilter ? "No matches" : "No students yet"}
          message={
            q || classFilter
              ? "Try a different search or class filter."
              : "Enrolled students will appear here."
          }
        />
      ) : (
        grouped.map(([className, list]) => (
          <View key={className} style={{ marginBottom: spacing.lg }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: spacing.sm,
              }}
            >
              <Label>{className}</Label>
              <Caption style={{ fontSize: 11 }}>{list.length}</Caption>
            </View>

            <View style={{ gap: spacing.xs + 2 }}>
              {list.map((s: any) => (
                <Card
                  key={s.id}
                  variant="default"
                  padding={spacing.sm + 2}
                  onPress={() => {
                    haptic("light");
                    router.push(
                      `/admin-student-detail?id=${encodeURIComponent(s.id)}&name=${encodeURIComponent(s.displayName || "")}` as never,
                    );
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 }}
                >
                  <Avatar name={s.displayName} uri={s.photoUrl} size="md" />
                  <View style={{ flex: 1 }}>
                    <Body
                      tone="primary"
                      style={{ fontFamily: bodyFont("bold"), fontSize: 15 }}
                      numberOfLines={1}
                    >
                      {s.displayName}
                    </Body>
                    <Caption style={{ marginTop: 1 }} numberOfLines={1}>
                      {s.studentId}
                    </Caption>
                  </View>
                  <ChevronRight size={18} color={colors.text.muted} />
                </Card>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
