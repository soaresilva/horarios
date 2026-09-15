"use client";

import { useEffect } from "react";
import { Close } from "@/components/icons";
import type { MarkTier } from "@/hooks/useMarks";
import { NOTE_MAX_LENGTH } from "@/lib/marks";
import { formatClock, formatDayTabLabel, type FestivalTime } from "@/lib/time";

/** One other set by the same act, already resolved to its venue name. */
export interface OtherShow {
  id: string;
  /** Festival-day label (YYYY-MM-DD) — the weekday comes from this, not from
   * startTime, so a 00:20 set reads as the evening it belongs to rather than
   * the calendar day it technically starts on. */
  date: string;
  startTime: Date;
  stageName: string;
}

interface MarkSheetProps {
  artistName: string;
  startTime: Date;
  endTime: Date;
  stageName: string;
  tier: MarkTier | null;
  note: string;
  /** The act's other sets across the whole festival; empty for a single-show act. */
  otherShows: OtherShow[];
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
  otherShows,
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
            {/* Showcase festivals book most acts more than once (see
                showOrdinals in src/lib/shows.ts), so the real question when
                a set clashes is "when else can I catch them" — answered here
                rather than making the visitor go hunting the other days.
                Italic and dimmer to read as an aside to the line above, not
                as a second set of times for this slot. */}
            {otherShows.length > 0 && (
              <p className="mt-0.5 text-xs italic text-zinc-500">
                Also plays:{" "}
                {otherShows.map((show, i) => (
                  <span key={show.id}>
                    {i > 0 && "; "}
                    {formatDayTabLabel(new Date(`${show.date}T12:00:00Z`), ft).weekday}, {formatClock(show.startTime, ft)} at{" "}
                    {show.stageName}
                  </span>
                ))}
              </p>
            )}
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
