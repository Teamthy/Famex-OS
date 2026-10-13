import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "@/lib/api";

/**
 * Request notification permission, obtain the Expo push token, and register it
 * with the backend so the school can send alerts (results, fees, attendance).
 * No-ops on web / if permission is denied.
 * Requires: npx expo install expo-notifications
 */
export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenData?.data;
    if (!token) return;

    await api("/api/push/register", {
      method: "POST",
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
  } catch {
    /* non-fatal — push is a bonus, not a blocker */
  }
}

/**
 * Map a notification's deep-link (or kind) to an in-app route.
 *
 * The backend sends `data.link` — the web URL for the same alert — plus
 * `data.kind`. Web paths and mobile routes are not identical, so translate
 * rather than trusting the link blindly: an unmapped path would otherwise
 * push the user to a route that does not exist.
 */
export function routeForNotification(
  data: Record<string, unknown> | undefined,
  role?: string | null,
): string | null {
  if (!data) return null;

  const link = typeof data.link === "string" ? data.link : "";
  const kind = typeof data.kind === "string" ? data.kind : "";
  const isParent = (role || "").toUpperCase() === "PARENT";

  // The same alert kind lives at a different route per role — a fee reminder
  // goes to a parent, a report release is read by both. Routing a student to
  // /(parent)/fees would land them on a screen they cannot access.
  const feesRoute = isParent ? "/(parent)/fees" : null;
  const reportsRoute = isParent ? "/(parent)/report-cards" : "/(student)/report-cards";
  const attendanceRoute = isParent ? "/(parent)/attendance" : "/(student)/attendance";

  if (link.includes("/fees")) return feesRoute;
  if (link.includes("/report-cards")) return reportsRoute;
  if (link.includes("/attendance")) return attendanceRoute;
  if (link.includes("/exams")) return "/(student)/exams";
  if (link.includes("/announcements")) return "/announcements";

  switch (kind) {
    case "FEE_REMINDER":
      return feesRoute;
    case "REPORT_RELEASED":
      return reportsRoute;
    case "ATTENDANCE_ALERT":
      return attendanceRoute;
    case "BROADCAST":
    case "SYSTEM":
    case "ADMISSION_UPDATE":
      return "/announcements";
    default:
      return null;
  }
}

/**
 * Handle the user tapping a push notification.
 *
 * Without this a push was a dead end: it arrived, the user tapped it, the app
 * opened on whatever screen it was last on, and they had to go hunting for the
 * thing they were told about. Returns an unsubscribe function.
 */
export function addNotificationTapListener(
  navigate: (path: string) => void,
  role?: string | null,
) {
  if (Platform.OS === "web") return () => {};
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const route = routeForNotification(data, role);
      if (route) navigate(route);
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

/**
 * If the app was launched COLD by tapping a notification, the listener above
 * never fires — the event happened before it was registered. Check for it once
 * on startup.
 */
export async function consumeInitialNotification(
  navigate: (path: string) => void,
  role?: string | null,
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const last = await Notifications.getLastNotificationResponseAsync();
    if (!last) return;
    const data = last.notification.request.content.data as Record<string, unknown> | undefined;
    const route = routeForNotification(data, role);
    if (route) navigate(route);
  } catch {
    /* ignore */
  }
}

/** Configure how notifications appear while the app is open (foreground). */
export function configureNotifications(): void {
  if (Platform.OS === "web") return;
  try {
    Notifications.setNotificationHandler({
      // shouldShowAlert was split into shouldShowBanner + shouldShowList in
      // expo-notifications SDK 52+. The old shape type-errors and, worse,
      // foreground notifications silently do not appear.
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    /* ignore */
  }
}
