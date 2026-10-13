import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl, Alert, ActivityIndicator } from "react-native";
import { teacherApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { InlineError } from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Button } from "@/src/components/buttons";
import { bodyFont } from "@/src/theme/typography";
import { BookOpen, Lock, Save, Send } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Screen, AppBar } from "@/src/components/layout";

type Scores = { ca1: string; ca2: string; midterm: string; assignment: string; exam: string };

export default function TeacherGradebook() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [assignmentId, setAssignmentId] = useState("");
  const [scores, setScores] = useState<Record<string, Scores>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(id?: string) {
    setLoading(true);
    try {
      setError(null);
      const res: any = await teacherApi.gradebook(id);
      setData(res);
      if (!id) setAssignmentId(res.selectedAssignmentId || res.assignments?.[0]?.id || "");
      const init: Record<string, Scores> = {};
      for (const e of res.gradebook?.entries || []) init[e.studentProfileId] = { ca1: String(e.ca1 ?? ""), ca2: String(e.ca2 ?? ""), midterm: String(e.midterm ?? ""), assignment: String(e.assignment ?? ""), exam: String(e.exam ?? "") };
      setScores(init);
    } catch (err) {
      // Previously `catch {}`. This also swallowed the 409 the API returns when
      // no academic term is set, so the teacher saw a blank gradebook instead
      // of "set a current term in Sessions & Terms".
      setError(err instanceof Error ? err.message : "Couldn't load the gradebook.");
    } finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (assignmentId) load(assignmentId); }, [assignmentId]);

  const assignments = data?.assignments || [];
  const gb = data?.gradebook;
  const limits = data?.scoreLimits || { ca1: 20, ca2: 20, midterm: 20, assignment: 20, exam: 60 };
  const editable = gb?.isEditable;
  const entries = gb?.entries || [];
  const empty = (): Scores => ({ ca1: "", ca2: "", midterm: "", assignment: "", exam: "" });
  const num = (s: string) => { const n = parseInt(s, 10); return isNaN(n) ? 0 : n; };

  function setScore(id: string, field: keyof Scores, value: string, max: number) {
    let v = value.replace(/[^0-9]/g, ""); if (v !== "" && Number(v) > max) v = String(max);
    setScores((prev) => ({ ...prev, [id]: { ...(prev[id] || empty()), [field]: v } }));
  }

  async function save(action: "SAVE" | "SUBMIT") {
    if (!assignmentId) return;
    setSaving(true);
    try {
      const payload = entries.map((e: any) => { const s = scores[e.studentProfileId] || empty(); return { studentProfileId: e.studentProfileId, ca1: num(s.ca1), ca2: num(s.ca2), midterm: num(s.midterm), assignment: num(s.assignment), exam: num(s.exam) }; });
      await teacherApi.saveGradebook(assignmentId, action, payload);
      Alert.alert(action === "SUBMIT" ? "Submitted" : "Saved", action === "SUBMIT" ? "Gradebook submitted for processing." : "Scores saved.");
      if (action === "SUBMIT") load(assignmentId);
    } catch (e: any) { Alert.alert("Failed", e.message || "Could not save scores."); } finally { setSaving(false); }
  }

  const cols: { key: keyof Scores; label: string; max: number }[] = [
    { key: "ca1", label: "CA1", max: limits.ca1 }, { key: "ca2", label: "CA2", max: limits.ca2 },
    { key: "midterm", label: "Mid", max: limits.midterm }, { key: "assignment", label: "Asg", max: limits.assignment }, { key: "exam", label: "Exam", max: limits.exam },
  ];

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(assignmentId); }} tintColor={colors.brand.greenLight} />}>
      <AppBar title="Gradebook" onBack={() => router.back()} />
      <H2 style={{ marginBottom: spacing.xs }}>Gradebook</H2>
      {error ? <InlineError message={error} onRetry={() => { void load(assignmentId); }} /> : null}
      <Caption style={{ marginBottom: spacing.md }}>Enter continuous assessment &amp; exam scores</Caption>

      {assignments.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm + 2 }}>
          {assignments.map((a: any) => (
            <TouchableOpacity key={a.id} onPress={() => setAssignmentId(a.id)} style={{ backgroundColor: assignmentId === a.id ? colors.brand.green : colors.background.elevated, borderRadius: 12, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm, marginRight: spacing.sm }}>
              <Text style={{ color: assignmentId === a.id ? colors.text.inverse : colors.text.primary, fontSize: 12, fontFamily: bodyFont("semibold") }}>{a.subjectName}</Text>
              <Text style={{ color: assignmentId === a.id ? colors.text.inverse : colors.text.muted, fontSize: 10 }}>{a.className}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {gb?.statusLabel && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm + 2 }}>
          <Caption>{gb.sessionLabel} {gb.termLabel} ·</Caption>
          <Text style={{ color: editable ? colors.success : colors.warning, fontSize: 12, fontWeight: "700", fontFamily: bodyFont("bold") }}>{gb.statusLabel}</Text>
        </View>
      )}

      {!editable && gb && (
        <Card variant="default" padding={spacing.sm + 2} style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.status.warningBg, marginBottom: spacing.sm + 2 }}>
          <Lock size={16} color={colors.warning} />
          <Body style={{ color: colors.warning, flex: 1 }}>Locked — scores can't be edited until reopened by admin.</Body>
        </Card>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={colors.brand.greenLight} style={{ marginTop: 40 }} />
      ) : entries.length > 0 ? (
        <View>
          <View style={{ flexDirection: "row", paddingHorizontal: 4, marginBottom: spacing.xs }}>
            <Text style={{ flex: 1, color: colors.text.muted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }}>STUDENT</Text>
            {cols.map((c) => <Text key={c.key} style={{ width: 50, color: colors.text.muted, fontSize: 10, fontWeight: "700", textAlign: "center" }}>{c.label}</Text>)}
            <Text style={{ width: 50, color: colors.text.muted, fontSize: 10, fontWeight: "700", textAlign: "center" }}>TOT</Text>
          </View>

          {entries.map((e: any) => {
            const s = scores[e.studentProfileId] || empty();
            const liveTotal = num(s.ca1) + num(s.ca2) + num(s.midterm) + num(s.assignment) + num(s.exam);
            return (
              <Card key={e.studentProfileId} variant="default" padding={spacing.xs + 2} style={{ marginBottom: spacing.xs, flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1, paddingRight: 4 }}>
                  <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }} numberOfLines={1}>{e.displayName}</Body>
                  <Caption style={{ color: colors.brand.greenLight }}>{e.grade || "—"}</Caption>
                </View>
                {cols.map((c) => (
                  <TextInput key={c.key} value={s[c.key]} onChangeText={(v) => setScore(e.studentProfileId, c.key, v, c.max)} editable={editable} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted} style={{ width: 50, height: 38, backgroundColor: colors.background.primary, color: colors.text.primary, borderRadius: 8, textAlign: "center", fontSize: 13, borderWidth: 1, borderColor: colors.border.subtle }} />
                ))}
                <Text style={{ width: 50, color: liveTotal > 0 ? colors.text.primary : colors.text.muted, fontSize: 14, fontWeight: "bold", textAlign: "center" }}>{liveTotal > 0 ? liveTotal : "—"}</Text>
              </Card>
            );
          })}

          {editable && (
            <View style={{ flexDirection: "row", gap: spacing.sm + 2, marginTop: spacing.xs }}>
              <Button variant="ghost" fullWidth loading={saving} onPress={() => save("SAVE")} leftIcon={<Save size={16} color={colors.text.primary} />} style={{ backgroundColor: colors.border.subtle }}>{saving ? "Saving…" : "Save"}</Button>
              <Button variant="primary" fullWidth loading={saving} onPress={() => save("SUBMIT")} leftIcon={<Send size={16} color={colors.brand.white} />}>Submit</Button>
            </View>
          )}
        </View>
      ) : (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <BookOpen size={48} color={colors.border.strong} />
          <Caption style={{ marginTop: spacing.sm }}>No subject assignments yet</Caption>
        </View>
      )}
    </Screen>
  );
}
