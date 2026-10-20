"use client";

import { useEffect, useState } from "react";
import { Close } from "@/components/icons";
import type { UseCrewResult } from "@/hooks/useCrew";
import { crewColor, crewErrorMessage, formatCrewCode } from "@/lib/crew";
import { formatClock, type FestivalTime } from "@/lib/time";
import type { CrewResult } from "@/types/crew";

interface CrewPanelProps {
  crew: UseCrewResult;
  festivalSlug: string;
  ft: FestivalTime;
  onClose: () => void;
}

// Anchored popover from CrewButton, same frame as SyncFavoritesPanel. Two
// states: not in a crew (pick a tag, then start one or join with a code)
// and in one (the code to share, who's in, your tag, note sharing, leave).
export function CrewPanel({ crew, festivalSlug, ft, onClose }: CrewPanelProps) {
  const [tag, setTag] = useState(crew.crew?.me.tag ?? "");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function run(action: () => Promise<CrewResult>, success?: string) {
    setBusy(true);
    setStatus(null);
    try {
      const result = await action();
      setStatus("error" in result ? crewErrorMessage(result.error, tag.trim()) : (success ?? null));
    } catch {
      setStatus("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const current = crew.crew;

  return (
    <div
      role="dialog"
      aria-label="Crew"
      // z-50 like SyncFavoritesPanel: must paint above the grid's sticky headers.
      className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs text-zinc-300 shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-zinc-200">Crew</span>
        <button type="button" onClick={onClose} aria-label="Close">
          <Close className="h-3.5 w-3.5 text-zinc-500" />
        </button>
      </div>

      {current ? (
        <InCrew crew={crew} festivalSlug={festivalSlug} ft={ft} tag={tag} setTag={setTag} busy={busy} run={run} setStatus={setStatus} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-zinc-500">See which sets your friends picked: their tag shows on every set they marked.</p>
          <label className="flex items-center gap-2">
            <span className="text-zinc-400">Your tag</span>
            <input
              type="text"
              value={tag}
              maxLength={2}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setTag(e.target.value)}
              placeholder="D"
              aria-label="Your tag"
              className="w-12 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-center text-base text-zinc-100"
            />
            <span className="text-[10px] text-zinc-600">1-2 letters</span>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => crew.create(tag))}
            className="rounded-md bg-accent px-2 py-1.5 font-medium text-zinc-950 disabled:opacity-50"
          >
            Start a crew
          </button>
          <p className="text-center text-[10px] text-zinc-600">or join one</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setCode(e.target.value)}
              placeholder="KX7-PQ2"
              aria-label="Crew code"
              className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-center text-base tracking-[0.15em] text-zinc-100 uppercase"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => crew.join(code, tag))}
              className="rounded-md bg-zinc-800 px-3 py-1.5 text-zinc-100 disabled:opacity-50"
            >
              Join
            </button>
          </div>
          <p className="text-[10px] text-zinc-600">
            Joining shares your must-see and interested marks, and your notes, with the crew. It also turns on sync.
          </p>
        </div>
      )}

      {status && (
        <p role="status" className="mt-2 text-amber-500">
          {status}
        </p>
      )}
    </div>
  );
}

function InCrew({
  crew,
  festivalSlug,
  ft,
  tag,
  setTag,
  busy,
  run,
  setStatus,
}: {
  crew: UseCrewResult;
  festivalSlug: string;
  ft: FestivalTime;
  tag: string;
  setTag: (tag: string) => void;
  busy: boolean;
  run: (action: () => Promise<CrewResult>, success?: string) => Promise<void>;
  setStatus: (status: string | null) => void;
}) {
  const current = crew.crew!;
  const shown = formatCrewCode(current.code);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(shown);
      setStatus("Code copied.");
    } catch {
      setStatus(`Copy failed: the code is ${shown}.`);
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: "Join my crew",
        text: `Join my crew on Horários Bolachas with code ${shown}`,
        url: `${window.location.origin}/${festivalSlug}`,
      });
    } catch {
      // Cancelled from the share sheet: nothing to report.
    }
  }

  async function leave() {
    if (!window.confirm("Leave this crew? Your friends stop seeing your picks, and you theirs.")) return;
    try {
      await crew.leave();
    } catch {
      setStatus("Couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span data-crew-code className="text-lg font-semibold tracking-[0.15em] text-zinc-100">
          {shown}
        </span>
        <div className="flex gap-1">
          <button type="button" onClick={copy} className="rounded-md bg-zinc-800 px-2 py-1 text-zinc-100">
            Copy
          </button>
          {canShare && (
            <button type="button" onClick={share} className="rounded-md bg-zinc-800 px-2 py-1 text-zinc-100">
              Share
            </button>
          )}
        </div>
      </div>

      <ul aria-label="Crew members" className="flex flex-wrap items-center gap-1.5 border-t border-zinc-800 pt-2">
        <li className="flex items-center gap-1">
          <TagChip tag={current.me.tag} colorIndex={current.me.colorIndex} />
          <span className="text-[10px] text-zinc-500">you</span>
        </li>
        {current.members.map((member) => (
          <li key={member.tag}>
            <TagChip tag={member.tag} colorIndex={member.colorIndex} />
          </li>
        ))}
      </ul>
      {current.members.length === 0 && (
        <p className="text-[10px] text-zinc-500">Nobody else yet. Send your friends the code.</p>
      )}

      <div className="flex items-center gap-2">
        <span className="text-zinc-400">Your tag</span>
        <input
          type="text"
          value={tag}
          maxLength={2}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setTag(e.target.value)}
          aria-label="Your tag"
          className="w-12 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-center text-base text-zinc-100"
        />
        <button
          type="button"
          disabled={busy || tag.trim() === current.me.tag}
          onClick={() => run(() => crew.update({ tag }), "Tag saved.")}
          className="rounded-md bg-zinc-800 px-2 py-1 text-zinc-100 disabled:opacity-40"
        >
          Save
        </button>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={current.me.shareNotes}
        disabled={busy}
        onClick={() => run(() => crew.update({ shareNotes: !current.me.shareNotes }))}
        className="flex items-center justify-between py-1"
      >
        <span className="text-zinc-400">Share my notes</span>
        <span
          aria-hidden
          className={`relative block h-3.5 w-6 shrink-0 rounded-full transition-colors ${current.me.shareNotes ? "bg-accent" : "bg-zinc-700"}`}
        >
          <span
            className={`absolute top-0.5 block h-2.5 w-2.5 rounded-full bg-white transition-all ${current.me.shareNotes ? "left-3" : "left-0.5"}`}
          />
        </span>
      </button>

      <p className="text-[10px] text-zinc-600">
        Friends see your must-see and interested marks{current.me.shareNotes ? " and your notes" : ""}.
        {crew.fetchedAt && ` Updated ${formatClock(new Date(crew.fetchedAt), ft)}.`}
      </p>

      <button type="button" onClick={leave} className="text-left text-zinc-500 underline decoration-dotted">
        Leave crew
      </button>
    </div>
  );
}

function TagChip({ tag, colorIndex }: { tag: string; colorIndex: number }) {
  return (
    <span
      style={{ backgroundColor: crewColor(colorIndex), color: "var(--background)" }}
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold"
    >
      {tag}
    </span>
  );
}
