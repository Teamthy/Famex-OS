import { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { teacherApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, H3, Body, Caption, Label } from "@/src/components/typography";
import { Badge } from "@/src/components/badges";
import { Column } from "@/src/components/layout";
import { AppHeader } from "@/src/components/navigation";
import { Button } from "@/src/components/buttons";
import { Mail, BookOpen, Layers, LogOut, Award, Settings } from "lucide-react-native";

export default function TeacherProfile() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const [data, setData] = useState<any>(null);

  useEffect(() => { teacherApi.profile().then((res) => setData(res?.teacher)); }, []);
  const t = data || {};

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }}>
      <AppHeader />
      <H2 style={{ marginTop: spacing.lg, marginBottom: spacing.xxl }}>Profile</H2>

      <View style={{ alignItems: "center", marginBottom: spacing.xxl }}>
        <View style={{ width: 84, height: 84, borderRadius: 22, backgroundColor: colors.brand.green, justifyContent: "center", alignItems: "center" }}>
          <H2 style={{ color: colors.text.inverse, fontSize: 32 }}>{t.displayName?.charAt(0)?.toUpperCase() || "T"}</H2>
        </View>
        <H3 style={{ marginTop: spacing.sm }}>{t.displayName}</H3>
        <Caption>{t.roleLabel || "Teacher"}</Caption>
        {t.isFormTeacher && <Badge tone="accent" style={{ marginTop: spacing.xs + 2 }} icon={<Award size={12} color={colors.brand.greenLight} />}>{`Form Teacher · ${t.formClassName}`}</Badge>}
      </View>

      <Column gap={spacing.sm} style={{ marginBottom: spacing.xxl }}>
        <InfoRow icon={<Mail size={18} color={colors.brand.greenLight} />} label="Email" value={t.email || ""} />
        <InfoRow icon={<BookOpen size={18} color={colors.brand.greenLight} />} label="Subjects" value={(t.subjects || []).join(", ") || "—"} />
      </Column>

      <Label style={{ marginBottom: spacing.xs + 2 }}>Class Assignments</Label>
      <Column gap={spacing.xs} style={{ marginBottom: spacing.xxl }}>
        {(t.classes || []).map((c: any, i: number) => (
          <Card key={i} variant="default" padding={spacing.sm + 2} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 }}>
            <Layers size={16} color={colors.brand.greenLight} />
            <Column style={{ flex: 1 }}>
              <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>{c.name}</Body>
              <Caption>{c.role}{c.subject ? ` · ${c.subject}` : ""}</Caption>
            </Column>
          </Card>
        ))}
        {(t.classes || []).length === 0 && <Caption>No class assignments.</Caption>}
      </Column>

      <Button
        variant="ghost"
        fullWidth
        leftIcon={<Settings size={18} color={colors.brand.greenLight} />}
        onPress={() => router.push("/settings")}
        style={{ backgroundColor: colors.surface.card, marginBottom: spacing.sm }}
      >
        <Body tone="primary">Settings</Body>
      </Button>
      <Button variant="ghost" fullWidth leftIcon={<LogOut size={18} color={colors.danger} />} onPress={() => router.push("/logout")} style={{ backgroundColor: colors.status.errorBg }}>
        <Body tone="primary" style={{ color: colors.danger }}>Sign Out</Body>
      </Button>
      <Caption style={{ textAlign: "center", marginTop: spacing.xxl }}>Ykay College · Staff Portal</Caption>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const { spacing } = useTheme();
  return (
    <Card variant="default" padding={spacing.sm + 2} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      {icon}
      <Column style={{ flex: 1 }}>
        <Caption>{label}</Caption>
        <Body tone="primary" style={{ fontFamily: "DM Sans Medium" }}>{value}</Body>
      </Column>
    </Card>
  );
}

import { bodyFont } from "@/src/theme/typography";
