import { useEffect, useState } from "react";
import { View, ScrollView, Switch, TouchableOpacity, Linking, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { getPrefs, setPref, type PrefKey } from "@/lib/prefs";
import { notificationPrefsApi, type NotificationPrefs } from "@/lib/api";
import { updateInfo } from "@/lib/updates";
import { biometricAvailable } from "@/lib/biometric";
import { haptic } from "@/lib/haptics";
import { clearOfflineData } from "@/lib/offline/db";
import { useSession } from "@/lib/useSession";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H2, Body, Caption, Label } from "@/src/components/typography";
import { Button } from "@/src/components/buttons";
import { Divider } from "@/src/components/layout";
import { Avatar } from "@/src/components/avatar";
import { Badge } from "@/src/components/badges";
import {
  ArrowLeft,
  Fingerprint,
  Megaphone,
  CalendarCheck,
  Wallet,
  GraduationCap,
  LifeBuoy,
  Mail,
  Phone,
  Shield,
  LogOut,
  ChevronRight,
  Eye,
  KeyRound,
  IdCard,
  Users,
  ClipboardCheck,
  BarChart3,
  MessageSquare,
  Trash2,
} from "lucide-react-native";

const SCHOOL_EMAIL = "info@ykaycollege.com";
const SCHOOL_PHONE = "+2347015374411";

/**
 * Notification toggles are SERVER state — the dispatcher reads them when
 * deciding whether to push. The device copy (expo-secure-store) is only a
 * cache so the switches render instantly instead of flickering on open.
 */
