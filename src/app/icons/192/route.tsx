import { ImageResponse } from "next/og";
import { iconMark } from "@/lib/icon-mark";

export const contentType = "image/png";
export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(iconMark(192), { width: 192, height: 192 });
}
