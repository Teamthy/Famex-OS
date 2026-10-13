import { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import { schoolInfoApi, type SchoolInfo } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption } from "@/src/components/typography";
import { Screen, AppBar } from "@/src/components/layout";
import { EmptyState, Loading } from "@/src/components/feedback";
import { bodyFont } from "@/src/theme/typography";
import { MapPin, Phone, Mail, School, GraduationCap, MessageCircle } from "lucide-react-native";

export default function SchoolInfoScreen() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await schoolInfoApi.get();
        if (active) setSchool(s);
      } catch {
        if (active) setSchool(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const tel = (school?.phone || "").replace(/\s/g, "");
  const wa = school?.phone
    ? `https://wa.me/${school.phone.replace(/\D/g, "").replace(/^0/, "234")}`
    : "";

  return (
    <Screen scroll>
      <AppBar title="School Info" onBack={() => router.back()} />

      {loading ? (
        <Loading label="Loading school info…" />
      ) : !school ? (
        <EmptyState
          icon={<School size={48} color={colors.border.strong} />}
          title="School info unavailable"
        />
      ) : (
        <>
          {/* ── Header ── */}
          <View style={{ alignItems: "center", marginBottom: spacing.lg, marginTop: spacing.sm }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                backgroundColor: `${colors.brand.green}1F`,
                borderWidth: 1,
                borderColor: `${colors.brand.green}33`,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <School size={34} color={colors.brand.greenLight} />
            </View>
            <H2 style={{ fontSize: 26, marginTop: spacing.md, textAlign: "center" }}>
              {school.name}
            </H2>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xs }}
            >
              <GraduationCap size={13} color={colors.brand.greenLight} />
              <Caption style={{ color: colors.brand.greenLight, fontFamily: bodyFont("medium") }}>
                {school.motto}
              </Caption>
            </View>
          </View>

          {/* ── Contact actions ── */}
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
            {tel ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${tel}`)}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  alignItems: "center",
                  padding: spacing.md,
                  borderRadius: 16,
                  backgroundColor: colors.brand.green,
                  gap: 6,
                }}
              >
                <Phone size={20} color={colors.brand.white} />
                <Caption style={{ color: colors.brand.white, fontFamily: bodyFont("bold") }}>
                  Call
                </Caption>
              </TouchableOpacity>
            ) : null}
            {wa ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(wa)}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  alignItems: "center",
                  padding: spacing.md,
                  borderRadius: 16,
                  backgroundColor: "#25D366",
                  gap: 6,
                }}
              >
                <MessageCircle size={20} color={colors.brand.white} />
                <Caption style={{ color: colors.brand.white, fontFamily: bodyFont("bold") }}>
                  WhatsApp
                </Caption>
              </TouchableOpacity>
            ) : null}
            {school.email ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(`mailto:${school.email}`)}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  alignItems: "center",
                  padding: spacing.md,
                  borderRadius: 16,
                  backgroundColor: colors.background.elevated,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  gap: 6,
                }}
              >
                <Mail size={20} color={colors.brand.greenLight} />
                <Caption style={{ color: colors.brand.greenLight, fontFamily: bodyFont("bold") }}>
                  Email
                </Caption>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* ── Details ── */}
          <Card variant="default" padding={spacing.md} style={{ gap: spacing.md }}>
            {school.address ? (
              <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
                <MapPin size={18} color={colors.brand.greenLight} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Caption>ADDRESS</Caption>
                  <Body
                    tone="primary"
                    style={{ fontFamily: bodyFont("medium"), marginTop: 2, lineHeight: 21 }}
                  >
                    {school.address}
                  </Body>
                </View>
              </View>
            ) : null}
            {school.phone ? (
              <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
                <Phone size={18} color={colors.brand.greenLight} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Caption>PHONE</Caption>
                  <Body tone="primary" style={{ fontFamily: bodyFont("medium"), marginTop: 2 }}>
                    {school.phone}
                  </Body>
                </View>
              </View>
            ) : null}
            {school.email ? (
              <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
                <Mail size={18} color={colors.brand.greenLight} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Caption>EMAIL</Caption>
                  <Body tone="primary" style={{ fontFamily: bodyFont("medium"), marginTop: 2 }}>
                    {school.email}
                  </Body>
                </View>
              </View>
            ) : null}
          </Card>
        </>
      )}
    </Screen>
  );
}
