import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, BackHandler, AppState } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { studentApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption } from "@/src/components/typography";
import { Button } from "@/src/components/buttons";
import { bodyFont } from "@/src/theme/typography";
import { Clock, CheckCircle2, AlertTriangle } from "lucide-react-native";

type Question = { id: string; type: string; questionText: string; marks: number; options: { key: string; text: string }[] | null; savedResponse: string | null };
type Phase = "loading" | "running" | "submitting" | "done" | "error";

export default function ExamRunner() {
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>("loading");
  const [exam, setExam] = useState<any>(null);
  const [attemptId, setAttemptId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  // Timestamp of the last failed autosave, or null when the last one succeeded.
  const [saveFailedAt, setSaveFailedAt] = useState<number | null>(null);

  const answersRef = useRef<Record<string, string>>({});
  useEffect(() => { answersRef.current = answers; }, [answers]);
  const examIdRef = useRef(examId);
  const attemptIdRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await studentApi.startExam(examId);
        if (cancelled) return;
        setExam(res.exam); setAttemptId(res.attempt.id); attemptIdRef.current = res.attempt.id; setQuestions(res.questions);
        const init: Record<string, string> = {};
        for (const q of res.questions) if (q.savedResponse) init[q.id] = q.savedResponse;
        setAnswers(init); answersRef.current = init; setSecondsLeft(res.attempt.secondsLeft); setPhase("running");
      } catch (e: any) { if (cancelled) return; setError(e.message || "Could not start this exam."); setPhase("error"); }
    })();
    return () => { cancelled = true; };
  }, [examId]);

  useEffect(() => { if (phase !== "running") return; const t = setInterval(() => { setSecondsLeft((s) => { if (s <= 1) { clearInterval(t); doSubmit(true); return 0; } return s - 1; }); }, 1000); return () => clearInterval(t); }, [phase]);
  useEffect(() => { if (phase !== "running") return; const t = setInterval(() => doSave(), 20_000); return () => clearInterval(t); }, [phase]);
  useEffect(() => { if (phase !== "running") return; const handler = () => { Alert.alert("Leave exam?", "Your progress is saved.", [{ text: "Stay", style: "cancel" }, { text: "Leave", style: "destructive", onPress: () => router.back() }]); return true; }; const sub = BackHandler.addEventListener("hardwareBackPress", handler); return () => sub.remove(); }, [phase]);

  /**
   * Save the moment the app leaves the foreground.
   *
   * The 20-second autosave leaves a window where a student who takes a call,
   * gets a notification, or has Android reclaim memory loses answers they had
   * already given. Backgrounding is exactly when that is most likely, so it is
   * the one moment worth an unconditional save.
   */
  useEffect(() => {
    if (phase !== "running") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") void doSave();
    });
    return () => sub.remove();
  }, [phase]);

  /**
   * Persist shortly after a change rather than only on the 20s tick.
   * Debounced so typing an essay does not fire a request per keystroke.
   */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  function setAnswer(qId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void doSave(), 2_000);
  }

  /**
   * Autosave. Previously `catch {}`.
   *
   * A silent failure here is the worst kind in the app: the student keeps
   * answering, the "Saving…" pill flashes as if all is well, and they discover
   * at submission that nothing persisted. They need to know while they still
   * have time on the clock and can do something about it.
   *
   * A failure is NOT fatal — answers live in `answersRef` and submission sends
   * the full set, so one failed autosave is recoverable. So this warns rather
   * than interrupting: no modal over a running exam.
   */
  async function doSave() {
    if (!attemptIdRef.current) return;
    setSaving(true);
    try {
      await studentApi.saveExam(
        examIdRef.current,
        attemptIdRef.current,
        Object.entries(answersRef.current).map(([questionId, response]) => ({ questionId, response })),
      );
      setSaveFailedAt(null);
    } catch {
      setSaveFailedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }
  async function doSubmit(auto = false) {
    if (phase === "submitting" || phase === "done") return;
    setPhase("submitting");
    try {
      const res: any = await studentApi.submitExam(examIdRef.current, attemptIdRef.current, Object.entries(answersRef.current).map(([questionId, response]) => ({ questionId, response })));
      setResult(res); setPhase("done");
    } catch (e: any) {
      setError(e.message || "Submission failed. Your exam is NOT submitted yet — reconnect and try again before leaving this screen.");
      setPhase("error");
    }
  }
  function confirmSubmit() {
    const unanswered = questions.filter((q) => !answers[q.id]).length;
    Alert.alert("Submit exam?", unanswered > 0 ? `You have ${unanswered} unanswered question${unanswered > 1 ? "s" : ""}. Submit anyway?` : "You will not be able to change your answers after this.", [{ text: "Keep working", style: "cancel" }, { text: "Submit", style: "destructive", onPress: () => doSubmit(false) }]);
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const lowTime = secondsLeft <= 60;
  const answeredCount = questions.filter((q) => answers[q.id]).length;

  if (phase === "loading") return (<View style={{ flex: 1, backgroundColor: colors.background.primary, justifyContent: "center", alignItems: "center" }}><ActivityIndicator size="large" color={colors.brand.greenLight} /><Body style={{ marginTop: spacing.md }}>Starting exam…</Body></View>);

  if (phase === "error") return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary, justifyContent: "center", alignItems: "center", padding: spacing.lg }}>
      <AlertTriangle size={48} color={colors.danger} />
      <H2 style={{ marginTop: spacing.md, textAlign: "center" }}>{attemptIdRef.current ? "Submission not confirmed" : "Can't start exam"}</H2>
      <Body style={{ textAlign: "center", marginTop: spacing.xs }}>{error}</Body>
      {attemptIdRef.current ? (
        <Button variant="primary" size="lg" style={{ marginTop: spacing.xxl }} onPress={() => doSubmit(false)}>Retry submission</Button>
      ) : (
        <Button variant="primary" size="lg" style={{ marginTop: spacing.xxl }} onPress={() => router.back()}>Go back</Button>
      )}
    </View>
  );

  if (phase === "done") return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary, justifyContent: "center", alignItems: "center", padding: spacing.lg }}>
      <CheckCircle2 size={56} color={colors.success} />
      <H2 style={{ marginTop: spacing.md }}>Submitted!</H2>
      <Body style={{ textAlign: "center", marginTop: spacing.xs }}>{result?.message || "Your exam has been submitted successfully."}</Body>
      <Button variant="primary" size="lg" style={{ marginTop: spacing.xxl }} onPress={() => router.replace("/(student)/exams")}>Back to exams</Button>
    </View>
  );

  const q = questions[current];
  const isMcq = q?.options && q.options.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: (insets.top || 8) + spacing.sm, paddingBottom: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border.subtle }}>
        <Body tone="primary" style={{ fontFamily: bodyFont("bold"), fontSize: 17 }} numberOfLines={1}>{exam?.title}</Body>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs + 2 }}>
          <Caption>Question {current + 1} of {questions.length} · {answeredCount} answered</Caption>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: lowTime ? colors.status.errorBg : colors.status.successBg, paddingHorizontal: spacing.sm + 2, paddingVertical: 5, borderRadius: 8 }}>
            <Clock size={13} color={lowTime ? colors.danger : colors.success} />
            <Text style={{ color: lowTime ? colors.danger : colors.success, fontWeight: "700", fontFamily: bodyFont("bold"), fontSize: 13 }}>{mm}:{ss}</Text>
          </View>
        </View>
        {/* Answered progress bar */}
        {questions.length > 0 ? (
          <View style={{ marginTop: spacing.sm + 2, height: 4, borderRadius: 2, backgroundColor: colors.border.subtle, overflow: "hidden" }}>
            <View
              style={{
                width: `${Math.round((answeredCount / questions.length) * 100)}%`,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.brand.greenLight,
              }}
            />
          </View>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 56, paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md }}>
        {questions.map((qq, i) => {
          const answered = !!answers[qq.id]; const isCurrent = i === current;
          return (
            <TouchableOpacity key={qq.id} onPress={() => setCurrent(i)} style={{ width: 34, height: 34, borderRadius: 12, marginRight: spacing.xs, justifyContent: "center", alignItems: "center", backgroundColor: isCurrent ? colors.brand.greenLight : answered ? `${colors.brand.green}55` : colors.border.subtle, borderWidth: isCurrent ? 0 : 1, borderColor: answered ? colors.brand.greenLight : colors.border.default }}>
              <Text style={{ color: isCurrent || answered ? colors.text.inverse : colors.text.muted, fontWeight: "700", fontFamily: bodyFont("bold"), fontSize: 12 }}>{i + 1}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={{ flex: 1, paddingHorizontal: spacing.lg }} contentContainerStyle={{ paddingBottom: spacing.lg }}>
        <Card variant="default" padding={spacing.md + 2} style={{ marginTop: spacing.xs }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs + 2 }}>
            <Caption style={{ color: colors.brand.greenLight, fontFamily: bodyFont("bold") }}>{isMcq ? "MULTIPLE CHOICE" : q?.type}</Caption>
            <Caption>{q?.marks} mark{q?.marks === 1 ? "" : "s"}</Caption>
          </View>
          <Body tone="primary" style={{ fontFamily: bodyFont("semibold"), fontSize: 16, lineHeight: 24 }}>{q?.questionText}</Body>

          {isMcq && q.options!.map((opt) => {
            const selected = answers[q.id] === opt.key;
            return (
              <TouchableOpacity key={opt.key} onPress={() => setAnswer(q.id, opt.key)} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs + 2, padding: spacing.sm + 2, borderRadius: 14, backgroundColor: selected ? colors.status.successBg : colors.border.subtle, borderWidth: 1.5, borderColor: selected ? colors.brand.greenLight : colors.border.default }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: selected ? colors.brand.greenLight : colors.border.strong, backgroundColor: selected ? colors.brand.greenLight : "transparent", justifyContent: "center", alignItems: "center" }}>
                  {selected && <CheckCircle2 size={14} color={colors.text.inverse} />}
                </View>
                <Body tone="primary" style={{ flex: 1 }}>{opt.text}</Body>
              </TouchableOpacity>
            );
          })}

          {!isMcq && (
            <TextInput value={answers[q.id] || ""} onChangeText={(t) => setAnswer(q.id, t)} placeholder="Type your answer here…" placeholderTextColor={colors.text.muted} multiline textAlignVertical="top" style={{ color: colors.text.primary, backgroundColor: colors.background.primary, borderRadius: 14, padding: spacing.sm + 2, marginTop: spacing.sm + 2, minHeight: 140, fontSize: 15, borderWidth: 1, borderColor: colors.border.subtle }} />
          )}
        </Card>
      </ScrollView>

      <View style={{ flexDirection: "row", gap: spacing.sm + 2, padding: spacing.md, paddingBottom: spacing.xxl, borderTopWidth: 1, borderTopColor: colors.border.subtle }}>
        <Button variant="ghost" fullWidth onPress={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0} style={{ backgroundColor: colors.border.subtle, opacity: current === 0 ? 0.4 : 1 }}>Previous</Button>
        {current < questions.length - 1 ? (
          <Button variant="primary" fullWidth onPress={() => { setCurrent((c) => c + 1); doSave(); }}>Next</Button>
        ) : (
          <Button variant="primary" fullWidth loading={phase === "submitting"} onPress={confirmSubmit} style={{ backgroundColor: colors.success }}>Submit Exam</Button>
        )}
      </View>

      {saving && !saveFailedAt && (
        <View style={{ position: "absolute", bottom: 90, alignSelf: "center", backgroundColor: colors.background.overlay, paddingHorizontal: spacing.sm + 2, paddingVertical: 6, borderRadius: 8 }}>
          <Caption>Saving…</Caption>
        </View>
      )}

      {/* Autosave is failing. Non-blocking: answers are held locally and the
          full set is sent on submit, so the exam can continue. */}
      {saveFailedAt !== null && (
        <View style={{ position: "absolute", bottom: 90, left: spacing.lg, right: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.status.errorBg, borderWidth: 1, borderColor: colors.danger, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm, borderRadius: 12 }}>
          <AlertTriangle size={16} color={colors.danger} />
          <Caption style={{ flex: 1, color: colors.danger }}>
            Not saving to the server — check your connection. Your answers are kept on this device and will be sent when you submit.
          </Caption>
          <TouchableOpacity onPress={() => doSave()} accessibilityRole="button">
            <Caption style={{ color: colors.danger, fontFamily: bodyFont("bold") }}>Retry</Caption>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
