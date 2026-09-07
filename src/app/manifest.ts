import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Horários Bolachas",
    short_name: "Horários Bolachas",
    description: "Offline-friendly festival stage timetables.",
    // Opens on the live edition rather than the archive index: whoever
    // installs this to a home screen is doing it to check set times at the
    // festival, and "/" would cost them a tap every time. Update this when
    // the next edition takes over.
    start_url: "/lotd26",
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
