"use client";

import { useEffect } from "react";
import { CrewBubbles } from "@/components/CrewBubbles";
import { Close } from "@/components/icons";
import type { MarkTier } from "@/hooks/useMarks";
import { tierWord, type FriendMark } from "@/lib/crew";
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
  /** Side programme, if this other set is in one (rendered as a short tag). */
  series?: string | null;
}

interface MarkSheetProps {
  artistName: string;
  startTime: Date;
  endTime: Date;
  stageName: string;
  /**
   * What the set is and who credits it ("Exhibition · U? · Curated by Fai
   * Aldhukair"), from contextLine in src/lib/programme.ts; null for a plain
   * main-programme concert.
   */
  context?: string | null;
  /** Tag after an "Also plays" entry that's in the side programme ("free daytime", "U?"). */
  sideTag?: string;
  tier: MarkTier | null;
  note: string;
  /** The act's other sets across the whole festival; empty for a single-show act. */
  otherShows: OtherShow[];
  /** Crewmates' marks on this set, strongest first; the section is hidden when empty. */
  crew?: FriendMark[];
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
  context = null,
  sideTag = "side programme",
  tier,
  note,
  otherShows,
  crew = [],
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
            {context && <p className="text-xs text-zinc-400">{context}</p>}
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
                    {show.series && ` (${sideTag})`}
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
            className={`flex-[2] rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              tier === "must" ? "bg-accent text-zinc-950" : "bg-zinc-800 text-zinc-200"
            }`}
          >
            {/* Same ★/text-accent treatment as the block's own glyph (see
                PerformanceBlock.tsx:37-40) — the button reads as "this is
                what that star on the grid means" rather than a plain label. */}
            <span className={tier === "must" ? "text-zinc-950" : "text-accent"}>★</span> Must-see
          </button>
          <button
            type="button"
            aria-pressed={tier === "interested"}
            onClick={() => onSetTier("interested")}
            className={`flex-[2] rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              tier === "interested" ? "bg-interested text-zinc-950" : "bg-zinc-800 text-zinc-200"
            }`}
          >
            <span className={tier === "interested" ? "text-zinc-950" : "text-interested"}>☆</span> Interested
          </button>
          {/* Smaller than the two tier buttons — clearing is the least
              common action here, so it doesn't need equal visual weight. */}
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
          placeholder={'Add note: "sounds like BCNR", "second choice if someone cancels"...'}
          onChange={(e) => onSetNote(e.target.value)}
          className="mb-3 h-20 w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 p-2 text-sm text-zinc-100 placeholder:text-zinc-600"
        />

        {/* The one place a friend's note is readable on a phone: blocks only
            have room for their tag bubble, and hover doesn't exist on touch. */}
        {crew.length > 0 && (
          <section aria-label="Crew" className="mb-3 border-t border-zinc-800 pt-2">
            <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">Crew</p>
            <ul className="flex flex-col gap-1.5">
              {crew.map((friend) => (
                <li key={friend.tag} className="flex items-start gap-2 text-xs">
                  <CrewBubbles friends={[friend]} />
                  <span className="w-16 shrink-0 text-zinc-400">{tierWord(friend.tier)}</span>
                  {friend.note && <span className="min-w-0 text-zinc-300 italic">{friend.note}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

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
