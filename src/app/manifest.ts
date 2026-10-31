import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Horários Bolachas",
    short_name: "Horários Bolachas",
    description: "Offline-friendly festival stage timetables.",
    // "/" redirects to the festival picked in /admin (see Home in
    // src/app/page.tsx), so switching editions never needs a code change.
    // Installed PWAs keep the start_url they were installed with: a home
    // screen icon made before this change must be removed and re-added.
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
