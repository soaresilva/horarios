"use client";

import { Close } from "@/components/icons";

interface MarksHintProps {
  dismissed: boolean;
  onDismiss: () => void;
}

// A one-time explainer for "tap to mark, hold for a note" — nothing about
// either gesture is discoverable on its own. Styled like InstallBanner (a
// thin strip, same border/opacity treatment) and backed by the same
// dismiss-forever pattern as useInstallBannerDismissed, just scoped per
// festival slug (see useMarksHintDismissed.ts). Auto-dismissal (on the
// visitor's first tier cycle or sheet open, not just a tap on this strip)
// is wired by the caller — this component only renders/hides off the
// `dismissed` prop and reports an explicit tap via `onDismiss`.
export function MarksHint({ dismissed, onDismiss }: MarksHintProps) {
  if (dismissed) return null;

  return (
    <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-[11px] leading-snug text-zinc-400">
      <p className="flex-1">Tap a set to mark it. Hold it to add a note.</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss hint"
        className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <Close className="h-3 w-3" />
      </button>
    </div>
  );
}
