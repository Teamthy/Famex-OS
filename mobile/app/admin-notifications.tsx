import { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl, TextInput, Alert } from "react-native";
import { adminApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { InlineError } from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Button } from "@/src/components/buttons";
import { Column } from "@/src/components/layout";
import { Modal } from "@/src/components/modals";
import { bodyFont } from "@/src/theme/typography";
import { Bell, Send } from "lucide-react-native";

export default function AdminNotifications() {
  const { colors, spacing } = useTheme();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("ALL");
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      setError(null);
      setData(await adminApi.notifications());
    } catch (err) {
      // Previously `catch {}` — a failed request rendered an empty
      // screen indistinguishable from "there is nothing here".
      setError(err instanceof Error ? err.message : "Couldn't load notifications.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function broadcast() {
    if (!title.trim()) { Alert.alert("Title required"); return; }
    setSending(true);
    try {
      await adminApi.broadcast({ title, body, audience, channels: ["IN_APP", "EMAIL"] });
      setOpen(false); setTitle(""); setBody(""); setAudience("ALL");
      Alert.alert("Sent", "Notification broadcast queued.");
      load();
    } catch (e: any) { Alert.alert("Failed", e.message || "Could not broadcast."); }
    finally { setSending(false); }
  }

  const s = data?.summary || {};

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand.greenLight} />}>
      <H2 style={{ marginBottom: spacing.lg }}>Notifications</H2>
      {error ? <InlineError message={error} onRetry={() => { void load(); }} /> : null}

      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
        <Mini label="Pending" value={s.pending ?? 0} color={colors.warning} />
        <Mini label="Sent" value={s.sent ?? 0} color={colors.success} />
        <Mini label="Failed" value={s.failed ?? 0} color={colors.danger} />
      </View>

      <Button fullWidth leftIcon={<Send size={16} color={colors.brand.white} />} onPress={() => setOpen(true)}>Broadcast Notification</Button>

      <Modal visible={open} onClose={() => setOpen(false)} title="Broadcast" footer={<View style={{ flexDirection: "row", gap: spacing.sm + 2 }}><Button variant="ghost" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: colors.border.subtle }}>Cancel</Button><Button loading={sending} onPress={broadcast} style={{ flex: 1 }}>{sending ? "Sending…" : "Send"}</Button></View>}>
        <Column gap={spacing.md}>
          <Field label="Title"><TextInput value={title} onChangeText={setTitle} placeholder="Notification title" placeholderTextColor={colors.text.muted} style={input(colors)} /></Field>
          <Field label="Message"><TextInput value={body} onChangeText={setBody} placeholder="Message body…" placeholderTextColor={colors.text.muted} multiline style={{ ...input(colors), minHeight: 100 }} /></Field>
          <Field label="Audience"><TextInput value={audience} onChangeText={setAudience} placeholder="ALL / ALL_PARENTS / ALL_STUDENTS / ALL_STAFF" placeholderTextColor={colors.text.muted} style={input(colors)} /></Field>
        </Column>
      </Modal>
    </ScrollView>
  );
}

function input(colors: any) { return { backgroundColor: colors.background.primary, color: colors.text.primary, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border.subtle, fontFamily: "DM Sans" }; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { const { spacing } = useTheme(); return (<View style={{ gap: spacing.xs }}><Label>{label}</Label>{children}</View>); }
function Mini({ label, value, color }: { label: string; value: number; color: string }) { const { spacing } = useTheme(); return (<Card variant="default" padding={spacing.sm + 2} style={{ flex: 1, alignItems: "center" }}><Body style={{ color, fontFamily: bodyFont("bold"), fontSize: 22 }}>{value}</Body><Caption>{label}</Caption></Card>); }
