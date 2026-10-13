import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Linking } from "react-native";
import { teacherApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { InlineError } from "@/src/components/dashboard";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption } from "@/src/components/typography";
import { Column } from "@/src/components/layout";
import { EmptyState } from "@/src/components/feedback";
import { bodyFont } from "@/src/theme/typography";
import { Phone, Users, MessageCircle } from "lucide-react-native";

export default function TeacherStudents() {
  const { colors, spacing } = useTheme();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setData(await teacherApi.roster());
    } catch (err) {
      // Previously `catch {}` — a failed request rendered an empty
      // screen indistinguishable from "there is nothing here".
      setError(err instanceof Error ? err.message : "Couldn't load your class roster.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const students = data?.students || [];

  return (
    <FlatList
      data={students}
      keyExtractor={(item: any) => item.id}
      style={{ flex: 1, backgroundColor: colors.background.primary }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: 56 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.brand.greenLight}
        />
      }
      ListHeaderComponent={() => (
        <View>
          <H2>{data?.className || "My Class"}</H2>
          <Caption style={{ marginTop: 4, marginBottom: spacing.lg }}>
            {students.length} students
          </Caption>
          {error ? (
            <InlineError
              message={error}
              onRetry={() => {
                void load();
              }}
            />
          ) : null}
        </View>
      )}
      renderItem={({ item }) => (
        <Card variant="default" padding={spacing.sm + 2} style={{ marginBottom: spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: colors.brand.green,
                justifyContent: "center",
                alignItems: "center",
                marginRight: spacing.sm + 2,
              }}
            >
              <Text style={{ color: colors.text.inverse, fontWeight: "bold", fontSize: 16 }}>
                {item.displayName?.charAt(0)?.toUpperCase()}
              </Text>
            </View>
            <Column style={{ flex: 1 }}>
              <Body tone="primary" style={{ fontFamily: bodyFont("semibold") }}>
                {item.displayName}
              </Body>
              <Caption>
                {item.studentId}
                {item.gender ? ` · ${item.gender}` : ""}
              </Caption>
            </Column>
          </View>
          {(item.guardianName || item.guardianPhone) && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: spacing.xs + 2,
                paddingTop: spacing.xs + 2,
                borderTopWidth: 1,
                borderTopColor: colors.border.subtle,
              }}
            >
              <Column style={{ flex: 1 }}>
                <Caption>Guardian</Caption>
                <Body style={{ fontSize: 12 }}>{item.guardianName || "—"}</Body>
              </Column>
              {item.guardianPhone ? (
                <View style={{ flexDirection: "row", gap: spacing.xs }}>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${item.guardianPhone}`)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: `${colors.brand.greenLight}20`,
                      borderRadius: 12,
                      paddingHorizontal: spacing.sm + 2,
                      paddingVertical: spacing.xs + 2,
                    }}
                  >
                    <Phone size={13} color={colors.brand.greenLight} />
                    <Text
                      style={{
                        color: colors.brand.greenLight,
                        fontSize: 12,
                        fontWeight: "600",
                        fontFamily: bodyFont("semibold"),
                      }}
                    >
                      Call
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      Linking.openURL(
                        `https://wa.me/${item.guardianPhone.replace(/\D/g, "").replace(/^0/, "234")}`,
                      )
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: `${colors.brand.green}18`,
                      borderRadius: 12,
                      paddingHorizontal: spacing.sm + 2,
                      paddingVertical: spacing.xs + 2,
                    }}
                  >
                    <MessageCircle size={13} color={colors.success} />
                    <Text
                      style={{
                        color: colors.success,
                        fontSize: 12,
                        fontWeight: "600",
                        fontFamily: bodyFont("semibold"),
                      }}
                    >
                      WhatsApp
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}
        </Card>
      )}
      ListEmptyComponent={() => (
        <EmptyState
          icon={<Users size={48} color={colors.border.strong} />}
          title="No students found"
        />
      )}
    />
  );
}
