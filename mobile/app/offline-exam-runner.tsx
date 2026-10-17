/**
 * Offline CBT runner.
 *
 * Loads an exam package downloaded via /api/student/exams/:id/offline-package
 * and stored in SQLite. All answers are saved locally every 2 seconds (debounced)
 * AND queued to the server write-queue so that — if connectivity returns mid-exam
 * — answers stream up; otherwise, they flush automatically when back online.
 * Final submission uses the same idempotency-key pattern as the live runner
 * so pressing "Submit" on a flaky network is safe.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  AppState,
  BackHandler,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption } from "@/src/components/typography";
import { Button } from "@/src/components/buttons";
import { bodyFont } from "@/src/theme/typography";
import { studentApi } from "@/lib/api";
import {
  getOfflineAnswers,
  getOfflineExam,
  markAttemptSubmitted,
  saveOfflineAnswer,
  type OfflinePackage,
  type OfflineQuestion,
} from "@/lib/offline/exams";
import { haptic } from "@/lib/haptics";
import { useToast } from "@/components/MobileToast";
import { CheckCircle2, AlertTriangle, Clock, X, Check, ChevronRight } from "lucide-react-native";

type Phase = "loading" | "running" | "submitting" | "done" | "error";

export default function OfflineExamRunner() {
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>("loading");
  const [pkg, setPkg] = useState<OfflinePackage | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const answersRef = useRef<Record<string, string>>({});
  const examIdRef = useRef(examId);
  const attemptIdRef = useRef("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!examId) throw new Error("No exam id provided.");
        const p = await getOfflineExam(examId);
        if (!p) throw new Error("This exam is not downloaded offline.");
        if (cancelled) return;
        setPkg(p);
        attemptIdRef.current = p.attempt.id;
        const stored = await getOfflineAnswers(p.attempt.id);
        setAnswers(stored);
        answersRef.current = stored;
        setSecondsLeft(Math.max(0, Math.floor((new Date(p.attempt.deadlineAt).getTime() - Date.now()) / 1000)));
        setPhase("running");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Couldn't start offline exam.");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId]);

  // Countdown timer
  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          void doSubmit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Background flushes
  useEffect(() => {
    if (phase !== "running") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") void doSave();
    });
    return () => sub.remove();
  }, [phase]);

  // Auto-save every 15 seconds while running
  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => void doSave(), 15_000);
    return () => clearInterval(t);
  }, [phase]);

  // Back button guard
  useEffect(() => {
    if (phase !== "running") return;
    const handler = () => {
      Alert.alert("Leave exam?", "Your answers are saved offline.", [
        { text: "Stay", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => router.back() },
      ]);
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", handler);
    return () => sub.remove();
  }, [phase, router]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const choose = useCallback(
    (qId: string, val: string) => {
      setAnswers((prev) => {
        const next = { ...prev, [qId]: val };
        answersRef.current = next;
        return next;
      });
      void saveOfflineAnswer(attemptIdRef.current, qId, val);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void doSave(), 2_000);
      haptic("light");
    },
    [],
  );

  async function doSave() {
    if (!pkg || !attemptIdRef.current) return;
    try {
      await studentApi.saveExam(
        pkg.exam.id,
        attemptIdRef.current,
        Object.entries(answersRef.current).map(([questionId, response]) => ({ questionId, response })),
      );
    } catch {
      /* offline queue will hold it */
    }
  }

  async function doSubmit(auto = false) {
    if (!pkg) return;
    if (!auto) setSubmitting(true);
    setPhase("submitting");
    try {
      // Always save locally first so even a hard quit won't lose answers.
      await Promise.all(
        Object.entries(answersRef.current).map(([qId, val]) =>
          saveOfflineAnswer(attemptIdRef.current, qId, val),
        ),
      );
      await studentApi.submitExam(
        pkg.exam.id,
        attemptIdRef.current,
        Object.entries(answersRef.current).map(([questionId, response]) => ({ questionId, response })),
      );
      await markAttemptSubmitted(attemptIdRef.current);
      haptic("success");
      setPhase("done");
    } catch (e) {
      // If submission fails (offline), mark as "saved offline" — the queue
      // will replay it when connectivity returns.
      setPhase("done");
      toast("Answers saved offline. Will submit automatically when online.", "warning");
    } finally {
      setSubmitting(false);
    }
  }

  function confirmSubmit() {
    if (!pkg) return;
    const unanswered = pkg.questions.filter((q) => !answers[q.id]).length;
    Alert.alert("Submit exam?", unanswered > 0 ? `You have ${unanswered} unanswered. Submit anyway?` : "You will not be able to change your answers.", [
      { text: "Keep working", style: "cancel" },
      { text: "Submit", style: "destructive", onPress: () => doSubmit(false) },
    ]);
  }

  if (phase === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.brand.greenLight} />
        <Body style={{ marginTop: spacing.md }}>Loading offline exam…</Body>
      </View>
    );
  }

  if (phase === "error") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary, justifyContent: "center", alignItems: "center", padding: spacing.lg }}>
        <AlertTriangle size={48} color={colors.danger} />
        <H2 style={{ marginTop: spacing.md }}>Cannot start</H2>
        <Body style={{ textAlign: "center", marginTop: spacing.xs }}>{error}</Body>
        <Button variant="primary" style={{ marginTop: spacing.xl }} onPress={() => router.back()}>Go back</Button>
      </View>
    );
  }

  if (phase === "done" || phase === "submitting") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary, justifyContent: "center", alignItems: "center", padding: spacing.lg }}>
        <CheckCircle2 size={56} color={colors.success} />
        <H2 style={{ marginTop: spacing.md }}>{submitting ? "Submitting…" : "Exam finished"}</H2>
        <Body style={{ textAlign: "center", marginTop: spacing.xs }}>
          {submitting
            ? "Sending your answers to the server…"
            : "Your answers are saved. If you were offline, they will upload automatically when you reconnect."}
        </Body>
        <Button variant="primary" size="lg" style={{ marginTop: spacing.xxl }} onPress={() => router.replace("/offline-exams")}>
          Back to offline CBT
        </Button>
      </View>
    );
  }

  const questions = pkg?.questions ?? [];
  const q = questions[current];
  const answeredCount = questions.filter((qq) => answers[qq.id]).length;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const lowTime = secondsLeft <= 60;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: (insets.top || 8) + spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border.subtle }}>
        <Body tone="primary" style={{ fontFamily: bodyFont("bold"), fontSize: 16 }} numberOfLines={1}>{pkg?.exam.title}</Body>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs }}>
          <Caption>Q{current + 1}/{questions.length} · {answeredCount} answered · OFFLINE</Caption>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: lowTime ? colors.status.errorBg : colors.status.successBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
            <Clock size={13} color={lowTime ? colors.danger : colors.success} />
            <Text style={{ color: lowTime ? colors.danger : colors.success, fontFamily: bodyFont("bold"), fontSize: 13 }}>{mm}:{ss}</Text>
          </View>
        </View>
        <View style={{ marginTop: spacing.xs, height: 4, borderRadius: 2, backgroundColor: colors.border.subtle }}>
          <View style={{ width: `${Math.round((answeredCount / questions.length) * 100)}%`, height: 4, backgroundColor: colors.brand.greenLight, borderRadius: 2 }} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 56, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}>
        {questions.map((qq, i) => {
          const answered = !!answers[qq.id];
          const isCurrent = i === current;
          return (
            <TouchableOpacity key={qq.id} onPress={() => setCurrent(i)} style={{ width: 34, height: 34, borderRadius: 12, marginRight: spacing.xs, justifyContent: "center", alignItems: "center", backgroundColor: isCurrent ? colors.brand.greenLight : answered ? `${colors.brand.green}55` : colors.border.subtle }}>
              <Text style={{ color: isCurrent || answered ? colors.text.inverse : colors.text.muted, fontFamily: bodyFont("bold"), fontSize: 12 }}>{i + 1}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={{ flex: 1, paddingHorizontal: spacing.lg }} contentContainerStyle={{ paddingBottom: spacing.lg }}>
        {pkg?.exam.instructions && current === 0 && (
          <Card variant="default" padding={spacing.md} style={{ marginTop: spacing.sm, backgroundColor: colors.background.secondary }}>
            <Caption style={{ fontFamily: bodyFont("bold") }}>Instructions</Caption>
            <Body style={{ marginTop: 4 }}>{pkg.exam.instructions}</Body>
          </Card>
        )}

        <Card variant="default" padding={spacing.md} style={{ marginTop: spacing.sm }}>
          <Caption style={{ color: colors.brand.greenLight, fontFamily: bodyFont("bold") }}>{pkg?.exam.subjectName} · {q.marks} mk{q.marks !== 1 ? "s" : ""}</Caption>
          <Body tone="primary" style={{ fontFamily: bodyFont("bold"), fontSize: 17, marginTop: spacing.xs, lineHeight: 24 }}>{q.questionText}</Body>

          {(q.options || []).map((opt) => {
            const isSel = answers[q.id] === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => choose(q.id, opt.key)}
                style={{
                  flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm + 2,
                  padding: spacing.sm + 2, borderRadius: 14,
                  backgroundColor: isSel ? colors.status.successBg : colors.border.subtle,
                  borderWidth: 1.5, borderColor: isSel ? colors.success : colors.border.default,
                }}
              >
                <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: isSel ? colors.success : colors.border.strong, backgroundColor: isSel ? colors.success : "transparent", justifyContent: "center", alignItems: "center" }}>
                  {isSel ? <Check size={15} color={colors.brand.white} /> : null}
                </View>
                <Body tone="primary" style={{ flex: 1 }}>{opt.text}</Body>
              </TouchableOpacity>
            );
          })}
        </Card>
      </ScrollView>

      <View style={{ padding: spacing.md, paddingBottom: spacing.xxl, borderTopWidth: 1, borderTopColor: colors.border.subtle, flexDirection: "row", gap: spacing.sm }}>
        <Button
          variant="ghost"
          fullWidth
          onPress={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          style={{ backgroundColor: colors.border.subtle }}
        >
          Previous
        </Button>
        {current < questions.length - 1 ? (
          <Button variant="primary" fullWidth onPress={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))} rightIcon={<ChevronRight size={18} color={colors.brand.white} />}>
            Next
          </Button>
        ) : (
          <Button variant="primary" fullWidth onPress={confirmSubmit}>
            Submit exam
          </Button>
        )}
      </View>
    </View>
  );
}
