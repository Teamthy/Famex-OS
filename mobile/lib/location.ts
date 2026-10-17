/**
 * Native GPS location helper.
 *
 * Uses expo-location when available (installed via `npx expo install expo-location`);
 * throws a descriptive error if the module is missing, a permission is denied,
 * or the device cannot provide a fix.
 */

// Lazy-require so the bundle doesn't crash on older web builds that don't have expo-location.
let Location: typeof import("expo-location") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Location = require("expo-location");
} catch {
  Location = null;
}

export type NativeGpsReading = {
  latitude: number;
  longitude: number;
  accuracyM: number;
  altitudeM: number | null;
  capturedAt: number;
};

export async function ensureLocationPermissions(): Promise<boolean> {
  if (!Location) return false;
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  const req = await Location.requestForegroundPermissionsAsync();
  return req.granted;
}

export async function getCurrentLocation(): Promise<NativeGpsReading> {
  if (!Location) {
    throw new Error(
      "expo-location is not installed. Run `npx expo install expo-location` and rebuild the app.",
    );
  }
  const granted = await ensureLocationPermissions();
  if (!granted) {
    throw new Error("Location permission is denied. Enable it in your phone Settings.");
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Highest,
    timeInterval: 2_000,
  });
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracyM: pos.coords.accuracy ?? 100,
    altitudeM: pos.coords.altitude,
    capturedAt: pos.timestamp,
  };
}

/** Haversine distance (meters) — duplicated here so mobile doesn't pull the web lib/ tree. */
export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
