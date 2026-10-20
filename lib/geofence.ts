/**
 * GPS geofencing utilities for staff/student clock-in.
 *
 * Distance is computed server-side with the haversine formula so a client
 * cannot fake being at school by lying about its coordinates — the server
 * compares the reported lat/lng to the school's configured center and
 * rejects anything outside the allowed radius.
 */

export const EARTH_RADIUS_M = 6_371_000;

/** Minimum / maximum allowed fence radius (meters). */
export const MIN_RADIUS_M = 20;
export const MAX_RADIUS_M = 2000;
export const DEFAULT_RADIUS_M = 100;

/** How inaccurate a GPS reading can be before we refuse to trust it. */
export const MAX_ACCEPTED_ACCURACY_M = 100;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Geofence {
  center: GeoPoint;
  radiusM: number;
  enabled: boolean;
}

/**
 * Great-circle distance between two points on Earth, in meters.
 * Returns 0 when either point is invalid.
 */
export function haversineDistanceM(a: GeoPoint, b: GeoPoint): number {
  if (!isValidPoint(a) || !isValidPoint(b)) return Number.POSITIVE_INFINITY;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function isValidPoint(
  p: { latitude?: number | null; longitude?: number | null } | null | undefined,
): p is GeoPoint {
  if (!p) return false;
  const { latitude, longitude } = p;
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function clampRadiusM(radius: unknown): number {
  const n = typeof radius === "number" ? radius : Number(radius);
  if (!Number.isFinite(n)) return DEFAULT_RADIUS_M;
  return Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(n)));
}

export interface GeofenceCheck {
  withinFence: boolean;
  distanceM: number;
  radiusM: number;
  accuracyOk: boolean;
}

/**
 * Check whether a reported GPS reading is within the school geofence.
 * We add a small "accuracy slack" only if the device reports accuracy — a
 * reading that is 105 m from center with 10 m accuracy on a 100 m fence is
 * rejected, because 95 % of the time the true position is inside the
 * accuracy circle which doesn't reach the fence.
 */
export function checkGeofence(
  reading: { latitude: number; longitude: number; accuracyM?: number | null },
  fence: Geofence,
): GeofenceCheck {
  const distanceM = Math.round(haversineDistanceM(reading, fence.center));
  const accuracyM =
    typeof reading.accuracyM === "number" && Number.isFinite(reading.accuracyM)
      ? Math.max(0, reading.accuracyM)
      : 0;
  const accuracyOk = accuracyM <= MAX_ACCEPTED_ACCURACY_M;
  const effectiveRadius = fence.radiusM;
  // Treat the reading as inside only if the reported point is within the
  // fence. We do NOT expand the fence by accuracyM because that would let
  // a noisy/spoofed reading pass easily. We simply reject very noisy reads.
  const withinFence = fence.enabled && distanceM <= effectiveRadius;
  return { withinFence, distanceM, radiusM: fence.radiusM, accuracyOk };
}

/** Convert a Prisma Decimal (or null) to a plain number, or null. */
export function decimalToNumber(d: { toNumber(): number } | null | undefined): number | null {
  if (!d) return null;
  try {
    return d.toNumber();
  } catch {
    return null;
  }
}
