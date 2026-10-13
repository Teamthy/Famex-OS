import { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { studentApi } from "@/lib/api";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { InlineError } from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption } from "@/src/components/typography";
import { Badge } from "@/src/components/badges";
import { Button } from "@/src/components/buttons";
import { Column, Row, Screen, AppBar } from "@/src/components/layout";
import { EmptyState } from "@/src/components/feedback";
import { bodyFont } from "@/src/theme/typography";
import { ClipboardCheck, Clock, Play, Lock, CheckCircle2, RotateCcw, CalendarClock } from "lucide-react-native";

export default function StudentExams() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setData(await studentApi.exams());
    } catch (err) {
      // Previously `catch {}` — a failed request rendered an empty
      // screen indistinguishable from "there is nothing here".
      setError(err instanceof Error ? err.message : "Couldn't load your exams.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  const exams = data?.exams || [];
  function onStart(exam: any) {
    if (exam.feeLocked) { Alert.alert("Fees outstanding", "Clear your outstanding fees to access exams."); return; }
    router.push({ pathname: "/exam-runner", params: { examId: exam.id } });
  }

  /** "Mon 14 Sep, 9:00 am" — a student needs the day, not an ISO string. */
  function whenLabel(exam: any): string | null {
    if (!exam.scheduledFor) return null;
    const date = new Date(exam.scheduledFor);
    if (Number.isNaN(date.getTime())) return null;
    const when = date.toLocaleString(undefined, {
      weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    });
    return exam.availability === "UPCOMING" ? `Opens ${when}` : when;
  }

  /**
   * Why this exam cannot be started. The server already computes this and
   * sends `availabilityLabel`; showing a bare "LOCKED" throws it away and
   * leaves the student with nothing to act on.
   */
  function lockLabel(exam: any): string {
    if (exam.feeLocked) return "FEES DUE";
    if (exam.availabilityLabel) return String(exam.availabilityLabel).toUpperCase();
    return "LOCKED";
  }

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand.greenLight} />}>
      <AppBar title="My Exams" onBack={() => router.back()} />
      <H2 style={{ marginBottom: spacing.xs }}>My Exams</H2>
      {error ? <InlineError message={error} onRetry={() => { void load(); }} /> : null}
      <Caption style={{ marginBottom: spacing.lg }}>Computer-based tests for your class</Caption>

      {exams.length > 0 ? (
        exams.map((exam: any) => {
          const done = exam.attempt && (exam.attempt.status === "GRADED" || exam.attempt.status === "SUBMITTED");
          const scored = exam.attempt?.scoreVisible;
          return (
            <Card key={exam.id} variant="default" padding={spacing.md} style={{ marginBottom: spacing.sm + 2 }}>
              <Row align="flex-start" gap={spacing.xs}>
                <Column style={{ flex: 1, marginRight: spacing.xs }}>
                  <Body tone="primary" style={{ fontFamily: bodyFont("bold"), fontSize: 16 }}>{exam.title}</Body>
                  <Caption style={{ marginTop: 4 }}>{exam.subjectName}</Caption>
                </Column>
                {exam.feeLocked ? <Badge tone="danger" icon={<Lock size={11} color={colors.danger} />}>FEES DUE</Badge>
                  : scored ? <Badge tone="success" icon={<CheckCircle2 size={11} color={colors.success} />}>{`${exam.attempt.percent}%`}</Badge>
                  : done ? <Badge tone="success">DONE</Badge>
                  : exam.canResume ? <Badge tone="warning">IN PROGRESS</Badge>
                  : exam.canStart ? <Badge tone="accent">OPEN</Badge>
                  : <Badge tone="neutral" icon={<Lock size={11} color={colors.text.muted} />}>{lockLabel(exam)}</Badge>}
              </Row>

              <Row gap={spacing.lg} style={{ marginTop: spacing.sm + 2 }}>
                <Row gap={4}><Clock size={14} color={colors.text.muted} /><Caption>{exam.durationMinutes} min</Caption></Row>
                <Row gap={4}><ClipboardCheck size={14} color={colors.text.muted} /><Caption>{exam.questionCount || "?"} questions</Caption></Row>
              </Row>

              {/* When to sit it. The API has sent scheduledFor/availableUntil
                  since drop 26 and this screen ignored both, so a student saw
                  a bare "LOCKED" chip with no date and no reason — the same
                  dead-end the web list had before it was fixed. */}
              {whenLabel(exam) ? (
                <Row gap={4} style={{ marginTop: 6 }}>
                  <CalendarClock size={14} color={colors.text.muted} />
                  <Caption>{whenLabel(exam)}</Caption>
                </Row>
              ) : null}

              {/* A fee lock is actionable; say so rather than just locking. */}
              {exam.feeLocked ? (
                <Caption style={{ marginTop: 6, color: colors.danger }}>
                  Clear your outstanding fees to unlock this paper.
                </Caption>
              ) : null}

              {(exam.canStart || exam.canResume) && !exam.feeLocked && (
                <Button fullWidth style={{ marginTop: spacing.sm + 4 }} leftIcon={exam.canResume ? <RotateCcw size={16} color={colors.brand.white} /> : <Play size={16} color={colors.brand.white} fill={colors.brand.white} />} variant={exam.canResume ? "secondary" : "primary"} onPress={() => onStart(exam)}>
                  {exam.canResume ? "Resume Exam" : "Start Exam"}
                </Button>
              )}

              {scored && (
                <Card variant="default" padding={spacing.sm + 2} style={{ marginTop: spacing.sm + 2, backgroundColor: colors.status.successBg, borderWidth: 0 }}>
                  <Body style={{ color: colors.success, fontFamily: bodyFont("semibold") }}>Score: {exam.attempt.totalScore} / {exam.totalMarks} ({exam.attempt.percent}%)</Body>
                </Card>
              )}
            </Card>
          );
        })
      ) : (
        <EmptyState icon={<ClipboardCheck size={48} color={colors.border.strong} />} title="No exams available" />
      )}
    </Screen>
  );
}
