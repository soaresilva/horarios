"use client";

import { useEffect, useState } from "react";
import { Close } from "@/components/icons";
import type { UseCrewResult } from "@/hooks/useCrew";
import { CREW_MAX_PER_VISITOR, CREW_NAME_MAX_LENGTH, crewColor, crewErrorMessage, formatCrewCode } from "@/lib/crew";
import { formatClock, type FestivalTime } from "@/lib/time";
import type { CrewDTO, CrewResult } from "@/types/crew";

interface CrewPanelProps {
  crew: UseCrewResult;
  festivalSlug: string;
  ft: FestivalTime;
  onClose: () => void;
}

const OFFLINE_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

// Scroll inside the room actually left below the panel. It hangs off the
// legend row, which sits lower when the install banner and help text are
// showing, and the page itself doesn't scroll, so anything past the bottom
// of the screen would be out of reach. No fixed max height can know that.
function fitToViewport(el: HTMLDivElement | null) {
  if (el) el.style.maxHeight = `${Math.max(240, window.innerHeight - el.getBoundingClientRect().top - 12)}px`;
}

// Anchored popover from CrewButton, same frame as SyncFavoritesPanel. Your
// crews as an accordion, one open at a time since a crew of 15 with its
// settings is most of a phone screen, then a way to start or join another.
// With no crews yet, it's only that form.
export function CrewPanel({ crew, festivalSlug, ft, onClose }: CrewPanelProps) {
  const { crews } = crew;
  // null follows the default: your first crew stays open until you pick another.
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // A leave can take the open crew with it, so this checks it still exists.
  const openCrew = crews.find((c) => c.id === openId) ?? crews[0] ?? null;
  const showForm = crews.length === 0 || adding;

  async function run(action: () => Promise<CrewResult>, tag?: string, success?: string): Promise<CrewResult | null> {
    setBusy(true);
    setStatus(null);
    try {
      const result = await action();
      setStatus("error" in result ? crewErrorMessage(result.error, tag) : (success ?? null));
      return result;
    } catch {
      setStatus(OFFLINE_MESSAGE);
      return null;
    } finally {
      setBusy(false);
    }
  }

  // Lands on the crew you just started or joined: it's the last one, and the
  // code to share is the next thing you need from it.
  async function addCrew(action: () => Promise<CrewResult>, tag: string) {
    const result = await run(action, tag);
    if (result && "crews" in result) {
      setAdding(false);
      setOpenId(result.crews.crews.at(-1)?.id ?? null);
    }
  }

  return (
    <div
      ref={fitToViewport}
      role="dialog"
      aria-label="Crews"
      // z-50 like SyncFavoritesPanel: must paint above the grid's sticky headers.
      className="absolute left-0 top-full z-50 mt-2 w-64 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs text-zinc-300 shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-zinc-200">{crews.length > 1 ? "Crews" : "Crew"}</span>
        <button type="button" onClick={onClose} aria-label="Close">
          <Close className="h-3.5 w-3.5 text-zinc-500" />
        </button>
      </div>

      {!showForm && (
        <div className="flex flex-col gap-1.5">
          {crews.map((c) => (
            <CrewSection
              key={c.id}
              crew={crew}
              current={c}
              open={c.id === openCrew?.id}
              onOpen={() => {
                setOpenId(c.id);
                setStatus(null);
              }}
              festivalSlug={festivalSlug}
              ft={ft}
              busy={busy}
              run={run}
              setStatus={setStatus}
            />
          ))}
          {crews.length < CREW_MAX_PER_VISITOR ? (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setStatus(null);
              }}
              className="border-t border-zinc-800 pt-2 text-left text-zinc-400"
            >
              + Start or join another
            </button>
          ) : (
            <p className="border-t border-zinc-800 pt-2 text-[10px] text-zinc-600">
              {CREW_MAX_PER_VISITOR} crews is the limit.
            </p>
          )}
        </div>
      )}

      {showForm && (
        <AddCrewForm
          crew={crew}
          // Your usual tag, ready to go: most people are the same person in every crew.
          initialTag={crews[0]?.me.tag ?? ""}
          busy={busy}
          onAdd={addCrew}
          onBack={crews.length > 0 ? () => setAdding(false) : undefined}
        />
      )}

      {status && (
        <p role="status" className="mt-2 text-amber-500">
          {status}
        </p>
      )}
    </div>
  );
}

function AddCrewForm({
  crew,
  initialTag,
  busy,
  onAdd,
  onBack,
}: {
  crew: UseCrewResult;
  initialTag: string;
  busy: boolean;
  onAdd: (action: () => Promise<CrewResult>, tag: string) => Promise<void>;
  onBack?: () => void;
}) {
  const [tag, setTag] = useState(initialTag);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  return (
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
      <input
        type="text"
        value={name}
        maxLength={CREW_NAME_MAX_LENGTH}
        autoComplete="off"
        onChange={(e) => setName(e.target.value)}
        placeholder="Crew name (optional)"
        aria-label="Crew name"
        className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-base text-zinc-100"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => onAdd(() => crew.create(tag, name), tag.trim())}
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
          onClick={() => onAdd(() => crew.join(code, tag), tag.trim())}
          className="rounded-md bg-zinc-800 px-3 py-1.5 text-zinc-100 disabled:opacity-50"
        >
          Join
        </button>
      </div>
      <p className="text-[10px] text-zinc-600">
        Joining shares your must-see and interested marks, and your notes, with the crew. It also turns on sync.
      </p>
      {onBack && (
        <button type="button" onClick={onBack} className="text-left text-zinc-500 underline decoration-dotted">
          Back
        </button>
      )}
    </div>
  );
}

