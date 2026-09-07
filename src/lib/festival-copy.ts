// Per-edition blurbs shown under the header. Static reference data keyed by
// slug, the same call as src/lib/artist-links.ts: it changes once a year, an
// admin never edits it, and putting it in the database would mean a column,
// a migration and a form field for something that is really just content.

export interface FestivalLink {
  label: string;
  href: string;
}

export interface FestivalCopy {
  /** One line explaining how to read the times on this festival's grid. */
  disclaimer: string;
  links?: FestivalLink[];
}

export const FESTIVAL_COPY: Record<string, FestivalCopy> = {
  pdc26: {
    disclaimer: "End times are estimated since they are not officially revealed.",
    links: [
      { label: "Playlist", href: "https://open.spotify.com/playlist/2zBxbOfM0JV1TzJvvhkYBs" },
      { label: "xls", href: "/files/pdc26.xlsx" },
      { label: "pdf", href: "/files/pdc26.pdf" },
    ],
  },
  lotd26: {
    disclaimer:
      "Only start times are published. Each set shows 40 minutes, or until the next set in the same room — whichever is shorter. Tap a set to see how far the other venues are from it.",
    links: [{ label: "leftofthedial.nl", href: "https://leftofthedial.nl" }],
  },
};

export function festivalCopy(slug: string): FestivalCopy | undefined {
  return FESTIVAL_COPY[slug];
}
