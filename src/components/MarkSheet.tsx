"use client";

import { useEffect } from "react";
import { Close } from "@/components/icons";
import type { MarkTier } from "@/hooks/useMarks";
import { NOTE_MAX_LENGTH } from "@/lib/marks";
import { formatClock, type FestivalTime } from "@/lib/time";

interface MarkSheetProps {
  artistName: string;
  startTime: Date;
  endTime: Date;
  stageName: string;
  tier: MarkTier | null;
  note: string;
  ft: FestivalTime;
  onSetTier: (tier: MarkTier | null) => void;
  onSetNote: (text: string) => void;
  onClose: () => void;
}

// The only per-show detail surface in the app: explicit tier buttons (a
// tri-state isn't a toggle, so it needs words, not just a tap-to-cycle
// gesture) plus a free-text note. Opened by a long-press on a block, or by
// tapping the ✎ indicator once a note exists.
export function MarkSheet({
  artistName,
  startTime,
  endTime,
  stageName,
  tier,
  note,
  ft,
  onSetTier,
  onSetNote,
  onClose,
}: MarkSheetProps) {
  // Dismisses on Escape as well as backdrop click and Done — unlike
  // SyncFavoritesPanel (see SyncFavoritesPanel.tsx:55-66), which has
  // neither, because that's an anchored popover with lower stakes than a
  // sheet a visitor might have typed a note into.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Mark ${artistName}`}
        className="relative z-10 w-full rounded-t-xl border border-zinc-700 bg-zinc-900 p-4 text-zinc-100 sm:max-w-sm sm:rounded-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{artistName}</p>
            <p className="text-xs text-zinc-400">
              {formatClock(startTime, ft)}–{formatClock(endTime, ft)} · {stageName}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <Close className="h-4 w-4 text-zinc-500" />
          </button>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            aria-pressed={tier === "must"}
            onClick={() => onSetTier("must")}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              tier === "must" ? "bg-accent text-zinc-950" : "bg-zinc-800 text-zinc-200"
            }`}
          >
            Must-see
          </button>
          <button
            type="button"
            aria-pressed={tier === "interested"}
            onClick={() => onSetTier("interested")}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              tier === "interested" ? "bg-interested text-zinc-950" : "bg-zinc-800 text-zinc-200"
            }`}
          >
            Interested
          </button>
          <button
            type="button"
            aria-pressed={tier === null}
            onClick={() => onSetTier(null)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              tier === null ? "bg-zinc-700 text-zinc-100" : "bg-zinc-800 text-zinc-200"
            }`}
          >
            Clear
          </button>
        </div>

        <textarea
          value={note}
          maxLength={NOTE_MAX_LENGTH}
          placeholder="Note — front left, get there early…"
          onChange={(e) => onSetNote(e.target.value)}
          className="mb-3 h-20 w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 p-2 text-sm text-zinc-100 placeholder:text-zinc-600"
        />

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-md bg-accent px-2 py-2 text-sm font-medium text-zinc-950"
        >
          Done
        </button>
      </div>
    </div>
  );
}
