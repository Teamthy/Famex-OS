import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { studentApi, getMe } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { Body, Caption, Label } from "@/src/components/typography";
import { Screen, AppBar } from "@/src/components/layout";
import { YkayLogo } from "@/components/YkayLogo";
import { bodyFont } from "@/src/theme/typography";
import { Mail, Hash, IdCard, ShieldCheck } from "lucide-react-native";

export default function StudentIdCard() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const [dash, setDash] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    studentApi.dashboard().then(setDash).catch(() => {});
    getMe().then((r) => setUser(r?.user));
  }, []);

  const s = dash?.student || {};
  const name = user?.name || s.displayName || "Student";
  const initials = name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Screen scroll>
      <AppBar title="Student ID Card" onBack={() => router.back()} />
      <View style={{ alignItems: "center" }}>
        <Caption style={{ marginBottom: spacing.lg }}>
          Present this at school events
        </Caption>

      <Card variant="bordered" padding={0} style={{ width: "100%", maxWidth: 360, overflow: "hidden", borderRadius: radius.lg }}>
        {/* Premium header band */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.md,
            backgroundColor: colors.background.secondary,
            borderBottomWidth: 3,
            borderBottomColor: colors.brand.green,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <YkayLogo size={32} textSize={14} />
          <Label style={{ color: colors.brand.greenLight, fontSize: 10 }}>STUDENT</Label>
        </View>

        <View style={{ padding: spacing.lg, flexDirection: "row", gap: spacing.md }}>
          <View
            style={{
              width: 74,
              height: 84,
              borderRadius: 14,
              backgroundColor: colors.brand.green,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text
              style={{ color: colors.text.inverse, fontSize: 28, fontWeight: "bold", fontFamily: bodyFont("bold") }}
            >
              {initials}
            </Text>
          </View>
          <View style={{ flex: 1, justifyContent: "center", gap: spacing.xs + 2 }}>
            <View>
              <Caption>NAME</Caption>
              <Body tone="primary" numberOfLines={2} style={{ fontFamily: bodyFont("bold"), lineHeight: 20 }}>
                {name}
              </Body>
            </View>
            {s.className ? (
              <View>
                <Caption>CLASS</Caption>
                <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>
                  {s.className}
                </Body>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm + 2 }}>
          {user?.email ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              <Mail size={14} color={colors.brand.greenLight} />
              <Body style={{ fontSize: 12 }} numberOfLines={1}>
                {user.email}
              </Body>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Hash size={14} color={colors.brand.greenLight} />
            <Body style={{ fontSize: 12 }}>{s.studentId || user?.id?.slice(0, 12) || "—"}</Body>
          </View>
        </View>

        {/* Barcode strip */}
        <View
          style={{
            height: 30,
            backgroundColor: colors.background.primary,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            paddingHorizontal: spacing.lg,
          }}
        >
          {Array.from({ length: 32 }).map((_, i) => (
            <View key={i} style={{ width: (i % 3) + 1, height: 18, backgroundColor: colors.text.primary }} />
          ))}
        </View>
      </Card>

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xl }}>
          <ShieldCheck size={15} color={colors.brand.greenLight} />
          <Caption>Verified digital ID · Ykay College</Caption>
        </View>
      </View>
    </Screen>
  );
}