function CrewSection({
  crew,
  current,
  open,
  onOpen,
  festivalSlug,
  ft,
  busy,
  run,
  setStatus,
}: {
  crew: UseCrewResult;
  current: CrewDTO;
  open: boolean;
  onOpen: () => void;
  festivalSlug: string;
  ft: FestivalTime;
  busy: boolean;
  run: (action: () => Promise<CrewResult>, tag?: string, success?: string) => Promise<CrewResult | null>;
  setStatus: (status: string | null) => void;
}) {
  const shown = formatCrewCode(current.code);
  const hidden = crew.hiddenCrewIds.has(current.id);
  const code = (
    <span data-crew-code className="shrink-0 font-semibold tracking-[0.1em] text-zinc-300">
      {shown}
    </span>
  );

  return (
    <section aria-label={current.name ?? shown} className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={onOpen}
        className="flex items-center justify-between gap-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-1">
          <span aria-hidden className="text-zinc-600">
            {open ? "▾" : "▸"}
          </span>
          {current.name && <span className="truncate font-medium text-zinc-100">{current.name}</span>}
          {!current.name && code}
          {hidden && <span className="shrink-0 text-[10px] text-zinc-600">hidden</span>}
        </span>
        {current.name && code}
      </button>
      {open && (
        <CrewDetails
          // Remounts when the saved values change, so a friend's rename
          // can't leave a stale draft sitting here looking unsaved.
          key={`${current.id}:${current.name}:${current.me.tag}`}
          crew={crew}
          current={current}
          hidden={hidden}
          festivalSlug={festivalSlug}
          ft={ft}
          busy={busy}
          run={run}
          setStatus={setStatus}
        />
      )}
    </section>
  );
}

function CrewDetails({
  crew,
  current,
  hidden,
  festivalSlug,
  ft,
  busy,
  run,
  setStatus,
}: {
  crew: UseCrewResult;
  current: CrewDTO;
  hidden: boolean;
  festivalSlug: string;
  ft: FestivalTime;
  busy: boolean;
  run: (action: () => Promise<CrewResult>, tag?: string, success?: string) => Promise<CrewResult | null>;
  setStatus: (status: string | null) => void;
}) {
  const [tag, setTag] = useState(current.me.tag);
  const [name, setName] = useState(current.name ?? "");
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
    if (!window.confirm("Leave this crew? Its people stop seeing your picks, and you theirs.")) return;
    try {
      await crew.leave(current.id);
    } catch {
      setStatus(OFFLINE_MESSAGE);
    }
  }

  return (
    <div className="flex flex-col gap-2 pb-1 pl-3">
      <div className="flex items-center justify-between gap-2">
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
        <PanelSwitch
          label="Show on grid"
          on={!hidden}
          title="Off hides this crew's picks on this device. You stay in the crew and keep sharing."
          onToggle={() => crew.toggleCrewHidden(current.id)}
        />
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
        <input
          type="text"
          value={name}
          maxLength={CREW_NAME_MAX_LENGTH}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this crew"
          aria-label="Crew name"
          className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-base text-zinc-100"
        />
        <button
          type="button"
          aria-label="Save name"
          disabled={busy || name.trim() === (current.name ?? "")}
          onClick={() => run(() => crew.rename(current.id, name), undefined, "Name saved.")}
          className="rounded-md bg-zinc-800 px-2 py-1 text-zinc-100 disabled:opacity-40"
        >
          Save
        </button>
      </div>

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
          aria-label="Save tag"
          disabled={busy || tag.trim() === current.me.tag}
          onClick={() => run(() => crew.update(current.id, { tag }), tag.trim(), "Tag saved.")}
          className="rounded-md bg-zinc-800 px-2 py-1 text-zinc-100 disabled:opacity-40"
        >
          Save
        </button>
      </div>

      <PanelSwitch
        label="Share my notes"
        on={current.me.shareNotes}
        disabled={busy}
        onToggle={() => run(() => crew.update(current.id, { shareNotes: !current.me.shareNotes }))}
      />

      <p className="text-[10px] text-zinc-600">
        This crew sees your must-see and interested marks{current.me.shareNotes ? " and your notes" : ""}.
        {crew.fetchedAt && ` Updated ${formatClock(new Date(crew.fetchedAt), ft)}.`}
      </p>

      <button type="button" onClick={leave} className="text-left text-zinc-500 underline decoration-dotted">
        Leave crew
      </button>
    </div>
  );
}

function PanelSwitch({
  label,
  on,
  title,
  disabled = false,
  onToggle,
}: {
  label: string;
  on: boolean;
  title?: string;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={title}
      disabled={disabled}
      onClick={onToggle}
      className="flex items-center justify-between gap-2 py-1"
    >
      <span className="text-zinc-400">{label}</span>
      <span
        aria-hidden
        className={`relative block h-3.5 w-6 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-zinc-700"}`}
      >
        <span
          className={`absolute top-0.5 block h-2.5 w-2.5 rounded-full bg-white transition-all ${on ? "left-3" : "left-0.5"}`}
        />
      </span>
    </button>
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
