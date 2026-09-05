import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Horários Bolachas",
  description: "Archive of offline-friendly festival stage timetables by Bolachas.",
  appleWebApp: {
    title: "Horários Bolachas",
    statusBarStyle: "black-translucent",
    capable: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <RegisterServiceWorker />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
