import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert, RefreshControl, AppState } from "react-native";
import { useRouter } from "expo-router";
import { studentApi } from "@/lib/api";
import {
  deleteOfflineExam,
  listDownloadedExams,
  listAttemptsWithExam,
  offlineAttemptCount,
  pendingSubmittedCount,
  retryAttempt,
  type AttemptListItem,
  type OfflineExam,
} from "@/lib/offline/exams";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Button } from "@/src/components/buttons";
import { Screen, AppBar, Row, Column } from "@/src/components/layout";
import { bodyFont } from "@/src/theme/typography";
import { useToast } from "@/components/MobileToast";
import { DownloadCloud, Offline, PlayCircle, Trash2, Wifi, LoaderCircle, RefreshCw, AlertTriangle, CheckCircle2, Clock } from "lucide-react-native";

type ServerExam = {
  id: string;
  title: string;
  subjectName: string;
  durationMinutes: number;
  status: string;
  scheduledFor?: string | null;
};

export default function OfflineExamsScreen() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { toast } = useToast();
  const [downloaded, setDownloaded] = useState<OfflineExam[]>([]);
  const [serverExams, setServerExams] = useState<ServerExam[]>([]);
  const [attempts, setAttempts] = useState<AttemptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [submitting, setSubmitting] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [local, att] = await Promise.all([listDownloadedExams(), listAttemptsWithExam()]);
    setDownloaded(local);
    setAttempts(att);
    setPending(await offlineAttemptCount());
    setSubmitting(await pendingSubmittedCount());
    import("@/lib/offline/sync")
      .then((m) => m.syncOfflineExams())
      .then(async () => {
        const [upd, p, s] = await Promise.all([listAttemptsWithExam(), offlineAttemptCount(), pendingSubmittedCount()]);
        setAttempts(upd);
        setPending(p);
        setSubmitting(s);
      })
      .catch(() => {});
    try {
      const list: any = await studentApi.exams();
      setServerExams(list.exams || list.upcoming || list || []);
      setOnline(true);
    } catch {
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  async function retry(a: AttemptListItem) {
    setRetryingId(a.attemptId);
    await retryAttempt(a.attemptId);
    try {
      const { syncOfflineExams } = await import("@/lib/offline/sync");
      await syncOfflineExams();
      toast("Retrying submission…", "info");
    } catch {
      toast("Still offline — will retry when reconnected.", "warning");
    }
    await refresh();
    setRetryingId(null);
  }

  // Auto-sync on app foreground.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s: string) => {
      if (s === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function downloadExam(examId: string) {
    setDownloadingId(examId);
    try {
      const { saveOfflinePackage } = await import("@/lib/offline/exams");
      // Pre-download without creating a server attempt — that happens when
      // the student taps Start (so the exam timer doesn't tick during
      // download the night before).
      const pkg = await studentApi.downloadOfflineExam(examId);
      await saveOfflinePackage(pkg);
      toast("Exam downloaded for offline use.", "success");
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't download exam.", "error");
    } finally {
      setDownloadingId(null);
    }
  }

  function confirmDelete(exam: OfflineExam) {
    Alert.alert("Delete offline exam?", `${exam.title} will be removed from this device.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteOfflineExam(exam.id);
          await refresh();
        },
      },
    ]);
  }

  const downloadedIds = new Set(downloaded.map((e) => e.id));

  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.brand.greenLight} />}
    >
      <AppBar title="Offline CBT" onBack={() => router.back()} />

      {!online && (
        <Card variant="bordered" padding={spacing.md} style={{ borderColor: colors.warning, marginBottom: spacing.md }}>
          <Row gap={spacing.sm}>
            <Offline size={20} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Label>You are offline</Label>
              <Caption>You can sit downloaded exams; new downloads will appear when back online.</Caption>
            </View>
          </Row>
        </Card>
      )}

      {submitting > 0 && (
        <Card variant="bordered" padding={spacing.md} style={{ borderColor: colors.brand.green, marginBottom: spacing.md }}>
          <Row gap={spacing.sm}>
            <Wifi size={20} color={colors.brand.green} />
            <View style={{ flex: 1 }}>
              <Label>{submitting} paper{submitting > 1 ? "s" : ""} submitted — syncing</Label>
              <Caption>Answers are locked on this device; they're uploading to the server now.</Caption>
            </View>
          </Row>
        </Card>
      )}

      {attempts.length > 0 && (
        <>
          <H2 style={{ marginBottom: spacing.sm }}>Your sittings</H2>
          <Column gap={spacing.xs} style={{ marginBottom: spacing.lg }}>
            {attempts.map((a) => {
              const isSynced = a.syncStatus === "SYNCED";
              const isFailed = a.syncStatus === "FAILED";
              const isInProgress = !a.submitted;
              const statusColor = isSynced ? colors.success : isFailed ? colors.danger : colors.warning;
              const StatusIcon = isSynced ? CheckCircle2 : isFailed ? AlertTriangle : isInProgress ? Clock : RefreshCw;
              const statusLabel = isSynced
                ? "Submitted & synced"
                : isFailed
                  ? "Sync failed"
                  : isInProgress
                    ? "In progress"
                    : "Submitted · waiting to sync";
              return (
                <Card key={a.attemptId} variant="default" padding={spacing.md}>
                  <Row style={{ alignItems: "center" }}>
                    <StatusIcon size={20} color={statusColor} style={{ marginRight: spacing.sm }} />
                    <View style={{ flex: 1 }}>
                      <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>
                        {a.examTitle}
                      </Body>
                      <Caption>
                        {a.subjectName} · {a.answerCount} answer{a.answerCount === 1 ? "" : "s"} ·{" "}
                        {new Date(a.startedAt).toLocaleString()}
                      </Caption>
                      <Caption style={{ color: statusColor, marginTop: 2 }}>{statusLabel}{a.lastError ? ` · ${a.lastError}` : ""}</Caption>
                    </View>
                    {isFailed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => void retry(a)}
                        disabled={retryingId === a.attemptId}
                        leftIcon={retryingId === a.attemptId ? <LoaderCircle size={14} color={colors.text.primary} /> : <RefreshCw size={14} color={colors.text.primary} />}
                      >
                        Retry
                      </Button>
                    )}
                    {!isSynced && !isFailed && a.submitted && online && (
                      <TouchableOpacity onPress={() => void refresh()} style={{ padding: 8 }}>
                        <RefreshCw size={16} color={colors.text.muted} />
                      </TouchableOpacity>
                    )}
                  </Row>
                </Card>
              );
            })}
          </Column>
        </>
      )}

      <H2 style={{ marginBottom: spacing.sm }}>Downloaded</H2>
      {downloaded.length === 0 ? (
        <Card variant="default" padding={spacing.md}>
          <Caption>No exams downloaded yet. Download an exam below while you have internet to sit it offline.</Caption>
        </Card>
      ) : (
        <Column gap={spacing.xs} style={{ marginBottom: spacing.lg }}>
          {downloaded.map((e) => (
            <Card key={e.id} variant="default" padding={spacing.md}>
              <Row style={{ alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>{e.title}</Body>
                  <Caption>{e.subjectName} · {e.durationMinutes} min · {e.examType}</Caption>
                </View>
                <TouchableOpacity
                  onPress={() => router.push(`/offline-exam-runner?examId=${e.id}`)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: 8,
                    borderRadius: radius.sm,
                    backgroundColor: colors.brand.green,
                    marginRight: spacing.xs,
                  }}
                >
                  <PlayCircle size={18} color={colors.brand.navy} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDelete(e)}
                  style={{ padding: 8, borderRadius: radius.sm, backgroundColor: colors.surface.disabled }}
                >
                  <Trash2 size={16} color={colors.danger} />
                </TouchableOpacity>
              </Row>
            </Card>
          ))}
        </Column>
      )}

      <H2 style={{ marginBottom: spacing.sm }}>Available to download</H2>
      {!online ? (
        <Caption>Connect to the internet to see exams available for download.</Caption>
      ) : serverExams.length === 0 ? (
        <Card variant="default" padding={spacing.md}>
          <Caption>No published exams found for your class.</Caption>
        </Card>
      ) : (
        <Column gap={spacing.xs}>
          {serverExams.map((e) => {
            const isDownloaded = downloadedIds.has(e.id);
            const busy = downloadingId === e.id;
            return (
              <Card key={e.id} variant="default" padding={spacing.md}>
                <Row style={{ alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>{e.title}</Body>
                    <Caption>{e.subjectName} · {e.durationMinutes} min</Caption>
                  </View>
                  {isDownloaded ? (
                    <Caption style={{ color: colors.success }}>Saved</Caption>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => void downloadExam(e.id)}
                      disabled={busy}
                      leftIcon={busy ? <LoaderCircle size={14} color={colors.text.primary} /> : <DownloadCloud size={14} color={colors.text.primary} />}
                    >
                      Download
                    </Button>
                  )}
                </Row>
              </Card>
            );
          })}
        </Column>
      )}
    </Screen>
  );
}
