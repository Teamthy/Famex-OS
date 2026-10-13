import { useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, H3, Body, Caption, Label } from "@/src/components/typography";
import { Button } from "@/src/components/buttons";
import { Badge } from "@/src/components/badges";
import { Column } from "@/src/components/layout";
import { bodyFont } from "@/src/theme/typography";
import { PRACTICE_SUBJECTS, ALL_PRACTICE_QUESTIONS, type PracticeQuestion } from "@/lib/practiceBank";
import { recordPracticeSession } from "@/lib/practiceHistory";
import { haptic } from "@/lib/haptics";
import { Check, X, RotateCcw, Trophy, ChevronRight } from "lucide-react-native";

export default function PracticeRunner() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const router = useRouter();
  const { colors, spacing } = useTheme();

  const questions: PracticeQuestion[] = useMemo(
    () => (subjectId && subjectId !== "all" ? PRACTICE_SUBJECTS.find((s) => s.id === subjectId)?.questions ?? ALL_PRACTICE_QUESTIONS : ALL_PRACTICE_QUESTIONS),
    [subjectId],
  );

  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const q = questions[i];
  const selected = q ? answers[q.id] : undefined;
  const revealed = !!selected;
  const correctCount = questions.filter((qq) => answers[qq.id] === qq.correct).length;
  const pct = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;

  function choose(key: string) {
    if (revealed || !q) return;
    setAnswers((prev) => ({ ...prev, [q.id]: key }));
    haptic(key === q.correct ? "success" : "error");
  }
  function next() {
    haptic("light");
    if (i < questions.length - 1) setI(i + 1);
    else {
      setDone(true);
      haptic("success");
      // Persist the session for the streak/history feature. Fire-and-forget:
      // this must never block the results screen.
      void recordPracticeSession({
        subjectId: subjectId || "all",
        total: questions.length,
        correct: correctCount,
        pct,
      }).catch(() => {});
    }
  }
  function restart() { setAnswers({}); setI(0); setDone(false); haptic("medium"); }

  // ── Results ──
  if (done) {
    const passed = pct >= 50;
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }}>
        <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
          <View style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: passed ? colors.brand.green : colors.warning, justifyContent: "center", alignItems: "center" }}>
            <Trophy size={48} color={colors.brand.white} />
          </View>
          <H2 style={{ marginTop: spacing.md, fontSize: 30, color: passed ? colors.brand.greenLight : colors.warning }}>{pct}%</H2>
          <Body>{correctCount} of {questions.length} correct</Body>
          <Caption style={{ marginTop: 4 }}>{passed ? "Great work! 🎉" : "Keep practising — you'll improve."}</Caption>
        </View>

        <Label style={{ marginBottom: spacing.sm }}>Review</Label>
        <Column gap={spacing.xs + 2}>
          {questions.map((qq, idx) => {
            const ans = answers[qq.id];
            const ok = ans === qq.correct;
            return (
              <Card key={qq.id} variant="default" padding={spacing.md}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: 6 }}>
                  {ok ? <Check size={16} color={colors.success} /> : <X size={16} color={colors.danger} />}
                  <Body tone="primary" style={{ flex: 1, fontFamily: bodyFont("semibold") }} numberOfLines={2}>{idx + 1}. {qq.question}</Body>
                </View>
                {!ok && <Caption style={{ color: colors.danger }}>Your answer: {qq.options.find((o) => o.key === ans)?.text ?? "—"}</Caption>}
                <Caption style={{ color: colors.success, marginTop: 2 }}>Correct: {qq.options.find((o) => o.key === qq.correct)?.text}</Caption>
                {qq.explanation ? <Caption style={{ marginTop: 4 }}>{qq.explanation}</Caption> : null}
              </Card>
            );
          })}
        </Column>

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
          <Button variant="ghost" fullWidth onPress={restart} leftIcon={<RotateCcw size={16} color={colors.text.primary} />} style={{ backgroundColor: colors.border.subtle }}>Retry</Button>
          <Button variant="primary" fullWidth onPress={() => router.replace("/practice")}>Done</Button>
        </View>
      </ScrollView>
    );
  }

  // ── Question ──
  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Progress */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.sm + 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs }}>
          <Caption>Question {i + 1} of {questions.length}</Caption>
          <Badge tone={q.difficulty === "hard" ? "danger" : q.difficulty === "medium" ? "warning" : "success"}>{q.difficulty}</Badge>
        </View>
        <View style={{ height: 6, backgroundColor: colors.border.subtle, borderRadius: 3, overflow: "hidden" }}>
          <View style={{ height: "100%", width: `${((i + (revealed ? 1 : 0)) / questions.length) * 100}%`, backgroundColor: colors.brand.green, borderRadius: 3 }} />
        </View>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: spacing.lg }} contentContainerStyle={{ paddingBottom: spacing.lg }}>
        <Card variant="default" padding={spacing.md + 2} style={{ marginTop: spacing.xs }}>
          <Caption style={{ color: colors.brand.greenLight, fontFamily: bodyFont("bold") }}>{q.subject}</Caption>
          <Body tone="primary" style={{ fontFamily: bodyFont("bold"), fontSize: 17, lineHeight: 25, marginTop: spacing.xs }}>{q.question}</Body>

          {q.options.map((opt) => {
            const isSel = selected === opt.key;
            const isAns = opt.key === q.correct;
            const showCorrect = revealed && isAns;
            const showWrong = revealed && isSel && !isAns;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => choose(opt.key)}
                disabled={revealed}
                style={{
                  flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm + 2,
                  padding: spacing.sm + 2, borderRadius: 14,
                  backgroundColor: showCorrect ? colors.status.successBg : showWrong ? colors.status.errorBg : colors.border.subtle,
                  borderWidth: 1.5,
                  borderColor: showCorrect ? colors.success : showWrong ? colors.danger : isSel ? colors.brand.greenLight : colors.border.default,
                }}
              >
                <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: showCorrect ? colors.success : showWrong ? colors.danger : colors.border.strong, backgroundColor: showCorrect ? colors.success : showWrong ? colors.danger : "transparent", justifyContent: "center", alignItems: "center" }}>
                  {showCorrect ? <Check size={15} color={colors.brand.white} /> : showWrong ? <X size={15} color={colors.brand.white} /> : null}
                </View>
                <Body tone="primary" style={{ flex: 1 }}>{opt.text}</Body>
              </TouchableOpacity>
            );
          })}

          {revealed && (
            <Card variant="default" padding={spacing.sm + 2} style={{ marginTop: spacing.md, backgroundColor: colors.background.secondary }}>
              <Label>Explanation</Label>
              <Body style={{ marginTop: 4 }}>{q.explanation}</Body>
            </Card>
          )}
        </Card>
      </ScrollView>

      <View style={{ padding: spacing.md, paddingBottom: spacing.xxl, borderTopWidth: 1, borderTopColor: colors.border.subtle }}>
        <Button fullWidth size="lg" variant={revealed ? "primary" : "ghost"} disabled={!revealed} onPress={next} rightIcon={revealed ? <ChevronRight size={18} color={colors.brand.white} /> : undefined} style={!revealed ? { backgroundColor: colors.border.subtle, opacity: 0.5 } : undefined}>
          {i < questions.length - 1 ? "Next Question" : "Finish & See Score"}
        </Button>
      </View>
    </View>
  );
}
