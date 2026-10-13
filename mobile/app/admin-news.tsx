import { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl, TextInput, Alert } from "react-native";
import { adminApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { InlineError } from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Badge } from "@/src/components/badges";
import { Button } from "@/src/components/buttons";
import { Column } from "@/src/components/layout";
import { Modal } from "@/src/components/modals";
import { EmptyState } from "@/src/components/feedback";
import { bodyFont } from "@/src/theme/typography";
import { Megaphone, Plus } from "lucide-react-native";

export default function AdminNews() {
  const { colors, spacing } = useTheme();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setError(null);
      setData(await adminApi.news());
    } catch (err) {
      // Previously `catch {}` — a failed request rendered an empty
      // screen indistinguishable from "there is nothing here".
      setError(err instanceof Error ? err.message : "Couldn't load news.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function publish() {
    if (!title.trim()) { Alert.alert("Title required"); return; }
    setSaving(true);
    try {
      await adminApi.postNews({ title, excerpt, content, category, isPublished: true });
      setOpen(false); setTitle(""); setExcerpt(""); setContent(""); setCategory("GENERAL");
      Alert.alert("Published", "Announcement posted.");
      load();
    } catch (e: any) { Alert.alert("Failed", e.message || "Could not post."); }
    finally { setSaving(false); }
  }

  const posts = data?.posts || [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand.greenLight} />}>
      <H2 style={{ marginBottom: spacing.lg }}>Announcements</H2>
      {error ? <InlineError message={error} onRetry={() => { void load(); }} /> : null}

      <Button fullWidth leftIcon={<Plus size={16} color={colors.brand.white} />} onPress={() => setOpen(true)} style={{ marginBottom: spacing.lg }}>New Announcement</Button>

      {posts.length > 0 ? (
        <Column gap={spacing.xs + 2}>
          {posts.map((p: any) => (
            <Card key={p.id} variant="default" padding={spacing.md}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Column style={{ flex: 1, marginRight: 8 }}>
                  <Body tone="primary" style={{ fontFamily: bodyFont("bold") }}>{p.title}</Body>
                  <Caption style={{ marginTop: 2 }}>{p.category} · by {p.authorName}</Caption>
                </Column>
                <Badge tone={p.isPublished ? "success" : "neutral"}>{p.isPublished ? "LIVE" : "DRAFT"}</Badge>
              </View>
              {p.excerpt ? <Body style={{ marginTop: spacing.xs + 2 }}>{p.excerpt}</Body> : null}
              <Caption style={{ marginTop: spacing.xs + 2 }}>{new Date(p.createdAt).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}</Caption>
            </Card>
          ))}
        </Column>
      ) : (
        <EmptyState icon={<Megaphone size={48} color={colors.border.strong} />} title="No announcements yet" message="Post school news for parents, students and staff." />
      )}

      <Modal visible={open} onClose={() => setOpen(false)} title="New Announcement" footer={<View style={{ flexDirection: "row", gap: spacing.sm + 2 }}><Button variant="ghost" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: colors.border.subtle }}>Cancel</Button><Button loading={saving} onPress={publish} style={{ flex: 1 }}>{saving ? "Posting…" : "Publish"}</Button></View>}>
        <Column gap={spacing.md}>
          <Field label="Title"><TextInput value={title} onChangeText={setTitle} placeholder="Announcement title" placeholderTextColor={colors.text.muted} style={input(colors)} /></Field>
          <Field label="Category"><TextInput value={category} onChangeText={setCategory} placeholder="GENERAL" placeholderTextColor={colors.text.muted} style={input(colors)} /></Field>
          <Field label="Excerpt"><TextInput value={excerpt} onChangeText={setExcerpt} placeholder="Short summary" placeholderTextColor={colors.text.muted} multiline style={{ ...input(colors), minHeight: 60 }} /></Field>
          <Field label="Content"><TextInput value={content} onChangeText={setContent} placeholder="Full message…" placeholderTextColor={colors.text.muted} multiline style={{ ...input(colors), minHeight: 120 }} /></Field>
        </Column>
      </Modal>
    </ScrollView>
  );
}

function input(colors: any) {
  return { backgroundColor: colors.background.primary, color: colors.text.primary, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border.subtle, fontFamily: "DM Sans" };
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (<View style={{ gap: spacing.xs }}><Label>{label}</Label>{children}</View>);
}
