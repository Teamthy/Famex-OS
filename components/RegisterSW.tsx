"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker on the client.
 *
 * Registered only in production builds and only on secure origins (https or
 * localhost) — service workers never install over plain http, and the dev
 * server's hashed assets churn too fast to cache usefully.
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    if (!window.isSecureContext) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failure is never fatal — the site works without it.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}

export default RegisterSW;
