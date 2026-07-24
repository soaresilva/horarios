"use client";

import { useEffect } from "react";

// Registered only in production: intercepting fetches during `next dev`
// fights Turbopack's own HMR/websocket traffic and dev-only routes.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed", err);
    });
  }, []);

  return null;
}
