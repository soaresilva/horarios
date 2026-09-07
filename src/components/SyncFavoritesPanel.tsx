"use client";

import { useState } from "react";
import { Close } from "@/components/icons";
import type { RedeemResult } from "@/hooks/useFavoritesSync";

interface SyncFavoritesPanelProps {
  synced: boolean;
  generateCode: () => Promise<{ code: string; expiresAt: string } | { error: string }>;
  redeemCode: (code: string) => Promise<RedeemResult>;
  onClose: () => void;
}

type Mode = "menu" | "generate" | "enter";

// Anchored popover opened from SyncFavoritesButton — deliberately not a
// full-screen modal, this is two buttons, a 6-digit code, and a text input.
export function SyncFavoritesPanel({ synced, generateCode, redeemCode, onClose }: SyncFavoritesPanelProps) {
  const [mode, setMode] = useState<Mode>("menu");
  const [code, setCode] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleGenerate() {
    setBusy(true);
    setStatus(null);
    const result = await generateCode();
    setBusy(false);
    if ("error" in result) {
      setStatus(result.error);
      return;
    }
    setCode(result.code);
    setMode("generate");
  }

  async function handleRedeem() {
    const trimmed = input.trim();
    if (trimmed.length !== 6) {
      setStatus("Enter the 6-digit code shown on your other device.");
      return;
    }
    setBusy(true);
    setStatus(null);
    const result = await redeemCode(trimmed);
    setBusy(false);
    if ("error" in result) {
      setStatus(result.error === "expired" ? "That code expired — generate a new one." : "That code isn't valid.");
      return;
    }
    setStatus("Synced! Your favorites now match your other device.");
  }

  return (
    <div
      role="dialog"
      aria-label="Sync favorites across devices"
      // z-50, well above StageGrid's sticky stage header (z-20) — this panel
      // sits in the legend row right above that header and must never end up
      // painted underneath it.
      className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs text-zinc-300 shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-zinc-200">Sync favorites</span>
        <button type="button" onClick={onClose} aria-label="Close">
          <Close className="h-3.5 w-3.5 text-zinc-500" />
        </button>
      </div>

      {mode === "menu" && (
        <div className="flex flex-col gap-2">
          <p className="text-zinc-500">
            {synced
              ? "This device is synced. Pair another device with a code:"
              : "Keep your starred shows the same on another phone."}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={handleGenerate}
            className="rounded-md bg-zinc-800 px-2 py-1.5 text-left text-zinc-100 disabled:opacity-50"
          >
            Show a code for this device
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode("enter")}
            className="rounded-md bg-zinc-800 px-2 py-1.5 text-left text-zinc-100 disabled:opacity-50"
          >
            Enter a code from another device
          </button>
        </div>
      )}

      {mode === "generate" && code && (
        <div className="flex flex-col gap-2">
          <p className="text-zinc-500">Enter this code on your other device within 10 minutes:</p>
          <p className="text-center text-xl font-semibold tracking-[0.3em] text-zinc-100">{code}</p>
          <button
            type="button"
            onClick={() => setMode("menu")}
            className="text-left text-zinc-500 underline decoration-dotted"
          >
            Back
          </button>
        </div>
      )}

      {mode === "enter" && (
        <div className="flex flex-col gap-2">
          <p className="text-zinc-500">Enter the code shown on your other device:</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-center text-base tracking-[0.3em] text-zinc-100"
          />
          <button
            type="button"
            disabled={busy}
            onClick={handleRedeem}
            className="rounded-md bg-accent px-2 py-1.5 font-medium text-zinc-950 disabled:opacity-50"
          >
            Sync
          </button>
          <button
            type="button"
            onClick={() => setMode("menu")}
            className="text-left text-zinc-500 underline decoration-dotted"
          >
            Back
          </button>
        </div>
      )}

      {status && <p className="mt-2 text-amber-500">{status}</p>}
    </div>
  );
}
