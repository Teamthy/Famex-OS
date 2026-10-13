import { useEffect, useState } from "react";
import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { getMe } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Column } from "@/src/components/layout";
import { AppHeader } from "@/src/components/navigation";
import { Button } from "@/src/components/buttons";
import { Mail, User, Users, LogOut, Settings } from "lucide-react-native";

export default function ParentProfile() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const [user, setUser] = useState<any>(null);

  useEffect(() => { getMe().then((res) => setUser(res?.user)); }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }}>
      <AppHeader />
      <H2 style={{ marginTop: spacing.lg, marginBottom: spacing.xxl }}>Profile</H2>

      <View style={{ alignItems: "center", marginBottom: spacing.xxl }}>
        <View style={{ width: 80, height: 80, borderRadius: 22, backgroundColor: colors.brand.green, justifyContent: "center", alignItems: "center" }}>
          <H2 style={{ color: colors.text.inverse, fontSize: 32 }}>{user?.name?.charAt(0)?.toUpperCase() || "P"}</H2>
        </View>
        <H2 style={{ fontSize: 20, marginTop: spacing.sm }}>{user?.name}</H2>
        <Caption>Parent / Guardian</Caption>
      </View>

      <Column gap={spacing.sm} style={{ marginBottom: spacing.xxl }}>
        <InfoRow icon={<Mail size={18} color={colors.brand.greenLight} />} label="Email" value={user?.email || ""} />
        <InfoRow icon={<User size={18} color={colors.brand.greenLight} />} label="Role" value="Parent" />
      </Column>

      <Label style={{ marginBottom: spacing.xs + 2 }}>Linked Wards</Label>
      <Card variant="default" padding={spacing.sm + 2} style={{ marginBottom: spacing.xxl }}>
        <Body>Your linked children appear on the Home screen. Contact the school to add or update a ward.</Body>
      </Card>

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
      <Caption style={{ textAlign: "center", marginTop: spacing.xxl }}>Ykay College · Parent Portal</Caption>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const { spacing } = useTheme();
  return (
    <Card variant="default" padding={spacing.sm + 2} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      {icon}
      <Column>
        <Caption>{label}</Caption>
        <Body tone="primary" style={{ fontFamily: "DM Sans Medium" }}>{value}</Body>
      </Column>
    </Card>
  );
}
