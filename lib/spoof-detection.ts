/**
 * Anti-spoof heuristics for GPS clock events.
 *
 * Two layers:
 *   1. Per-event flags: accuracy too low, or reading right on the fence edge
 *      (suggests a mocked location nudged just inside the radius).
 *   2. Cross-event impossible-travel: two clocks from the SAME person that are
 *      impossibly far apart given the elapsed time (e.g. 2 km in 30 seconds
 *      implies teleportation, which only happens if a fake-location app was
 *      used between clocks).
 *
 * These are conservative — we only flag; we don't auto-reject. An admin
 * reviews flagged events in the dashboard.
 */

import { haversineDistanceM } from "@/lib/geofence";

export const ACCURACY_SUSPICIOUS_THRESHOLD_M = 65;
export const EDGE_PROXIMITY_M = 5;
/** 200 km/h converted to m/s — a generous upper bound for any legitimate
 *  on-the-ground movement (car on a highway is ~33 m/s, we allow ~55 m/s). */
export const MAX_HUMAN_SPEED_M_S = 55;

export interface GeoReading {
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  at: Date;
}

export function flagReading(
  r: { latitude: number | null; longitude: number | null; accuracyM: number | null; distanceM?: number | null },
  fenceRadiusM?: number | null,
): { accuracySuspicious: boolean; edgeSuspicious: boolean } {
  const accuracySuspicious = r.accuracyM !== null && r.accuracyM > ACCURACY_SUSPICIOUS_THRESHOLD_M;
  const edgeSuspicious =
    typeof r.distanceM === "number" &&
    typeof fenceRadiusM === "number" &&
    fenceRadiusM > 0 &&
    r.accuracyM !== null &&
    r.accuracyM < 25 &&
    Math.abs(r.distanceM - fenceRadiusM) < EDGE_PROXIMITY_M;
  return { accuracySuspicious, edgeSuspicious };
}

/** Returns true if two consecutive readings are impossible for a human to make. */
export function isImpossibleTravel(a: GeoReading, b: GeoReading): boolean {
  if (
    a.latitude === null ||
    a.longitude === null ||
    b.latitude === null ||
    b.longitude === null
  ) {
    return false;
  }
  const dt = Math.abs(b.at.getTime() - a.at.getTime()) / 1000;
  if (dt < 5) return false; // same clock burst / duplicate
  const d = haversineDistanceM(
    { latitude: a.latitude, longitude: a.longitude },
    { latitude: b.latitude, longitude: b.longitude },
  );
  const mps = d / dt;
  return mps > MAX_HUMAN_SPEED_M_S;
}
