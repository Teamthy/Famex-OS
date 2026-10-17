import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, Alert, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, H3, Body, Caption, Label } from "@/src/components/typography";
import { Button } from "@/src/components/buttons";
import { Screen, AppBar, Row, Column } from "@/src/components/layout";
import { bodyFont } from "@/src/theme/typography";
import { staffMeApi, studentApi } from "@/lib/api";
import { getCurrentLocation, haversineM, type NativeGpsReading } from "@/lib/location";
import { haptic } from "@/lib/haptics";
import { useToast } from "@/components/MobileToast";
import { start as startBeacon, stop as stopBeacon } from "@/lib/geofence-beacon";
import {
  MapPin,
  MapPinOff,
  Navigation,
  LogIn,
  LogOut,
  ShieldCheck,
  LoaderCircle,
  Clock,
  CheckCircle2,
} from "lucide-react-native";

type Audience = "student" | "staff";

type Fence = {
  enabled: boolean;
  center?: { latitude: number; longitude: number };
  radiusM?: number;
};

type TodayEvent = {
  id: string;
  eventType: "CHECK_IN" | "CHECK_OUT";
  at: string;
  isLate: boolean;
  lateMinutes: number;
  distanceM?: number | null;
};

type MeData = {
  supported?: boolean;
  date?: string;
  lateCutoff?: string;
  gps?: Fence;
  staff?: { id: string; displayName: string };
  student?: { id: string; displayName: string; className: string };
  today?: {
    status: "ABSENT" | "IN" | "OUT";
    checkInAt: string | null;
    checkOutAt: string | null;
    isLate: boolean;
    lateMinutes: number;
    events: TodayEvent[];
  };
};

