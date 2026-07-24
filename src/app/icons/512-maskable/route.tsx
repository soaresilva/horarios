import { ImageResponse } from "next/og";
import { iconMark } from "@/lib/icon-mark";

export const contentType = "image/png";
export const dynamic = "force-static";

// Wider padding (20%) so the mark stays inside the safe zone once OS icon
// masks crop this into a circle or rounded square.
export function GET() {
  return new ImageResponse(iconMark(512, 0.2), { width: 512, height: 512 });
}
