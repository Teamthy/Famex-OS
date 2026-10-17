/**
 * Foreground arrival beacon for staff & students.
 *
 * While the app is open, watches the device location. When the user crosses
 * INTO the school geofence during the clock-in window (e.g. 6:30-9:30 AM)
 * AND hasn't clocked in yet, raises a local notification that deep-links
 * straight to the GPS clock-in screen.
 *
 * We use watchPositionAsync (available in stock expo-location, no custom
 * native code needed) rather than expo-task-manager's background geofence,
 * because background geofencing requires an EAS custom dev client and extra
 * Android permissions (ACCESS_BACKGROUND_LOCATION). Foreground detection
 * covers the common case — the student has the app open on the bus/walk in.
 *
 * Turned on by the Settings toggle; default ON because it's low-friction.
 */
import { Platform } from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { haversineM } from "@/lib/location";
import { staffMeApi, studentApi } from "@/lib/api";

const BEACON_PREF = "ykay_beacon_enabled";
async function getBeaconFlag(): Promise<boolean> {
  if (Platform.OS === "web") return true;
  try {
    const v = await SecureStore.getItemAsync(BEACON_PREF);
    return v !== "0";
  } catch {
    return true;
  }
}
async function setBeaconFlag(on: boolean): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.setItemAsync(BEACON_PREF, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const BEACON_PREF = "beacon_enabled";
/** How often we check, in ms. 30 s keeps battery impact tiny. */
const POLL_MS = 30_000;
/** Clock-in window: 6:00 AM – 10:00 AM local time. */
function inClockWindow(d = new Date()) {
  const h = d.getHours();
  return h >= 6 && h < 10;
}

type Listener = { remove: () => void };
let subscription: Location.LocationSubscription | null = null;
let lastArrivalNotify = 0;
const COOLDOWN_MS = 15 * 60 * 1000; // don't re-prompt within 15 min

export async function isBeaconEnabled(): Promise<boolean> {
  return getBeaconFlag();
}

export async function setBeaconEnabled(on: boolean): Promise<void> {
  await setBeaconFlag(on);
  if (on) void start();
  else stop();
}

export async function start(audience: "student" | "staff" = "student"): Promise<Listener | null> {
  if (Platform.OS === "web") return null;
  stop();

  const enabled = await isBeaconEnabled();
  if (!enabled) return null;

  const perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted) {
    const req = await Location.requestForegroundPermissionsAsync();
    if (!req.granted) return null;
  }

  // Fetch fence + today's status once to know the radius/current state.
  let fence: { center: { latitude: number; longitude: number }; radiusM: number } | null = null;
  let alreadyIn = false;
  try {
    const me: any =
      audience === "staff" ? await staffMeApi.attendance() : await studentApi.clock();
    if (me?.gps?.enabled && me.gps.center) {
      fence = { center: me.gps.center, radiusM: me.gps.radiusM ?? 100 };
      alreadyIn = me.today?.status === "IN";
    }
  } catch {
    return null;
  }
  if (!fence) return null;

  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: POLL_MS,
      distanceInterval: 15, // nudge every 15 m movement
    },
    (pos) => {
      const now = Date.now();
      const d = haversineM(
        { lat: pos.coords.latitude, lng: pos.coords.longitude },
        { lat: fence!.center.latitude, lng: fence!.center.longitude },
      );
      const inside = d <= fence!.radiusM;
      if (!inside) return;
      if (!inClockWindow()) return;
      if (alreadyIn) return;
      if (now - lastArrivalNotify < COOLDOWN_MS) return;
      lastArrivalNotify = now;

      Notifications.scheduleNotificationAsync({
        content: {
          title: "You're at school — clock in?",
          body: `You're ${Math.round(d)} m from the school entrance. Tap to clock in.`,
          data: { link: "/gps-clock", audience },
        },
        trigger: null, // fire immediately
      }).catch(() => {});
      // Avoid re-firing in the same session even if they ignore the notif.
      alreadyIn = true;
    },
  );

  return { remove: stop };
}

export function stop() {
  if (subscription) {
    try {
      subscription.remove();
    } catch {
      /* ignore */
    }
    subscription = null;
  }
}
