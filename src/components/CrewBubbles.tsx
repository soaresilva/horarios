"use client";

import { crewAriaLabel, crewColor, crewTooltip, type FriendMark } from "@/lib/crew";

interface CrewBubblesProps {
  /** Already sorted strongest first (friendsByPerformance in src/lib/crew.ts). */
  friends: FriendMark[];
  /** Bubbles before the rest collapse into "+N". Omit for no cap (the list view). */
  max?: number;
  /**
   * Makes the cluster one tap target that opens the set's sheet, where each
   * friend's note is readable on a phone (hover tooltips don't exist there).
   * Leave it out where the cluster sits inside another button (side-stage
   * rows) or has nothing to open (the list view shows notes in full).
   */
  onOpen?: () => void;
  className?: string;
}

// A friend's pick: their 1-2 character tag in their crew colour. Filled is
// must-see, outlined is interested, the same filled/hollow split as the
// ★/☆ on your own marks. Hovering shows every friend's tier and note.
export function CrewBubbles({ friends, max, onOpen, className = "" }: CrewBubblesProps) {
  if (friends.length === 0) return null;

  const shown = max !== undefined && friends.length > max ? friends.slice(0, max) : friends;
  const hidden = friends.length - shown.length;

  const bubbles = (
    <>
      {shown.map((friend) => {
        const color = crewColor(friend.colorIndex);
        return (
          <span
            key={friend.tag}
            data-crew-tag={friend.tag}
            data-crew-tier={friend.tier}
            style={
              friend.tier === "must"
                ? { backgroundColor: color, color: "var(--background)" }
                : { boxShadow: `inset 0 0 0 1px ${color}`, color }
            }
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[8px] leading-none font-bold not-italic"
          >
            {friend.tag}
          </span>
        );
      })}
      {hidden > 0 && <span className="text-[9px] leading-none font-semibold text-zinc-400">+{hidden}</span>}
    </>
  );

  const shared = `inline-flex items-center gap-0.5 align-middle ${className}`;
  const title = crewTooltip(friends);
  const label = crewAriaLabel(friends);

  return onOpen ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      title={title}
      aria-label={label}
      className={`pointer-events-auto ${shared}`}
    >
      {bubbles}
    </button>
  ) : (
    <span title={title} aria-label={label} role="img" className={shared}>
      {bubbles}
    </span>
  );
}
