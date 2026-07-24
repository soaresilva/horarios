import type { ReactElement } from "react";

/**
 * Shared visual for every generated app icon (favicon, apple-touch-icon,
 * manifest icons). No festival logo asset exists yet, so this is a simple
 * monogram placeholder — swap it out if/when official branding is available.
 * `padding` widens the margin for maskable icons, which OS icon masks crop
 * into a circle/rounded-square, so content must stay inside a safe zone.
 */
export function iconMark(size: number, padding = 0.08): ReactElement {
  const inset = Math.round(size * padding);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#09090b",
      }}
    >
      <div
        style={{
          width: size - inset * 2,
          height: size - inset * 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: size * 0.18,
          background: "#18181b",
          border: `${Math.max(1, Math.round(size * 0.02))}px solid #f59e0b`,
        }}
      >
        <span
          style={{
            fontSize: (size - inset * 2) * 0.42,
            fontWeight: 700,
            color: "#f59e0b",
            letterSpacing: -1,
          }}
        >
          PdC
        </span>
      </div>
    </div>
  );
}
