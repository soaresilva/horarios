"use client";

import { ThumbsUp } from "@/components/icons";
import { useShowRecommendations } from "@/hooks/useShowRecommendations";

// Doubles as the legend entry for the thumbs-up marker and the control that
// shows/hides it. role="switch" + aria-checked make the on/off state legible
// to assistive tech; the track colour and knob position show it visually.
export function RecommendationsToggle() {
  const { show, toggle } = useShowRecommendations();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={show}
      onClick={toggle}
      title={show ? "Hide bolachas recommendations" : "Show bolachas recommendations"}
      className="flex items-center gap-1.5"
    >
      <span
        aria-hidden
        className={`relative block h-3.5 w-6 shrink-0 rounded-full transition-colors ${
          show ? "bg-accent" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 block h-2.5 w-2.5 rounded-full bg-white transition-all ${
            show ? "left-3" : "left-0.5"
          }`}
        />
      </span>
      <ThumbsUp className={`h-3 w-3 ${show ? "text-accent" : "text-zinc-500"}`} />
      <span className={show ? "text-zinc-400" : "text-zinc-500"}>bolachas recommends</span>
    </button>
  );
}
