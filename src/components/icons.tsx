// Shared inline SVGs. Feather-style stroke geometry to match SocialLinks;
// colour comes from the surrounding `text-*` class via `currentColor`.

interface IconProps {
  className?: string;
}

// "bolachas recommends" marker. Rendered small and blue (text-accent) after
// an artist's name, and in the legend at the top of the page.
export function ThumbsUp({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}
