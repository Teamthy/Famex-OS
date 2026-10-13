import { useCallback, useEffect, useMemo, useState } from "react";
import { View, ScrollView, TextInput, RefreshControl, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { messagingApi } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Button } from "@/src/components/buttons";
import { Avatar } from "@/src/components/avatar";
import { Badge } from "@/src/components/badges";
import { Chip, ChipRow } from "@/src/components/chips";
import { Modal } from "@/src/components/modals";
import { EmptyState, Skeleton } from "@/src/components/feedback";
import { InlineError } from "@/src/components/dashboard";
import { useToast } from "@/components/MobileToast";
import { bodyFont } from "@/src/theme/typography";
import { haptic } from "@/lib/haptics";
import { ArrowLeft, MessageSquare, Plus, Search, X, ChevronRight } from "lucide-react-native";

/** "2h ago" style stamp — absolute dates read poorly in a conversation list. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short" });
}

export default function MessagesScreen() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { portal } = useSession();
  const { toast } = useToast();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // Compose sheet
  const [showNew, setShowNew] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await messagingApi.inbox());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your messages.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const threads = useMemo(() => {
    const list = data?.threads || [];
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((t: any) =>
      `${t.subject} ${t.student?.displayName || ""} ${t.preview || ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [data, q]);

  const students = data?.students || [];
  const totalUnread = (data?.threads || []).reduce(
    (sum: number, t: any) => sum + (t.unread || 0),
    0,
  );

  async function send() {
    if (!studentId) {
      setFormError("Choose who this is about.");
      haptic("warning");
      return;
    }
    if (subject.trim().length < 2) {
      setFormError("Add a short subject.");
      haptic("warning");
      return;
    }
    if (!body.trim()) {
      setFormError("Write your message.");
      haptic("warning");
      return;
    }
    setFormError(null);
    setSending(true);
    try {
      const res: any = await messagingApi.start({
        studentProfileId: studentId,
        subject: subject.trim(),
        body: body.trim(),
      });
      haptic("success");
      toast("Message sent.", "success");
      setShowNew(false);
      setSubject("");
      setBody("");
      setStudentId(null);
      if (res?.threadId) {
        router.push(`/message-thread?id=${encodeURIComponent(res.threadId)}` as never);
      } else {
        void load();
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not send the message.");
      haptic("error");
    } finally {
      setSending(false);
    }
  }

  const counterpart = portal === "parent" ? "your child's teacher" : "a parent";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 58, paddingBottom: 104 }}
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
          <Caption>Back</Caption>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <H2 style={{ flex: 1 }}>Messages</H2>
          {totalUnread > 0 ? <Badge tone="accent">{`${totalUnread} new`}</Badge> : null}
        </View>
        <Caption style={{ marginTop: 3, marginBottom: spacing.md }}>
          {(data?.threads || []).length} conversation
          {(data?.threads || []).length === 1 ? "" : "s"}
        </Caption>

        {error ? <InlineError message={error} onRetry={() => void load()} /> : null}

        {(data?.threads || []).length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              backgroundColor: colors.surface.input,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              marginBottom: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border.default,
            }}
          >
            <Search size={18} color={colors.text.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search conversations…"
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
              <TouchableOpacity
                onPress={() => setQ("")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={16} color={colors.text.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {loading ? (
          <View style={{ gap: spacing.sm }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height={78} radius={16} />
            ))}
          </View>
        ) : threads.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={44} color={colors.border.strong} />}
            title={q ? "No matches" : "No conversations yet"}
            message={
              q
                ? "Try a different search."
                : `Start a conversation with ${counterpart} about a student.`
            }
          />
        ) : (
          <View style={{ gap: spacing.xs + 2 }}>
            {threads.map((t: any) => {
              const unread = t.unread > 0;
              return (
                <Card
                  key={t.id}
                  variant="default"
                  padding={spacing.md - 2}
                  onPress={() => {
                    haptic("light");
                    router.push(`/message-thread?id=${encodeURIComponent(t.id)}` as never);
                  }}
                  style={{
                    flexDirection: "row",
                    gap: spacing.sm + 2,
                    borderColor: unread ? colors.brand.green + "55" : colors.border.subtle,
                    backgroundColor: unread ? colors.surface.cardHover : colors.background.elevated,
                  }}
                >
                  <Avatar name={t.student?.displayName} size="md" />

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Body
                        tone="primary"
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          fontFamily: bodyFont(unread ? "bold" : "medium"),
                          fontSize: 15,
                        }}
                      >
                        {t.subject}
                      </Body>
                      <Caption style={{ fontSize: 11 }}>{relativeTime(t.lastMessageAt)}</Caption>
                    </View>

                    <Caption style={{ marginTop: 1 }} numberOfLines={1}>
                      About {t.student?.displayName}
                      {t.student?.className ? ` · ${t.student.className}` : ""}
                    </Caption>

                    {t.preview ? (
                      <Caption
                        tone={unread ? "secondary" : "muted"}
                        style={{ marginTop: 4 }}
                        numberOfLines={1}
                      >
                        {t.preview}
                      </Caption>
                    ) : null}
                  </View>

                  {unread ? (
                    <View
                      style={{
                        minWidth: 20,
                        height: 20,
                        borderRadius: 10,
                        paddingHorizontal: 6,
                        backgroundColor: colors.brand.green,
                        alignItems: "center",
                        justifyContent: "center",
                        alignSelf: "center",
                      }}
                    >
                      <Caption
                        style={{
                          color: colors.brand.white,
                          fontSize: 11,
                          fontFamily: bodyFont("bold"),
                        }}
                      >
                        {t.unread}
                      </Caption>
                    </View>
                  ) : (
                    <ChevronRight
                      size={18}
                      color={colors.text.muted}
                      style={{ alignSelf: "center" }}
                    />
                  )}
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {students.length > 0 ? (
        <View
          style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg }}
        >
          <Button
            fullWidth
            size="lg"
            leftIcon={<Plus size={18} color={colors.brand.white} />}
            onPress={() => {
              haptic("light");
              if (students.length === 1) setStudentId(students[0].id);
              setShowNew(true);
            }}
          >
            New message
          </Button>
        </View>
      ) : null}

      <Modal
        visible={showNew}
        onClose={() => {
          setShowNew(false);
          setFormError(null);
        }}
        title="New message"
      >
        <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <Label>About which student?</Label>
              <ChipRow>
                {students.map((s: any) => (
                  <Chip
                    key={s.id}
                    label={s.displayName}
                    selected={studentId === s.id}
                    onPress={() => setStudentId(s.id)}
                  />
                ))}
              </ChipRow>
            </View>

            <View style={{ gap: spacing.xs }}>
              <Label>Subject</Label>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="e.g. Absence on Friday"
                placeholderTextColor={colors.text.disabled}
                style={inputStyle(colors, radius)}
              />
            </View>

            <View style={{ gap: spacing.xs }}>
              <Label>Message</Label>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Write your message…"
                placeholderTextColor={colors.text.disabled}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                style={{ ...inputStyle(colors, radius), minHeight: 110 }}
              />
            </View>

            {formError ? <Caption style={{ color: colors.danger }}>{formError}</Caption> : null}

            <Button fullWidth size="lg" loading={sending} onPress={send}>
              {sending ? "Sending…" : "Send message"}
            </Button>
          </View>
        </ScrollView>
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
