import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from "react-native";
import { teacherApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { InlineError } from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Button } from "@/src/components/buttons";
import { Column, Screen, AppBar } from "@/src/components/layout";
import { bodyFont } from "@/src/theme/typography";
import { Check, X, Clock, MinusCircle, ChevronLeft, ChevronRight, Lock } from "lucide-react-native";
import { useRouter } from "expo-router";

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });

export default function TeacherAttendance() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const STATUS_META: Record<Status, { color: string; icon: any; label: string }> = {
    PRESENT: { color: colors.success, icon: Check, label: "P" },
    ABSENT: { color: colors.danger, icon: X, label: "A" },
    LATE: { color: colors.warning, icon: Clock, label: "L" },
    EXCUSED: { color: colors.info, icon: MinusCircle, label: "E" },
  };

  async function load(cid?: string, d?: string) {
    setLoading(true);
    try {
      setError(null);
      const res: any = await teacherApi.attendance(cid || undefined, d);
      setClasses(res.availableClasses || []);
      if (!cid) setClassId(res.selectedClass?.id || res.availableClasses?.[0]?.id || "");
      setRows(res.roster || res.rows || []);
      setLocked(Boolean(res.session?.isLocked));
      const init: Record<string, Status> = {};
      for (const r of res.roster || res.rows || []) init[r.studentProfileId] = (r.status as Status) || "PRESENT";
      setStatuses(init);
    } catch (err) {
      // Previously `catch {}`. An empty roster looks exactly like a class with
      // no students — a teacher could mark an entire register against nothing.
      setError(err instanceof Error ? err.message : "Couldn't load the register.");
      setRows([]);
    } finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { if (classId) load(classId, date); }, [classId, date]);

  function shiftDay(delta: number) { const d = new Date(date + "T00:00:00"); d.setDate(d.getDate() + delta); setDate(d.toISOString().slice(0, 10)); }
  function setStatus(id: string, s: Status) { setStatuses((prev) => ({ ...prev, [id]: s })); }
  function markAll(s: Status) { const next: Record<string, Status> = {}; for (const r of rows) next[r.studentProfileId] = s; setStatuses(next); }

  const counts = rows.reduce((acc, r) => { const s = statuses[r.studentProfileId] || "PRESENT"; acc[s] = (acc[s] || 0) + 1; return acc; }, {} as Record<string, number>);

  async function save(finalize: boolean) {
    setSaving(true);
    try {
      const entries = rows.map((r) => ({ studentProfileId: r.studentProfileId, status: statuses[r.studentProfileId] || "PRESENT" }));
      await teacherApi.saveAttendance({ classId, sessionDate: date, periodKey: "DAILY_REGISTER", finalize, entries });
      Alert.alert("Saved", finalize ? "Attendance submitted." : "Attendance saved as draft.");
      if (finalize) setLocked(true);
    } catch (e: any) { Alert.alert("Save failed", e.message || "Could not save attendance."); } finally { setSaving(false); }
  }

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(classId, date); }} tintColor={colors.brand.greenLight} />}>
      <AppBar title="Attendance" onBack={() => router.back()} />
      <H2 style={{ marginBottom: spacing.md }}>Attendance</H2>
      {error ? <InlineError message={error} onRetry={() => { void load(classId, date); }} /> : null}

      {classes.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm + 2 }}>
          {classes.map((c: any) => (
            <TouchableOpacity key={c.id} onPress={() => setClassId(c.id)} style={{ backgroundColor: classId === c.id ? colors.brand.green : colors.background.elevated, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginRight: spacing.sm }}>
              <Text style={{ color: classId === c.id ? colors.text.inverse : colors.text.primary, fontSize: 13, fontFamily: bodyFont("semibold") }}>{c.displayName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Card variant="default" padding={spacing.sm + 2} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm + 2 }}>
        <TouchableOpacity onPress={() => shiftDay(-1)}><ChevronLeft size={20} color={colors.text.primary} /></TouchableOpacity>
        <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>{fmtDate(date)}</Body>
        <TouchableOpacity onPress={() => shiftDay(1)}><ChevronRight size={20} color={colors.text.primary} /></TouchableOpacity>
      </Card>

      {rows.length > 0 && (
        <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm + 2 }}>
          {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as Status[]).map((s) => (
            <View key={s} style={{ flex: 1, backgroundColor: `${STATUS_META[s].color}15`, borderRadius: 12, padding: spacing.sm, alignItems: "center" }}>
              <Text style={{ color: STATUS_META[s].color, fontSize: 18, fontWeight: "bold", fontFamily: bodyFont("bold") }}>{counts[s] || 0}</Text>
              <Text style={{ color: STATUS_META[s].color, fontSize: 9, fontWeight: "700" }}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      {locked && (
        <Card variant="default" padding={spacing.sm + 2} style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.status.warningBg, marginBottom: spacing.sm + 2 }}>
          <Lock size={16} color={colors.warning} />
          <Body style={{ color: colors.warning, flex: 1 }}>Already submitted — contact admin to request a correction.</Body>
        </Card>
      )}

      {!locked && rows.length > 0 && (
        <TouchableOpacity onPress={() => markAll("PRESENT")} style={{ backgroundColor: colors.border.subtle, borderRadius: 12, padding: spacing.sm + 2, alignItems: "center", marginBottom: spacing.sm + 2 }}>
          <Text style={{ color: colors.success, fontWeight: "600", fontFamily: bodyFont("semibold") }}>Mark all Present</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={colors.brand.greenLight} style={{ marginTop: 40 }} />
      ) : rows.length > 0 ? (
        rows.map((r) => {
          const cur = statuses[r.studentProfileId] || "PRESENT";
          return (
            <Card key={r.studentProfileId} variant="default" padding={spacing.sm + 2} style={{ marginBottom: spacing.xs }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.xs + 2 }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.brand.green, justifyContent: "center", alignItems: "center", marginRight: spacing.sm + 2 }}>
                  <Text style={{ color: colors.text.inverse, fontWeight: "bold" }}>{r.displayName?.charAt(0)?.toUpperCase()}</Text>
                </View>
                <Column style={{ flex: 1 }}>
                  <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>{r.displayName}</Body>
                  <Caption>{r.studentId}</Caption>
                </Column>
              </View>
              {!locked && (
                <View style={{ flexDirection: "row", gap: spacing.xs }}>
                  {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as Status[]).map((s) => {
                    const M = STATUS_META[s]; const active = cur === s; const Icon = M.icon;
                    return (
                      <TouchableOpacity key={s} onPress={() => setStatus(r.studentProfileId, s)} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 9, borderRadius: 12, backgroundColor: active ? `${M.color}25` : colors.border.subtle, borderWidth: 1.5, borderColor: active ? M.color : colors.border.default }}>
                        <Icon size={13} color={active ? M.color : colors.text.muted} />
                        <Text style={{ color: active ? M.color : colors.text.muted, fontSize: 11, fontWeight: "700", fontFamily: bodyFont("bold") }}>{M.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </Card>
          );
        })
      ) : (
        <Caption style={{ textAlign: "center", paddingVertical: 40 }}>No students in this class</Caption>
      )}

      {!locked && rows.length > 0 && (
        <View style={{ flexDirection: "row", gap: spacing.sm + 2, marginTop: spacing.xs }}>
          <Button variant="ghost" fullWidth loading={saving} onPress={() => save(false)} style={{ backgroundColor: colors.border.subtle }}>{saving ? "Saving…" : "Save Draft"}</Button>
          <Button variant="primary" fullWidth loading={saving} onPress={() => save(true)}>{saving ? "Submitting…" : "Submit"}</Button>
        </View>
      )}
    </Screen>
  );
}
