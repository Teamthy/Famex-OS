import { useEffect, useState } from "react";
import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { adminApi, getMe } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption } from "@/src/components/typography";
import { Badge } from "@/src/components/badges";
import { Column } from "@/src/components/layout";
import { AppHeader } from "@/src/components/navigation";
import { Button } from "@/src/components/buttons";
import { Mail, Shield, LogOut, Settings } from "lucide-react-native";

export default function AdminProfile() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const [user, setUser] = useState<any>(null);

  useEffect(() => { getMe().then((res) => setUser(res?.user)); adminApi.dashboard().then((r) => setUser((u: any) => ({ ...u, roleLabel: r?.admin?.role }))); }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }}>
      <AppHeader />
      <H2 style={{ marginTop: spacing.lg, marginBottom: spacing.xxl }}>Profile</H2>

      <View style={{ alignItems: "center", marginBottom: spacing.xxl }}>
        <View style={{ width: 84, height: 84, borderRadius: 22, backgroundColor: colors.brand.green, justifyContent: "center", alignItems: "center" }}>
          <H2 style={{ color: colors.text.inverse, fontSize: 32 }}>{user?.name?.charAt(0)?.toUpperCase() || "A"}</H2>
        </View>
        <H2 style={{ fontSize: 20, marginTop: spacing.sm }}>{user?.name}</H2>
        <Badge tone="accent" style={{ marginTop: spacing.xs + 2 }} icon={<Shield size={12} color={colors.brand.greenLight} />}>{user?.roleLabel || user?.role || "Administrator"}</Badge>
      </View>

      <Column gap={spacing.sm} style={{ marginBottom: spacing.xxl }}>
        <Row icon={<Mail size={18} color={colors.brand.greenLight} />} label="Email" value={user?.email || ""} />
        <Row icon={<Shield size={18} color={colors.brand.greenLight} />} label="Access" value="School Administrator" />
      </Column>

      <Card variant="default" padding={spacing.sm + 2} style={{ marginBottom: spacing.xxl }}>
        <Body>This is the admin overview. Full school management (students, staff, fees, report cards) is available on the web portal.</Body>
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
    </ScrollView>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const { spacing } = useTheme();
  return (
    <Card variant="default" padding={spacing.sm + 2} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      {icon}
      <Column><Caption>{label}</Caption><Body tone="primary" style={{ fontFamily: "DM Sans Medium" }}>{value}</Body></Column>
    </Card>
  );
}
