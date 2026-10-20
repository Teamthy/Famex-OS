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
  createLocalAttempt,
  getActiveAttempt,
  getOfflineAnswers,
  getOfflineExam,
  markAttemptSubmitted,
  saveOfflineAnswer,
  updateAttemptSync,
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
  const serverAttemptIdRef = useRef<string | null>(null);
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

        // If the package was pre-downloaded without a live attempt (common
        // case — download the night before on Wi-Fi), create a local attempt
        // now that the student has actually tapped Start.
        let attemptId: string;
        let deadlineAt: number;
        let startedAt: number;
        if (p.attempt) {
          attemptId = p.attempt.id;
          deadlineAt = new Date(p.attempt.deadlineAt).getTime();
          startedAt = new Date(p.attempt.startedAt).getTime();
        } else {
          // Look for an existing active attempt for this exam (student may
          // have started it previously).
          const active = await getActiveAttempt(examId);
          if (active) {
            attemptId = active.attemptId;
            deadlineAt = active.deadlineAt;
            startedAt = Date.now(); // only used for display; deadline is authoritative
          } else {
            const created = await createLocalAttempt(examId);
            attemptId = created.attemptId;
            deadlineAt = created.deadlineAt;
            startedAt = created.startedAt;
            // Refresh pkg so the attempt is present in state.
            const refreshed = await getOfflineExam(examId);
            if (refreshed && !cancelled) setPkg(refreshed);
          }
        }
        attemptIdRef.current = attemptId;
        // If we already have a server-side attempt id (resync), use it for
        // live saves; otherwise we'll discover one after the first sync.
        const active = await getActiveAttempt(examId);
        serverAttemptIdRef.current = active?.serverAttemptId ?? null;
        const stored = await getOfflineAnswers(attemptId);
        setAnswers(stored);
        answersRef.current = stored;
        setSecondsLeft(Math.max(0, Math.floor((deadlineAt - Date.now()) / 1000)));
        setPhase("running");
        // Kick off a sync in the background to register the server-side
        // attempt if we started offline and just regained connectivity.
        import("@/lib/offline/sync")
          .then((m) => m.syncOfflineExams())
          .then(async () => {
            const refreshed = await getActiveAttempt(examId);
            if (refreshed?.serverAttemptId) serverAttemptIdRef.current = refreshed.serverAttemptId;
          })
          .catch(() => {});
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
    const targetId = serverAttemptIdRef.current ?? attemptIdRef.current;
    try {
      await studentApi.saveExam(
        pkg.exam.id,
        targetId,
        Object.entries(answersRef.current).map(([questionId, response]) => ({ questionId, response })),
      );
    } catch {
      /* saveExam goes through apiQueued which writes to the offline queue on failure */
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
      // Mark local SUBMITTED state immediately so the UI locks.
      await markAttemptSubmitted(attemptIdRef.current);

      // Attempt to save/submit to server. apiQueued works both online and
      // offline: online it PATCHes immediately; offline it queues for replay.
      const answers = Object.entries(answersRef.current).map(([questionId, response]) => ({
        questionId,
        response,
      }));
      try {
        await studentApi.saveExam(pkg.exam.id, attemptIdRef.current, answers);
        await studentApi.submitExam(pkg.exam.id, attemptIdRef.current, answers);
      } catch {
        /* offline — answers remain queued */
      }

      haptic("success");
      setPhase("done");
    } catch (e) {
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
        <Body style={{ textAlign: "center", marginTop: spacing.xs, maxWidth: 360 }}>
          {submitting
            ? "Sending your answers to the server…"
            : "Your answers are locked and saved on this device. If you're online they're on the server now; if you're offline they will upload automatically the moment you reconnect — no further action needed."}
        </Body>
        <Body style={{ textAlign: "center", marginTop: spacing.sm, color: colors.text.muted, maxWidth: 340 }}>
          You can close the app safely. Your paper is stored locally until the server confirms receipt.
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
