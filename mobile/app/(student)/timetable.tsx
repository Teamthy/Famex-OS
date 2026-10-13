import { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { studentApi } from "@/lib/api";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption } from "@/src/components/typography";
import { Screen, AppBar, Column } from "@/src/components/layout";
import { EmptyState } from "@/src/components/feedback";
import { bodyFont } from "@/src/theme/typography";
import { CalendarDays, MapPin } from "lucide-react-native";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
const DAY_LABEL: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat",
};

interface Slot {
  id: string;
  day: string;
  start: string;
  end: string;
  subject: string;
  teacher: string | null;
  room: string | null;
}

/** HH:MM (24h) -> 12h display. */
function fmt(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

function todayIndex(): number {
  const d = new Date().getDay(); // 0 Sun .. 6 Sat
  return d >= 1 && d <= 6 ? d - 1 : 0; // Mon=0
}

export default function StudentTimetable() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [className, setClassName] = useState<string | null>(null);
  const [day, setDay] = useState<number>(todayIndex());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      const res: any = await studentApi.timetable();
      setSlots(res.schedule || []);
      setClassName(res.class || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your timetable.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const daySlots = slots.filter((s) => s.day === DAYS[day]).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.brand.greenLight} />}
    >
      <AppBar title="Timetable" onBack={() => router.back()} />
      <H2 style={{ fontSize: 24 }}>Class Timetable</H2>
      <Caption style={{ marginTop: 2, marginBottom: spacing.md }}>{className || "Your weekly schedule"}</Caption>

      {/* Day tabs */}
      <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.md }}>
        {DAYS.map((d, i) => (
          <TouchableOpacity
            key={d}
            onPress={() => setDay(i)}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: spacing.sm,
              borderRadius: 12,
              backgroundColor: day === i ? colors.brand.green : colors.surface.card,
              borderWidth: 1,
              borderColor: day === i ? colors.brand.green : colors.border.subtle,
            }}
          >
            <Caption style={{ color: day === i ? colors.brand.white : colors.text.secondary, fontFamily: bodyFont("bold"), fontSize: 11 }}>
              {DAY_LABEL[d]}
            </Caption>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <EmptyState icon={<CalendarDays size={44} color={colors.border.strong} />} title={error} />
      ) : daySlots.length === 0 ? (
        <EmptyState icon={<CalendarDays size={48} color={colors.border.strong} />} title={`No classes on ${DAY_LABEL[DAYS[day]]}`} message="Your schedule for this day will appear here once set by the school." />
      ) : (
        <Column gap={spacing.xs + 2}>
          {daySlots.map((slot) => (
            <Card key={slot.id} variant="default" padding={spacing.md}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
                <View style={{ minWidth: 62, alignItems: "flex-end" }}>
                  <Body tone="primary" style={{ fontFamily: bodyFont("bold"), fontSize: 14 }}>{fmt(slot.start)}</Body>
                  <Caption style={{ fontSize: 11 }}>{fmt(slot.end)}</Caption>
                </View>
                <View style={{ flex: 1 }}>
                  <Body tone="primary" style={{ fontFamily: bodyFont("bold"), fontSize: 16 }}>{slot.subject}</Body>
                  {slot.teacher ? <Caption style={{ marginTop: 3 }}>{slot.teacher}</Caption> : null}
                  {slot.room ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <MapPin size={12} color={colors.brand.greenLight} />
                      <Caption style={{ fontSize: 11 }}>{slot.room}</Caption>
                    </View>
                  ) : null}
                </View>
              </View>
            </Card>
          ))}
        </Column>
      )}
    </Screen>
  );
}
