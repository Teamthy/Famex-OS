import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { messagingApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Body, Caption, Label } from "@/src/components/typography";
import { Avatar } from "@/src/components/avatar";
import { Badge } from "@/src/components/badges";
import { Skeleton } from "@/src/components/feedback";
import { InlineError } from "@/src/components/dashboard";
import { bodyFont } from "@/src/theme/typography";
import { haptic } from "@/lib/haptics";
import { ArrowLeft, Send, MessageSquare } from "lucide-react-native";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
}

function dayOf(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en", { day: "numeric", month: "long" });
}

export default function MessageThreadScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!id) return;
      try {
        setError(null);
        const res = await messagingApi.thread(id);
        setData(res);
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : "Couldn't open this conversation.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const thread = data?.thread;
  const messages: any[] = data?.messages || [];
  const closed = thread?.status === "CLOSED";

  async function send() {
    const text = draft.trim();
    if (!text || !id) return;

    setSending(true);
    // Optimistic append: a chat that waits for a round-trip before showing your
    // own message feels broken on a slow connection.
    const optimistic = {
      id: `tmp_${Date.now()}`,
      body: text,
      at: new Date().toISOString(),
      mine: true,
      senderName: "You",
      pending: true,
    };
    setData((d: any) => ({ ...d, messages: [...(d?.messages || []), optimistic] }));
    setDraft("");
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

    try {
      await messagingApi.reply(id, text);
      haptic("success");
      await load(true);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      haptic("error");
      // Roll the optimistic bubble back and hand the text to the user rather
      // than silently losing what they typed.
      setData((d: any) => ({
        ...d,
        messages: (d?.messages || []).filter((m: any) => m.id !== optimistic.id),
      }));
      setDraft(text);
      setError(e instanceof Error ? e.message : "Message not sent.");
    } finally {
      setSending(false);
    }
  }

  let lastDay = "";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
      style={{ flex: 1, backgroundColor: colors.background.primary }}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: 56,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.subtle,
          backgroundColor: colors.background.elevated,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm }}
        >
          <ArrowLeft size={20} color={colors.text.muted} />
          <Caption>Messages</Caption>
        </TouchableOpacity>

        {loading ? (
          <Skeleton width="70%" height={20} radius={6} />
        ) : thread ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Avatar name={thread.student?.displayName} size="md" />
            <View style={{ flex: 1 }}>
              <Body
                tone="primary"
                numberOfLines={1}
                style={{ fontFamily: bodyFont("bold"), fontSize: 16 }}
              >
                {thread.subject}
              </Body>
              <Caption numberOfLines={1}>
                About {thread.student?.displayName}
                {thread.student?.className ? ` · ${thread.student.className}` : ""}
              </Caption>
            </View>
            {closed ? <Badge tone="neutral">CLOSED</Badge> : null}
          </View>
        ) : null}
      </View>

      {/* Transcript */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.lg, flexGrow: 1 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
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
        {error ? <InlineError message={error} onRetry={() => void load()} /> : null}

        {loading ? (
          <View style={{ gap: spacing.md }}>
            {[0, 1, 2].map((i) => (
              <Skeleton
                key={i}
                width={i % 2 === 0 ? "72%" : "58%"}
                height={62}
                radius={16}
                style={{ alignSelf: i % 2 === 0 ? "flex-start" : "flex-end" } as never}
              />
            ))}
          </View>
        ) : messages.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <MessageSquare size={38} color={colors.border.strong} />
            <Caption style={{ marginTop: spacing.sm }}>No messages yet</Caption>
          </View>
        ) : (
          messages.map((m) => {
            const day = dayOf(m.at);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <View key={m.id}>
                {showDay ? (
                  <View style={{ alignItems: "center", marginVertical: spacing.md }}>
                    <View
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: radius.round,
                        backgroundColor: colors.surface.card,
                      }}
                    >
                      <Caption style={{ fontSize: 11 }}>{day}</Caption>
                    </View>
                  </View>
                ) : null}

                <View
                  style={{
                    alignSelf: m.mine ? "flex-end" : "flex-start",
                    maxWidth: "82%",
                    marginBottom: spacing.sm,
                    opacity: m.pending ? 0.6 : 1,
                  }}
                >
                  {!m.mine ? (
                    <Caption style={{ marginBottom: 3, marginLeft: 4, fontSize: 11 }}>
                      {m.senderName}
                    </Caption>
                  ) : null}

                  <View
                    style={{
                      backgroundColor: m.mine ? colors.brand.green : colors.background.elevated,
                      borderWidth: m.mine ? 0 : 1,
                      borderColor: colors.border.subtle,
                      borderRadius: radius.lg,
                      // Tail corner on the sender's side.
                      borderBottomRightRadius: m.mine ? 4 : radius.lg,
                      borderBottomLeftRadius: m.mine ? radius.lg : 4,
                      paddingHorizontal: spacing.md - 2,
                      paddingVertical: spacing.sm + 2,
                    }}
                  >
                    <Body
                      style={{
                        color: m.mine ? colors.brand.white : colors.text.primary,
                        fontSize: 15,
                        lineHeight: 21,
                      }}
                    >
                      {m.body}
                    </Body>
                  </View>

                  <Caption
                    style={{
                      fontSize: 10.5,
                      marginTop: 3,
                      alignSelf: m.mine ? "flex-end" : "flex-start",
                      marginHorizontal: 4,
                    }}
                  >
                    {m.pending ? "Sending…" : timeOf(m.at)}
                  </Caption>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Composer */}
      {!loading && thread ? (
        closed ? (
          <View
            style={{
              padding: spacing.lg,
              borderTopWidth: 1,
              borderTopColor: colors.border.subtle,
              alignItems: "center",
            }}
          >
            <Caption>This conversation is closed.</Caption>
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: spacing.sm,
              padding: spacing.md,
              paddingBottom: spacing.lg,
              borderTopWidth: 1,
              borderTopColor: colors.border.subtle,
              backgroundColor: colors.background.elevated,
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a reply…"
              placeholderTextColor={colors.text.disabled}
              multiline
              style={{
                flex: 1,
                maxHeight: 120,
                minHeight: 44,
                color: colors.text.primary,
                backgroundColor: colors.surface.input,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border.default,
                paddingHorizontal: spacing.md - 2,
                paddingTop: 12,
                paddingBottom: 12,
                fontFamily: "DM Sans",
                fontSize: 15,
              }}
            />
            <TouchableOpacity
              onPress={send}
              disabled={!draft.trim() || sending}
              activeOpacity={0.85}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: draft.trim() ? colors.brand.green : colors.surface.cardHover,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Send size={19} color={draft.trim() ? colors.brand.white : colors.text.disabled} />
            </TouchableOpacity>
          </View>
        )
      ) : null}
    </KeyboardAvoidingView>
  );
}
