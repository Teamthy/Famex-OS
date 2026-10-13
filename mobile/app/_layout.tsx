import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useFonts } from "expo-font";
import { Anton_400Regular } from "@expo-google-fonts/anton";
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { getMe, type SessionUser } from "@/lib/api";
import { setAuthExpiredHandler } from "@/lib/http";
import { UpdateBanner } from "@/components/UpdateBanner";
import {
  addNotificationTapListener,
  configureNotifications,
  consumeInitialNotification,
  registerForPushNotifications,
} from "@/lib/notifications";
import { ThemeProvider } from "@/src/theme";
import { Colors } from "@/src/theme/colors";
import OfflineIndicator from "@/components/OfflineIndicator";
import { BiometricGate } from "@/components/BiometricGate";
import { ToastProvider } from "@/components/MobileToast";
import { SplashBrand } from "@/components/SplashBrand";

export default function RootLayout() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [fontsLoaded] = useFonts({
    Anton: Anton_400Regular,
    "DM Sans": DMSans_400Regular,
    "DM Sans Medium": DMSans_500Medium,
    "DM Sans Bold": DMSans_700Bold,
  });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    configureNotifications();
    setAuthExpiredHandler(() => router.replace("/login"));
    let cancelled = false;
    getMe()
      .then((res) => {
        if (!cancelled) setUser(res?.user ?? null);
        if (res?.user) void registerForPushNotifications();
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [router]);

  // Tapping a push notification should open the thing it is about.
  //
  // Two paths, and both are needed: the listener covers taps while the app is
  // running or backgrounded, and consumeInitialNotification covers a COLD
  // start, where the tap happened before any listener existed. Without the
  // second one, the most common real case — phone locked, notification
  // arrives, user taps it — silently does nothing.
  //
  // Waits for `user` so routing is role-correct and we never navigate into a
  // protected group before the session is known.
  useEffect(() => {
    if (!user) return;
    const go = (path: string) => router.push(path as never);
    void consumeInitialNotification(go, user.role);
    return addNotificationTapListener(go, user.role);
  }, [user, router]);

  // Hold the branded splash until BOTH the session has resolved and the brand
  // fonts are ready — otherwise the first paint flashes in a fallback font.
  if ((user === undefined && !timedOut) || !fontsLoaded) {
    return (
      <ThemeProvider>
        <SplashBrand />
      </ThemeProvider>
    );
  }

  const resolvedUser = user === undefined ? null : user;
  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background.primary },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="landing" redirect={!!resolvedUser} />
      <Stack.Screen name="login" redirect={!!resolvedUser} />
      <Stack.Screen name="onboarding" redirect={!!resolvedUser} />
      <Stack.Screen name="forgot-password" redirect={!!resolvedUser} />
      <Stack.Screen name="settings" />
      <Stack.Screen name="logout" />
      <Stack.Screen name="admin-student-detail" />
      <Stack.Screen name="admin-staff-detail" />
      <Stack.Screen name="admin-expenses" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="message-thread" />
      <Stack.Screen name="teacher-behavior" />
      <Stack.Screen name="(student)" />
      <Stack.Screen name="(teacher)" />
      <Stack.Screen name="(parent)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="exam-runner" />
      <Stack.Screen name="exam-results" />
      <Stack.Screen name="announcements" />
      <Stack.Screen name="news" />
      <Stack.Screen name="news-detail" />
      <Stack.Screen name="school-info" />
      <Stack.Screen name="staff-attendance" />
      <Stack.Screen name="pay" />
      <Stack.Screen name="teacher-announcements" />
      <Stack.Screen name="student-teachers" />
      <Stack.Screen name="id-card" />
      <Stack.Screen name="parent-events" />
      <Stack.Screen name="teacher-analytics" />
      <Stack.Screen name="practice" />
      <Stack.Screen name="practice-runner" />
      <Stack.Screen name="practice-progress" />
      <Stack.Screen name="admin-students" />
      <Stack.Screen name="admin-staff" />
      <Stack.Screen name="admin-finance" />
      <Stack.Screen name="admin-fees" />
      <Stack.Screen name="admin-admissions" />
      <Stack.Screen name="admin-reports" />
      <Stack.Screen name="admin-news" />
      <Stack.Screen name="admin-notifications" />
      <Stack.Screen name="admin-corrections" />
    </Stack>
  );

  return (
    <ThemeProvider>
      <ToastProvider>
        <View style={{ flex: 1, backgroundColor: Colors.background.primary }}>
          <StatusBar style="light" />
          {resolvedUser ? (
            <BiometricGate>
              {stack}
              {/* Sideloaded APKs have no store to nag a stale install, so the
                  app has to surface its own updates. */}
              <UpdateBanner />
              <OfflineIndicator />
            </BiometricGate>
          ) : (
            stack
          )}
        </View>
      </ToastProvider>
    </ThemeProvider>
  );
}
