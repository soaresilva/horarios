// Per-edition blurbs shown under the header. Static reference data keyed by
// slug, the same call as src/lib/artist-links.ts: it changes once a year, an
// admin never edits it, and putting it in the database would mean a column,
// a migration and a form field for something that is really just content.

export interface FestivalLink {
  label: string;
  href: string;
}

/** How a festival's side programme reads on the grid, its switch and the mark sheet. */
export interface SideProgrammeCopy {
  /** Chip on each side-programme block and on its switch ("FREE", "U?"). */
  chip: string;
  /** Switch label after the chip ("daytime shows"). */
  label: string;
  /** What the switch shows and hides, for its tooltip ("the free daytime side programme"). */
  description: string;
  /** Trailing part of the mark-sheet line and block tooltip ("free entry"), if any. */
  note?: string;
  /** Tag after a side-programme entry in "Also plays" ("free daytime"). */
  otherShowTag: string;
  /** Short badge on the row in /admin ("TOUO", "U?"). */
  adminBadge: string;
  /** Whether a visitor who never touched the switch sees the side programme. */
  defaultShown: boolean;
}

/** Everything the grid needs to say about who and what a set is, beyond its name and time. */
export interface ProgrammeCopy {
  side: SideProgrammeCopy;
  /**
   * Words before `Performance.host` ("hosted by Opposite"), or null when
   * the host already reads as a full credit ("Curated by aja monet").
   */
  hostPrefix: string | null;
  /** Whether a visitor who never touched the non-concerts switch sees films, talks and the rest. */
  nonConcertsDefaultShown: boolean;
  /** What `Zone.walkMinutesFromHub` is measured from ("ticket desk", "TivoliVredenburg"). */
  hubName: string;
}

// Neutral wording for a festival with a side programme but no copy of its
// own. Every festival that has one sets its own below.
export const DEFAULT_PROGRAMME_COPY: ProgrammeCopy = {
  side: {
    chip: "SIDE",
    label: "side programme",
    description: "the side programme",
    otherShowTag: "side programme",
    adminBadge: "SIDE",
    defaultShown: true,
  },
  hostPrefix: "hosted by",
  nonConcertsDefaultShown: true,
  hubName: "ticket desk",
};

export interface FestivalCopy {
  /** One line explaining how to read the times on this festival's grid. */
  disclaimer: string;
  links?: FestivalLink[];
  /**
   * Whether to show the "bolachas recommends" toggle + starred-favourites
   * legend row. Defaults to true. The recommends half only means anything
   * for a festival whose admin actually curates `Performance.recommended`
   * rows — set false for one that doesn't, rather than showing a toggle
   * with nothing to toggle.
   */
  legend?: boolean;
  /**
   * How many stages the vertical layout draws side by side. Defaults to 2
   * (Paredes de Coura: Vodafone + Coura, side stages stacked above). Any
   * further active stage stacks as a collapsible section. Ignored by the
   * transposed layout, which already shows every room.
   */
  gridColumns?: number;
  /** Side programme, host and non-concert wording; anything unset falls back to DEFAULT_PROGRAMME_COPY. */
  programme?: Partial<Omit<ProgrammeCopy, "side">> & { side?: SideProgrammeCopy };
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
    // The transposed grid has four separate tap targets on one block (star,
    // name, body, venue cell), each doing something different — this spells
    // them out rather than leaving a first-time visitor to guess.
    disclaimer:
      "Tapping the star once marks a show as a \"must-see\", tapping it again marks it as \"interested\". Tap the artist name to navigate to their page on the LOTD website. Tap a show to see rough walking distances to other venues. A long tap allows you to add notes to a show (hover over each note to read it). Tap a venue name to navigate on Google Maps. Dashed FREE blocks on Friday and Saturday afternoon are The Official Unofficial, the free daytime side programme (no wristband needed).",
    links: [
      { label: "leftofthedial.nl", href: "https://leftofthedial.nl" },
      { label: "theofficialunofficial.nl", href: "https://www.theofficialunofficial.nl" },
    ],
    // No recommends curation planned for this edition, and the disclaimer
    // above already covers starring — the legend row would be redundant on
    // an already-dense grid.
    legend: false,
    programme: {
      side: {
        chip: "FREE",
        label: "daytime shows",
        description: "the free daytime side programme",
        note: "free entry",
        otherShowTag: "free daytime",
        adminBadge: "TOUO",
        defaultShown: true,
      },
      hostPrefix: "hosted by",
      hubName: "ticket desk",
    },
  },
  lc26oct: {
    // Three rooms a night, and the third (De Kring / Barlaeus) overlaps the
    // Paradiso halls, so all three sit side by side rather than stacking
    // the third above the grid the way PdC's side stages do.
    gridColumns: 3,
    disclaimer:
      "Times from the official poster. We Love 00's and Indiesleaze are club nights with no announced end: they're drawn as long as the poster draws them and run later. Indiesleaze is DJ sets by Cutouts, Lazarus Kane and Charlie Avalon. Tap a show once for \"must-see\", twice for \"interested\"; long-press to add a note. Tap an artist name for their London Calling page.",
    links: [
      { label: "londoncalling.nl", href: "https://www.londoncalling.nl/timetable/" },
      { label: "Playlist", href: "https://open.spotify.com/playlist/7jpA1XEIYaNTBT9ET7Fytf" },
    ],
    // No recommends curation for this edition.
    legend: false,
  },
  lgw26: {
    disclaimer:
      "Times from leguesswho.com. Tap the star once for \"must-see\", twice for \"interested\"; long-press to add a note. Tap a show for walking times to every zone: Nijverheidskade and the Werkspoorkwartier are 35-40 minutes on foot from TivoliVredenburg, so bring a bike. U? (dashed) and non-concerts are hidden until you switch them on.",
    links: [
      { label: "leguesswho.com", href: "https://leguesswho.com/timetable" },
      { label: "U? timetable", href: "https://leguesswho.com/u/timetable" },
    ],
    // No recommends curation for this edition.
    legend: false,
    programme: {
      side: {
        chip: "U?",
        label: "programme",
        description: "the U? side programme",
        otherShowTag: "U?",
        adminBadge: "U?",
        // Diogo's call: the grid opens on the main concert programme, and
        // U? and non-concerts are opt-in.
        defaultShown: false,
      },
      // LGW's host is the project's full name ("Curated by aja monet",
      // "24 HOUR DUB"), which already reads as a credit.
      hostPrefix: null,
      nonConcertsDefaultShown: false,
      hubName: "TivoliVredenburg",
    },
  },
};

export function festivalCopy(slug: string): FestivalCopy | undefined {
  return FESTIVAL_COPY[slug];
}

export function programmeCopy(slug: string): ProgrammeCopy {
  const own = FESTIVAL_COPY[slug]?.programme;
  return { ...DEFAULT_PROGRAMME_COPY, ...own, side: own?.side ?? DEFAULT_PROGRAMME_COPY.side };
}