export default function GpsClockScreen() {
  const router = useRouter();
  const { audience: audienceParam } = useLocalSearchParams<{ audience?: Audience }>();
  const audience: Audience = audienceParam === "staff" ? "staff" : "student";
  const { colors, spacing, radius } = useTheme();
  const { toast } = useToast();

  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reading, setReading] = useState<NativeGpsReading | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [clocking, setClocking] = useState(false);
  const [lastResult, setLastResult] = useState<null | {
    action: "CHECK_IN" | "CHECK_OUT";
    at: string;
    isLate?: boolean;
    lateMinutes?: number;
    distanceM?: number;
  }>(null);

  const load = useCallback(async () => {
    try {
      const data =
        audience === "staff" ? await staffMeApi.attendance() : await studentApi.clock();
      setMe(data as MeData);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't load clock-in status.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [audience, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Start the foreground geofence beacon when the screen mounts so students
  // get an arrival nudge if they switch away from the app. Clean up on unmount.
  useEffect(() => {
    void startBeacon(audience);
    return () => stopBeacon();
  }, [audience]);

  async function locate() {
    setLocating(true);
    setLocError(null);
    try {
      const r = await getCurrentLocation();
      setReading(r);
      haptic("light");
    } catch (e) {
      setLocError(e instanceof Error ? e.message : "Unable to get your location.");
      setReading(null);
    } finally {
      setLocating(false);
    }
  }

  const fence = me?.gps?.enabled ? me.gps : null;
  const distanceM =
    fence?.center && reading
      ? Math.round(
          haversineM(
            { lat: reading.latitude, lng: reading.longitude },
            { lat: fence.center.latitude, lng: fence.center.longitude },
          ),
        )
      : Number.POSITIVE_INFINITY;
  const radiusM = fence?.radiusM ?? 100;
  const inRange = reading !== null && distanceM <= radiusM;
  const readingFresh = reading !== null && Date.now() - reading.capturedAt < 60_000;

  async function clock(action: "CHECK_IN" | "CHECK_OUT") {
    if (!reading) return toast("Get your location first.", "error");
    if (!inRange)
      return toast(
        `You are ${distanceM} m from school. Clock-in is only allowed within ${radiusM} m.`,
        "error",
      );
    setClocking(true);
    try {
      const res: any =
        audience === "staff"
          ? await staffMeApi.gpsClock({
              action,
              latitude: reading.latitude,
              longitude: reading.longitude,
              accuracyM: reading.accuracyM,
            })
          : await studentApi.gpsClock({
              action,
              latitude: reading.latitude,
              longitude: reading.longitude,
              accuracyM: reading.accuracyM,
            });
      setLastResult({
        action,
        at: res.event?.scannedAt || res.event?.clockedAt || new Date().toISOString(),
        isLate: res.event?.isLate,
        lateMinutes: res.event?.lateMinutes,
        distanceM: res.event?.geo?.distanceM,
      });
      haptic(action === "CHECK_IN" ? "success" : "light");
      toast(
        `${action === "CHECK_IN" ? "Checked in" : "Checked out"}${res.event?.isLate ? ` · late +${res.event.lateMinutes}m` : ""}`,
        res.event?.isLate ? "warning" : "success",
      );
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Clock action failed.", "error");
      haptic("error");
    } finally {
      setClocking(false);
    }
  }

  const today = me?.today;
  const displayName =
    audience === "staff" ? me?.staff?.displayName : me?.student?.displayName;
  const subtitle = audience === "staff" ? "Staff attendance" : me?.student?.className;

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={colors.brand.greenLight}
        />
      }
    >
      <AppBar
        title={audience === "staff" ? "Staff Clock-in" : "Student Clock-in"}
        onBack={() => router.back()}
      />

      {loading ? (
        <View style={{ padding: spacing.xl, alignItems: "center" }}>
          <LoaderCircle color={colors.brand.greenLight} />
          <Caption style={{ marginTop: spacing.sm }}>Loading…</Caption>
        </View>
      ) : !fence ? (
        <Card variant="bordered" padding={spacing.md}>
          <Row gap={spacing.sm}>
            <MapPinOff size={22} color={colors.text.muted} />
            <View style={{ flex: 1 }}>
              <H3>GPS clock-in not set up</H3>
              <Caption style={{ marginTop: 4 }}>
                The school admin must enable the geofence in Admin → School profile before you can
                clock in here.
              </Caption>
            </View>
          </Row>
        </Card>
      ) : (
        <Column gap={spacing.md}>
          <Card variant="bordered" padding={spacing.md} style={{ borderColor: colors.brand.green }}>
            <Row gap={spacing.sm} style={{ marginBottom: spacing.xs }}>
              <Clock size={14} color={colors.text.muted} />
              <Caption>Today · {me?.date}</Caption>
            </Row>
            <H2 style={{ fontSize: 24 }}>{displayName || "—"}</H2>
            <Caption>{subtitle} · Late after {me?.lateCutoff || "08:00"}</Caption>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <Pill
                label={today?.status || "ABSENT"}
                bg={
                  today?.status === "IN"
                    ? colors.status.successBg
                    : today?.status === "OUT"
                      ? colors.status.warningBg
                      : colors.surface.disabled
                }
                fg={
                  today?.status === "IN"
                    ? colors.success
                    : today?.status === "OUT"
                      ? colors.warning
                      : colors.text.muted
                }
              />
              {today?.isLate && (
                <Pill label={`Late +${today.lateMinutes}m`} bg={colors.status.warningBg} fg={colors.warning} />
              )}
            </View>

            <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
              <Caption style={{ color: colors.text.secondary }}>
                In:{" "}
                <Body style={{ fontFamily: bodyFont("bold") }}>
                  {today?.checkInAt ? new Date(today.checkInAt).toLocaleTimeString() : "—"}
                </Body>
              </Caption>
              <Caption style={{ color: colors.text.secondary }}>
                Out:{" "}
                <Body style={{ fontFamily: bodyFont("bold") }}>
                  {today?.checkOutAt ? new Date(today.checkOutAt).toLocaleTimeString() : "—"}
                </Body>
              </Caption>
            </Row>
          </Card>

          {/* GPS status */}
          <Card variant="default" padding={spacing.md}>
            <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <Row gap={spacing.sm}>
                {inRange && readingFresh ? (
                  <ShieldCheck size={22} color={colors.success} />
                ) : (
                  <MapPin size={22} color={colors.warning} />
                )}
                <View style={{ flex: 1 }}>
                  <Label>GPS verification</Label>
                  <Caption>
                    You must be within {radiusM} m of the school.
                  </Caption>
                </View>
              </Row>
              <TouchableOpacity
                onPress={() => void locate()}
                disabled={locating}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 8,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.border.subtle,
                  backgroundColor: colors.surface.card,
                }}
              >
                {locating ? (
                  <LoaderCircle size={14} color={colors.text.secondary} />
                ) : (
                  <Navigation size={14} color={colors.text.secondary} />
                )}
                <Caption style={{ fontFamily: bodyFont("bold"), color: colors.text.secondary }}>
                  {reading ? "Refresh" : "Get location"}
                </Caption>
              </TouchableOpacity>
            </Row>

            {locError ? (
              <Caption style={{ color: colors.danger, marginTop: spacing.sm }}>{locError}</Caption>
            ) : !reading ? (
              <Caption style={{ marginTop: spacing.sm }}>Tap "Get location" to verify you're on the school premises.</Caption>
            ) : (
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                <Metric label="Distance" value={`${distanceM} m`} tone={inRange ? "good" : "bad"} />
                <Metric label="Accuracy" value={`±${Math.round(reading.accuracyM)} m`} tone={reading.accuracyM <= 50 ? "good" : reading.accuracyM <= 100 ? "warn" : "bad"} />
                <Metric
                  label="Status"
                  value={inRange ? (readingFresh ? "In range" : "Refresh") : "Outside"}
                  tone={inRange && readingFresh ? "good" : "warn"}
                />
              </View>
            )}

            {lastResult && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginTop: spacing.md,
                  padding: spacing.sm,
                  borderRadius: radius.sm,
                  backgroundColor: colors.status.successBg,
                }}
              >
                <CheckCircle2 size={14} color={colors.success} />
                <Caption style={{ color: colors.success, fontFamily: bodyFont("bold") }}>
                  {lastResult.action === "CHECK_IN" ? "Checked in" : "Checked out"} at{" "}
                  {new Date(lastResult.at).toLocaleTimeString()}
                  {lastResult.isLate ? ` · late +${lastResult.lateMinutes}m` : ""}
                  {lastResult.distanceM != null ? ` · ${lastResult.distanceM} m` : ""}
                </Caption>
              </View>
            )}

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <Button
                variant="primary"
                onPress={() => void clock("CHECK_IN")}
                disabled={clocking || !inRange || !readingFresh || today?.status === "IN"}
                leftIcon={clocking ? <LoaderCircle size={16} color={colors.brand.white} /> : <LogIn size={16} color={colors.brand.white} />}
                fullWidth
              >
                GPS Check in
              </Button>
              <Button
                variant="outline"
                onPress={() => void clock("CHECK_OUT")}
                disabled={clocking || !inRange || today?.status !== "IN"}
                leftIcon={<LogOut size={16} color={colors.text.primary} />}
                fullWidth
              >
                Check out
              </Button>
            </View>
          </Card>

          {/* Today's events */}
          {(today?.events?.length ?? 0) > 0 && (
            <Card variant="default" padding={spacing.md}>
              <Label style={{ marginBottom: spacing.sm }}>Today's GPS events</Label>
              <Column gap={spacing.xs}>
                {(today?.events ?? []).map((ev) => (
                  <View
                    key={ev.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: spacing.xs,
                    }}
                  >
                    <Row gap={spacing.xs}>
                      {ev.eventType === "CHECK_IN" ? (
                        <LogIn size={14} color={colors.success} />
                      ) : (
                        <LogOut size={14} color={colors.warning} />
                      )}
                      <Caption>
                        {ev.eventType.replace("_", " ")}
                        {typeof ev.distanceM === "number" ? ` · ${ev.distanceM} m` : ""}
                        {ev.isLate ? ` · late +${ev.lateMinutes}m` : ""}
                      </Caption>
                    </Row>
                    <Caption style={{ color: colors.text.muted }}>
                      {new Date(ev.at).toLocaleTimeString()}
                    </Caption>
                  </View>
                ))}
              </Column>
            </Card>
          )}
        </Column>
      )}
    </Screen>
  );
}

function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  const { radius } = useTheme();
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: bg }}>
      <Caption style={{ fontFamily: bodyFont("bold"), color: fg, fontSize: 10, letterSpacing: 1 }}>
        {label}
      </Caption>
    </View>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" | "warn" }) {
  const { colors, radius, spacing } = useTheme();
  const fg =
    tone === "good" ? colors.success : tone === "bad" ? colors.danger : colors.warning;
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.sm,
        borderRadius: radius.sm,
        backgroundColor: colors.surface.disabled,
      }}
    >
      <Caption style={{ fontSize: 9, letterSpacing: 1 }}>{label}</Caption>
      <Body style={{ fontFamily: bodyFont("bold"), color: fg, marginTop: 2 }}>{value}</Body>
    </View>
  );
}