const NOTIFY_KEY_TO_CATEGORY: Partial<Record<PrefKey, keyof NotificationPrefs>> = {
  notifyAnnouncements: "announcements",
  notifyAttendance: "attendance",
  notifyFees: "fees",
  notifyResults: "results",
};

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();
  const { user, portal, roleLabel } = useSession();
  const build = updateInfo();

  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [bioSupported, setBioSupported] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const keys: PrefKey[] = [
        "biometricLock",
        "notifyAnnouncements",
        "notifyAttendance",
        "notifyFees",
        "notifyResults",
        "hideAdminOutstanding",
      ];
      const [values, bio] = await Promise.all([getPrefs(keys), biometricAvailable()]);
      if (cancelled) return;
      setPrefs(values);
      setBioSupported(bio);
      setLoaded(true);

      // Then reconcile the notification toggles with the server, which is the
      // copy that actually governs delivery. A device that has been offline
      // could otherwise show "Fees: off" while the server happily pushes.
      try {
        const { prefs: server } = await notificationPrefsApi.get();
        if (cancelled) return;
        setPrefs((p) => ({
          ...p,
          notifyAnnouncements: server.announcements,
          notifyAttendance: server.attendance,
          notifyFees: server.fees,
          notifyResults: server.results,
        }));
        // Refresh the local cache so the next cold start renders correctly.
        await Promise.all([
          setPref("notifyAnnouncements", server.announcements),
          setPref("notifyAttendance", server.attendance),
          setPref("notifyFees", server.fees),
          setPref("notifyResults", server.results),
        ]);
      } catch {
        // Offline or signed out — keep the cached values rather than blanking
        // the switches. They will reconcile on the next successful load.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(key: PrefKey, value: boolean) {
    const previous = !!prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));
    await setPref(key, value);
    haptic("light");

    // Notification categories must reach the server or they do nothing at all.
    const category = NOTIFY_KEY_TO_CATEGORY[key];
    if (!category) return;
    try {
      await notificationPrefsApi.update({ [category]: value });
    } catch {
      // Roll the switch back rather than leaving the user believing they have
      // muted something they have not. A silent failure here recreates exactly
      // the bug this replaced.
      setPrefs((p) => ({ ...p, [key]: previous }));
      await setPref(key, previous);
      haptic("error");
    }
  }

  function confirmClearData() {
    Alert.alert(
      "Clear offline data?",
      "This removes saved screens, pending offline actions, and your practice history & streak from this device. You will stay signed in.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await clearOfflineData();
              haptic("success");
            } catch {
              haptic("error");
            }
          },
        },
      ],
    );
  }

  /**
   * Notification categories differ by portal — a teacher has no fee balance,
   * and a student cannot act on an admissions alert. Showing every category to
   * everyone was noise, and toggling one that never fires is worse than not
   * offering it.
   */
  const notifyRows: { key: PrefKey; icon: React.ReactNode; title: string; subtitle: string }[] = [
    {
      key: "notifyAnnouncements",
      icon: <Megaphone size={18} color={colors.brand.greenLight} />,
      title: "Announcements",
      subtitle: "School news and notices",
    },
  ];

  if (portal === "student" || portal === "parent" || portal === "teacher") {
    notifyRows.push({
      key: "notifyAttendance",
      icon: <CalendarCheck size={18} color={colors.brand.greenLight} />,
      title: "Attendance",
      subtitle: portal === "teacher" ? "Register reminders" : "Daily attendance updates",
    });
  }
  if (portal === "parent" || portal === "admin") {
    notifyRows.push({
      key: "notifyFees",
      icon: <Wallet size={18} color={colors.brand.greenLight} />,
      title: "Fees",
      subtitle: portal === "admin" ? "Collections and arrears" : "Invoices and receipts",
    });
  }
  if (portal === "student" || portal === "parent" || portal === "teacher") {
    notifyRows.push({
      key: "notifyResults",
      icon: <GraduationCap size={18} color={colors.brand.greenLight} />,
      title: "Results",
      subtitle: portal === "teacher" ? "Gradebook deadlines" : "Report cards and scores",
    });
  }

  const portalLabel =
    portal === "student"
      ? "Student portal"
      : portal === "teacher"
        ? "Teacher portal"
        : portal === "parent"
          ? "Parent portal"
          : portal === "admin"
            ? "Admin portal"
            : portal === "it"
              ? "IT portal"
              : "Portal";

  const profileHref =
    portal === "teacher"
      ? "/(teacher)/profile"
      : portal === "parent"
        ? "/(parent)/profile"
        : portal === "admin"
          ? "/(admin)/profile"
          : "/(student)/profile";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background.primary }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: 60, paddingBottom: 48 }}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md }}
      >
        <ArrowLeft size={20} color={colors.text.muted} />
        <Caption>Back</Caption>
      </TouchableOpacity>

      <H2 style={{ marginBottom: spacing.lg }}>Settings</H2>

      {/* ── Who you are ── */}
      <Card
        variant="default"
        padding={spacing.md}
        onPress={() => router.push(profileHref as never)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          marginBottom: spacing.xl,
        }}
      >
        <Avatar name={user?.name} size="lg" />
        <View style={{ flex: 1 }}>
          <Body
            tone="primary"
            style={{ fontFamily: "DM Sans Bold", fontSize: 16 }}
            numberOfLines={1}
          >
            {user?.name || "—"}
          </Body>
          <Caption numberOfLines={1}>{user?.email || ""}</Caption>
          <View style={{ flexDirection: "row", marginTop: 6 }}>
            <Badge tone="accent">{roleLabel || portalLabel}</Badge>
          </View>
        </View>
        <ChevronRight size={18} color={colors.text.muted} />
      </Card>

      {/* ── Security ── */}
      <Label style={{ marginBottom: spacing.sm }}>Security</Label>
      <Card variant="default" padding={0} style={{ marginBottom: spacing.xl }}>
        <SettingToggle
          icon={<Fingerprint size={18} color={colors.brand.greenLight} />}
          title="Biometric unlock"
          subtitle={
            bioSupported
              ? "Require Face ID or fingerprint on launch"
              : "Not available on this device"
          }
          value={!!prefs.biometricLock && bioSupported}
          disabled={!bioSupported || !loaded}
          onChange={(v) => toggle("biometricLock", v)}
        />
        <Divider />
        <SettingLink
          icon={<KeyRound size={18} color={colors.brand.greenLight} />}
          title="Change password"
          onPress={() => router.push("/forgot-password")}
        />
        <Divider />
        <SettingLink
          icon={<Shield size={18} color={colors.brand.greenLight} />}
          title="Privacy policy"
          onPress={() => Linking.openURL("https://ykaycollege.edu.ng/privacy-policy")}
        />
      </Card>

      {/* ── Notifications (portal-specific) ── */}
      <Label style={{ marginBottom: spacing.sm }}>Notifications</Label>
      <Card variant="default" padding={0} style={{ marginBottom: spacing.xl }}>
        {notifyRows.map((row, i) => (
          <View key={row.key}>
            {i > 0 ? <Divider /> : null}
            <SettingToggle
              icon={row.icon}
              title={row.title}
              subtitle={row.subtitle}
              value={!!prefs[row.key]}
              disabled={!loaded}
              onChange={(v) => toggle(row.key, v)}
            />
          </View>
        ))}
      </Card>

      {/* ── Portal-specific shortcuts ── */}
      <Label style={{ marginBottom: spacing.sm }}>{portalLabel}</Label>
      <Card variant="default" padding={0} style={{ marginBottom: spacing.xl }}>
        {portal === "student" ? (
          <>
            <SettingLink
              icon={<IdCard size={18} color={colors.brand.greenLight} />}
              title="My ID card"
              subtitle="Digital student identity"
              onPress={() => router.push("/id-card")}
            />
            <Divider />
            <SettingLink
              icon={<Users size={18} color={colors.brand.greenLight} />}
              title="My teachers"
              onPress={() => router.push("/student-teachers")}
            />
          </>
        ) : null}

        {portal === "parent" ? (
          <>
            <SettingLink
              icon={<Wallet size={18} color={colors.brand.greenLight} />}
              title="Fees & payments"
              subtitle="Invoices and receipts"
              onPress={() => router.push("/(parent)/fees")}
            />
            <Divider />
            <SettingLink
              icon={<Megaphone size={18} color={colors.brand.greenLight} />}
              title="School events"
              onPress={() => router.push("/parent-events")}
            />
            <Divider />
            <SettingLink
              icon={<MessageSquare size={18} color={colors.brand.greenLight} />}
              title="Messages"
              subtitle="Talk to your child's teacher"
              onPress={() => router.push("/messages")}
            />
          </>
        ) : null}

        {portal === "teacher" ? (
          <>
            <SettingLink
              icon={<ClipboardCheck size={18} color={colors.brand.greenLight} />}
              title="Attendance register"
              onPress={() => router.push("/(teacher)/attendance")}
            />
            <Divider />
            <SettingLink
              icon={<BarChart3 size={18} color={colors.brand.greenLight} />}
              title="Class analytics"
              onPress={() => router.push("/teacher-analytics")}
            />
            <Divider />
            <SettingLink
              icon={<MessageSquare size={18} color={colors.brand.greenLight} />}
              title="Messages"
              subtitle="Talk to parents"
              onPress={() => router.push("/messages")}
            />
          </>
        ) : null}

        {portal === "admin" ? (
          <>
            <SettingToggle
              icon={<Eye size={18} color={colors.brand.greenLight} />}
              title="Show outstanding fees card"
              subtitle="Restore the dismissed dashboard card"
              value={!prefs.hideAdminOutstanding}
              disabled={!loaded}
              onChange={(v) => toggle("hideAdminOutstanding", !v)}
            />
            <Divider />
            <SettingLink
              icon={<Users size={18} color={colors.brand.greenLight} />}
              title="Students & staff"
              onPress={() => router.push("/admin-students")}
            />
          </>
        ) : null}
      </Card>

      {/* ── Data & storage ── */}
      <Label style={{ marginBottom: spacing.sm }}>Data &amp; storage</Label>
      <Card variant="default" padding={0} style={{ marginBottom: spacing.xl }}>
        <SettingLink
          icon={<Trash2 size={18} color={colors.danger} />}
          title="Clear offline data"
          subtitle="Cached screens, pending actions & practice history"
          onPress={confirmClearData}
        />
      </Card>

      {/* ── Support ── */}
      <Label style={{ marginBottom: spacing.sm }}>Help &amp; support</Label>
      <Card variant="default" padding={0} style={{ marginBottom: spacing.xl }}>
        <SettingLink
          icon={<Mail size={18} color={colors.brand.greenLight} />}
          title="Email the school"
          subtitle={SCHOOL_EMAIL}
          onPress={() => Linking.openURL(`mailto:${SCHOOL_EMAIL}`)}
        />
        <Divider />
        <SettingLink
          icon={<Phone size={18} color={colors.brand.greenLight} />}
          title="Call the school"
          subtitle={SCHOOL_PHONE}
          onPress={() => Linking.openURL(`tel:${SCHOOL_PHONE.replace(/\s/g, "")}`)}
        />
        <Divider />
        <SettingLink
          icon={<LifeBuoy size={18} color={colors.brand.greenLight} />}
          title="Help centre"
          onPress={() => Linking.openURL("https://ykaycollege.edu.ng/faq")}
        />
      </Card>

      <Button
        variant="ghost"
        fullWidth
        leftIcon={<LogOut size={18} color={colors.danger} />}
        onPress={() => router.push("/logout")}
        style={{ backgroundColor: colors.status.errorBg }}
      >
        <Body tone="primary" style={{ color: colors.danger }}>
          Sign Out
        </Body>
      </Button>

      <View style={{ alignItems: "center", marginTop: spacing.xl }}>
        <Caption style={{ fontSize: 11 }}>Ykay College &amp; Leadership Academy</Caption>
        {/* Read from expo-updates, not hardcoded.
            With a sideloaded APK there is no store listing to check, so this
            is the only way support can tell which build a parent is running —
            and whether they have picked up an OTA fix at all. */}
        <Caption style={{ fontSize: 11, marginTop: 2 }}>
          Version {build.runtimeVersion} · {Platform.OS === "ios" ? "iOS" : "Android"}
        </Caption>
        <Caption style={{ fontSize: 10, marginTop: 2, opacity: 0.6 }}>
          {build.isEmbedded
            ? "Base build (no updates applied yet)"
            : `Update ${build.updateId?.slice(0, 8) ?? "unknown"}`}
          {build.channel ? ` · ${build.channel}` : ""}
        </Caption>
      </View>
    </ScrollView>
  );
}

function SettingToggle({
  icon,
  title,
  subtitle,
  value,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm + 2,
        padding: spacing.md,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Body tone="primary" style={{ fontFamily: "DM Sans Medium", fontSize: 15 }}>
          {title}
        </Body>
        {subtitle ? <Caption style={{ marginTop: 1 }}>{subtitle}</Caption> : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.surface.cardHover, true: colors.brand.green }}
        thumbColor={colors.brand.white}
      />
    </View>
  );
}

function SettingLink({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  const { colors, spacing } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm + 2,
        padding: spacing.md,
      }}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Body tone="primary" style={{ fontFamily: "DM Sans Medium", fontSize: 15 }}>
          {title}
        </Body>
        {subtitle ? <Caption style={{ marginTop: 1 }}>{subtitle}</Caption> : null}
      </View>
      <ChevronRight size={18} color={colors.text.muted} />
    </TouchableOpacity>
  );
}
