import { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { studentApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { InlineError } from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption } from "@/src/components/typography";
import { ListItem } from "@/src/components/lists";
import { EmptyState } from "@/src/components/feedback";
import { Users, BookOpen } from "lucide-react-native";

export default function StudentTeachers() {
  const { colors, spacing } = useTheme();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setData(await studentApi.teachers());
    } catch (err) {
      // Previously `catch {}` — a failed request rendered an empty
      // screen indistinguishable from "there is nothing here".
      setError(err instanceof Error ? err.message : "Couldn't load your teachers.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  const teachers = data?.teachers || [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand.greenLight} />}>
      <H2 style={{ marginBottom: spacing.xs }}>My Teachers</H2>
      {error ? <InlineError message={error} onRetry={() => { void load(); }} /> : null}
      {data?.className && <Caption style={{ marginBottom: spacing.lg }}>{data.className}</Caption>}

      {teachers.length > 0 ? (
        teachers.map((t: any) => (
          <Card key={t.id} variant="default" padding={spacing.sm + 2} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, marginBottom: spacing.xs + 2 }}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.brand.green, justifyContent: "center", alignItems: "center" }}>
              <Body tone="inverse" style={{ fontFamily: "DM Sans Bold", fontSize: 18 }}>{t.name?.charAt(0)?.toUpperCase()}</Body>
            </View>
            <View style={{ flex: 1 }}>
              <Body tone="primary" style={{ fontFamily: "DM Sans Medium" }}>{t.name}</Body>
              {t.subject ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                  <BookOpen size={12} color={colors.brand.greenLight} />
                  <Caption style={{ color: colors.brand.greenLight }}>{t.subject}</Caption>
                </View>
              ) : null}
              {t.role && t.role !== t.subject ? <Caption style={{ marginTop: 2 }}>{t.role}</Caption> : null}
            </View>
          </Card>
        ))
      ) : (
        <EmptyState icon={<Users size={48} color={colors.border.strong} />} title="No teachers assigned yet" />
      )}
    </ScrollView>
  );
}
