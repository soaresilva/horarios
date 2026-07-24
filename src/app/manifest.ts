import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Horários Bolachas",
    short_name: "Horários Bolachas",
    description: "Offline-friendly stage timetable for Vodafone Paredes de Coura 2026.",
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
