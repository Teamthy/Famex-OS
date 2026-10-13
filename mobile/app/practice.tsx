import { ScrollView, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Column } from "@/src/components/layout";
import { AppHeader } from "@/src/components/navigation";
import { bodyFont } from "@/src/theme/typography";
import { PRACTICE_SUBJECTS, ALL_PRACTICE_QUESTIONS } from "@/lib/practiceBank";
import { haptic } from "@/lib/haptics";
import { Sparkles, ChevronRight, Zap, Flame } from "lucide-react-native";

export default function PracticeHub() {
  const router = useRouter();
  const { colors, spacing } = useTheme();

  function start(subjectId: string) {
    haptic("light");
    router.push({ pathname: "/practice-runner", params: { subjectId } });
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }}>
      <AppHeader />
      <Caption style={{ marginTop: spacing.lg }}>Practice &amp; revise</Caption>
      <H2 style={{ marginTop: 2, marginBottom: spacing.xs }}>Practice Tests</H2>
      <Body style={{ marginBottom: spacing.lg }}>{ALL_PRACTICE_QUESTIONS.length} questions across {PRACTICE_SUBJECTS.length} subjects — instant scoring &amp; explanations, works offline.</Body>

      {/* Streak / history */}
      <TouchableOpacity onPress={() => router.push("/practice-progress")} style={{ marginBottom: spacing.lg }}>
        <Card variant="default" padding={spacing.sm + 4} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, borderColor: colors.brand.orange }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.brand.orange, justifyContent: "center", alignItems: "center" }}>
            <Flame size={20} color={colors.brand.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Body tone="primary" style={{ fontFamily: bodyFont("bold") }}>My progress &amp; streak</Body>
            <Caption>Track your daily practice</Caption>
          </View>
          <ChevronRight size={18} color={colors.brand.orange} />
        </Card>
      </TouchableOpacity>

      {/* Quick mix */}
      <TouchableOpacity onPress={() => start("all")}>
        <Card variant="bordered" padding={spacing.md} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg, borderColor: colors.brand.green }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.brand.green, justifyContent: "center", alignItems: "center" }}>
            <Zap size={24} color={colors.brand.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Body tone="primary" style={{ fontFamily: bodyFont("bold") }}>Quick Mixed Test</Body>
            <Caption>{ALL_PRACTICE_QUESTIONS.length} questions · all subjects</Caption>
          </View>
          <ChevronRight size={18} color={colors.brand.greenLight} />
        </Card>
      </TouchableOpacity>

      <Label style={{ marginBottom: spacing.sm }}>By Subject</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {PRACTICE_SUBJECTS.map((s) => (
          <TouchableOpacity key={s.id} onPress={() => start(s.id)} style={{ width: "47%" }}>
            <Card variant="default" padding={spacing.md} style={{ height: 120 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Body style={{ fontSize: 30 }}>{s.icon}</Body>
                <Sparkles size={16} color={s.color} />
              </View>
              <Body tone="primary" style={{ fontFamily: bodyFont("bold"), marginTop: spacing.sm }}>{s.name}</Body>
              <Caption>{s.questions.length} questions</Caption>
            </Card>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
