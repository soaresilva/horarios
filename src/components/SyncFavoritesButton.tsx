"use client";

import { useState } from "react";
import { SyncFavoritesPanel } from "@/components/SyncFavoritesPanel";
import type { RedeemResult } from "@/hooks/useFavoritesSync";

interface SyncFavoritesButtonProps {
  synced: boolean;
  generateCode: () => Promise<{ code: string; expiresAt: string } | { error: string }>;
  redeemCode: (code: string) => Promise<RedeemResult>;
}

// Entry point in the legend row (alongside RecommendationsToggle) for
// cross-device favorites sync. The actual generate/enter-code flow lives in
// SyncFavoritesPanel, opened as a small anchored popover.
export function SyncFavoritesButton({ synced, generateCode, redeemCode }: SyncFavoritesButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={synced ? "Manage cross-device favorites sync" : "Sync favorites across devices"}
        className={`flex items-center gap-1 ${synced ? "text-accent" : "text-zinc-500"}`}
      >
        <span aria-hidden>⇄</span>
        <span>{synced ? "synced" : "sync favorites"}</span>
      </button>
      {open && (
        <SyncFavoritesPanel
          synced={synced}
          generateCode={generateCode}
          redeemCode={redeemCode}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
