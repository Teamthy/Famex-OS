"use client";

/**
 * Shared hook for grabbing the browser's current location once the user
 * clicks the clock-in button. Also reports live distance to the school
 * geofence so UI can reflect "in range" vs "too far".
 */

import { useCallback, useEffect, useState } from "react";
import { haversineDistanceM } from "@/lib/geofence";

export type GpsReading = {
  latitude: number;
  longitude: number;
  accuracyM: number;
  capturedAt: number;
};

export type GpsState = {
  supported: boolean;
  permissionState: PermissionState | "unknown";
  reading: GpsReading | null;
  acquiring: boolean;
  error: string | null;
  /** Meters from school center; Infinity if we don't have both a reading and a fence. */
  distanceM: number;
};

export type Fence = {
  enabled: boolean;
  center?: { latitude: number; longitude: number };
  radiusM?: number;
};

const HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 30_000,
};

export function useGps(fence: Fence | null | undefined) {
  const [state, setState] = useState<GpsState>(() => ({
    supported: typeof navigator !== "undefined" && "geolocation" in navigator,
    permissionState: "unknown",
    reading: null,
    acquiring: false,
    error: null,
    distanceM: Number.POSITIVE_INFINITY,
  }));

  // Initial query of the geolocation permission (where supported)
  useEffect(() => {
    let active = true;
    async function queryPerm() {
      if (typeof navigator === "undefined") return;
      const perms = (
        navigator as Navigator & {
          permissions?: { query: (_p: { name: PermissionName }) => Promise<PermissionStatus> };
        }
      ).permissions;
      if (!perms?.query) return;
      try {
        const status = await perms.query({ name: "geolocation" as PermissionName });
        if (!active) return;
        setState((s) => ({ ...s, permissionState: status.state }));
        const onChange = () => {
          if (active) setState((s) => ({ ...s, permissionState: status.state }));
        };
        status.addEventListener("change", onChange);
        return () => status.removeEventListener("change", onChange);
      } catch {
        /* Safari: permissions.query('geolocation') sometimes throws. Ignore. */
      }
    }
    void queryPerm();
    return () => {
      active = false;
    };
  }, []);

  const getPosition = useCallback(() => {
    return new Promise<GpsReading>((resolve, reject) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        reject(new Error("Geolocation is not supported in this browser."));
        return;
      }
      setState((s) => ({ ...s, acquiring: true, error: null }));
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const reading: GpsReading = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyM: pos.coords.accuracy,
            capturedAt: pos.timestamp,
          };
          setState((s) => ({ ...s, acquiring: false, reading, permissionState: "granted" }));
          resolve(reading);
        },
        (err) => {
          let msg = "Unable to get your location.";
          if (err.code === err.PERMISSION_DENIED)
            msg = "Location permission is denied. Enable it in your browser/site settings.";
          else if (err.code === err.POSITION_UNAVAILABLE)
            msg = "Location is unavailable right now. Try moving outside and try again.";
          else if (err.code === err.TIMEOUT) msg = "Location timed out. Please try again.";
          setState((s) => ({ ...s, acquiring: false, error: msg }));
          reject(new Error(msg));
        },
        HIGH_ACCURACY_OPTIONS,
      );
    });
  }, []);

  // Continuously compute distance to the fence center when both are known
  useEffect(() => {
    if (!state.reading || !fence?.enabled || !fence.center?.latitude || !fence.center?.longitude) {
      setState((s) =>
        s.distanceM === Number.POSITIVE_INFINITY
          ? s
          : { ...s, distanceM: Number.POSITIVE_INFINITY },
      );
      return;
    }
    const d = Math.round(
      haversineDistanceM(state.reading, {
        latitude: fence.center.latitude,
        longitude: fence.center.longitude,
      }),
    );
    setState((s) => ({ ...s, distanceM: d }));
  }, [state.reading, fence]);

  return { ...state, getPosition };
}
