// One place that owns what a note looks like wherever "display notes" is on
// (PerformanceBlock, TransposedPerformanceBlock, SideStageSection) — reusing
// FavoritesListView's existing italic-zinc treatment rather than each site
// inventing its own. CSS clamping, not a character count: `truncate` and
// `line-clamp-2` size themselves to the block's real width and font metrics,
// which a fixed character cap can't do without either cutting a wide block
// short or overflowing a narrow one. `title` sits on the text itself so
// hovering a clamped note still reveals it in full on desktop — inline
// preview and hover tooltip are complementary, not either/or.
export function InlineNote({ note, lines, className = "" }: { note: string; lines: 1 | 2; className?: string }) {
  return (
    <span
      title={note}
      className={`block text-[10px] leading-snug text-zinc-500 italic ${lines === 1 ? "truncate" : "line-clamp-2"} ${className}`}
    >
      {note}
    </span>
  );
}
