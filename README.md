# Horários Bolachas

Mobile-first, offline-capable timetable app for multiple festival editions. `/` lists
every edition from the `Festival` table; each one gets a public route at `/<slug>` and
an admin route at `/admin/<slug>`. Live current-time line, two-tier marks and per-slot
notes (localStorage only by default, no accounts), and a password-protected admin panel
scoped to one festival at a time.

Marking a set is a tri-state tap: unmarked → **must-see** (filled blue ★) → **interested**
(hollow amber ☆) → unmarked. Holding a set (500ms, or right-click on desktop) opens a
sheet with explicit tier buttons and a free-text note (280 characters) for that slot —
"front left, get there early", "skip if the queue is bad". Notes stay on-device unless
the visitor opts into cross-device sync below, exactly like the tiers themselves.

Three editions, two layouts, chosen per festival by `Festival.layout`:

- **`/pdc26`** — Vodafone Paredes de Coura 2026 (Aug 9–16, including the bonus
  afterparty day). `VERTICAL`: time runs down, two stages side by side as columns.
- **`/lotd26`** — Left of the Dial 2026, Rotterdam (Oct 21–24). `TRANSPOSED`: time runs
  across, one row per room, because 26 rooms cannot be read as columns. Rows are
  grouped by walking zone, and tapping a set re-labels every zone with the walking time
  from that venue.
- **`/lc26oct`** — London Calling October 2026, Amsterdam (Oct 30–31). `VERTICAL`, but
  with three columns (`gridColumns: 3` in `src/lib/festival-copy.ts`): both Paradiso
  halls every night, plus De Kring (Fri) or Barlaeus (Sat). The slug carries the month
  because London Calling runs every April and October.

A festival needs no flag to become "archived" — `/` and each festival's own page mark
it as such automatically once its `endDate` has passed (see `isFestivalOver` in
`src/lib/festival.ts`). PdC 2026 has already happened, so `/pdc26` shows as an archived
record of that lineup today.

A new edition needs one `Festival` row plus its `Stage` rows (own timezone, own locale,
own slug namespace) — no route or admin code changes. Rooms and walking zones are
hand-curated in a migration, never created by the importer, so a room always has an
address and a zone.

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS
- Postgres via Prisma 7 (`@prisma/adapter-pg`) — `Festival` → `Zone` → `Stage` →
  `Performance`, plus `Artist` for imported reference data and `ZoneWalk` for walking
  times between zones
- Hand-rolled service worker (`public/sw.js`) — not Serwist/Workbox, since
  `@serwist/next` doesn't support Turbopack, which Next 16 uses by default for both
  `dev` and `build`
- Admin auth: single shared password (`ADMIN_PASSWORD` env var) + a `jose`-signed
  session cookie, gated by `proxy.ts` (Next 16's renamed `middleware.ts`) — one password
  for every festival's admin, not per-edition

## Local development

Requires Node 20+ and a local Postgres.

```bash
brew install postgresql@16   # if you don't have Postgres locally
brew services start postgresql@16
createdb horarios_dev

npm install
cp .env.example .env         # then fill in DATABASE_URL / ADMIN_PASSWORD / SESSION_SECRET
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open http://localhost:3000 for the archive index, or http://localhost:3000/pdc26 for
the PdC 2026 timetable directly. Admin is at `/admin` (password from `.env`) — log in,
then pick a festival to get its scoped editor at `/admin/<slug>`.

**Timezone note:** `.env` sets `TZ=UTC` and `src/lib/prisma.ts` forces the Postgres
session timezone to UTC on every connection. Don't remove either — see the comments in
those two files for why (a real bug was found and fixed here: without this, the exact
same code silently stored different absolute instants depending on the connecting
process's local timezone).

## Tests

```bash
npm test          # Vitest — time/grid math, grouping, importer parsers, RTL components
npm run test:e2e  # Playwright — admin CRUD, offline-after-first-visit, transposed grid
```

`test:e2e` runs Chromium for everything, plus **WebKit for `e2e/lotd.spec.ts` only**.
The transposed grid's frozen venue column and time header are pure CSS sticky, and every
sticky bug this project has actually hit (stuttering scroll, unpainted headers — commits
`0f12f0e`, `ed2f728`) was Safari-only, so those assertions have to run on WebKit. The
admin specs assume a desktop viewport and Playwright's offline emulation isn't supported
on WebKit, which is why the WebKit project is scoped rather than running everything.

`npm test` also runs automatically on `git commit` via a Husky pre-commit hook (along
with `npm run lint`). `test:e2e` builds and starts a production server itself
(`playwright.config.ts`'s `webServer`) since the service worker only registers in
production — see `RegisterServiceWorker.tsx`.

## Importing the Left of the Dial schedule

The festival never publishes a consolidated timetable — `leftofthedial.nl/timetable/`
still shows last year's PDFs — but every act page carries its own day, venue and start
time. `scripts/import-lotd.ts` reconstructs the schedule from those pages.

```bash
npm run import:lotd -- --fetch            # network  -> scripts/data/lotd26.json
npm run import:lotd -- --apply --dry-run  # report what would change
npm run import:lotd -- --apply            # snapshot -> Postgres
npm run import:lotd -- --apply --prune    # also remove sets that vanished upstream
```

Two phases with a committed JSON snapshot between them: a Vercel build never depends on
the festival's site being up, a schedule change is reviewable as a git diff before it
touches a database, and the parser tests run against fixtures with no network. Applying
twice is a no-op — set times keep moving until October, so this is meant to be re-run.

Two things it deliberately will not do: create a `Stage` (an unrecognised venue string
fails the run, because rooms carry hand-curated zones and addresses), and write
`recommended` or `notes` (those are admin curation).

Only start times are published, so end times are derived: 40 minutes, clipped by the
next set in the same room. To update production, after checking the snapshot diff:

```bash
DATABASE_URL="<production connection string>" npm run import:lotd -- --apply
```

## Importing The Official Unofficial (LOTD side programme)

The Official Unofficial is LOTD's free daytime side programme (Fri 23 / Sat 24 Oct,
12:00-16:00, no wristband). It goes into the same `lotd26` grid: the sets share venue
rows with the main programme where it's the same room. Four rooms are only used by
the side programme (Plato, Tramhuis, Zondebok & 't Zwarte Schaap, Time Is The New
Space), and `20261016120000_add_touo_side_programme` adds them to their walking zones.
Sets carry `Performance.series = "The Official Unofficial"` and `host`. The grid draws
them with a dashed outline and a FREE chip, and a "daytime shows" switch hides them.

The only source is a one-page PDF, so the data goes through two steps:

```bash
# 1. PDF -> sets. Reads the PDF's vector layout (block rectangles, tick positions),
#    not the image. pdfplumber lives in a throwaway venv, not the project.
python3 -m venv /tmp/touo-venv && /tmp/touo-venv/bin/pip install pdfplumber
/tmp/touo-venv/bin/python -I scripts/touo/extract-pdf.py A4-TOUO-Timetable.pdf
#    Merge that output into scripts/data/touo26.json (Sticker Night is a text box on
#    the PDF, not a grid block, so it's entered by hand), then review the diff.

# 2. Snapshot -> Postgres.
npm run import:touo -- --check            # validate the snapshot, no DB
npm run import:touo -- --apply --dry-run  # report what would change
npm run import:touo -- --apply            # snapshot -> Postgres
npm run import:touo -- --apply --prune    # also remove sets that left the snapshot
```

`--check` and the gate tests compare the snapshot against
`EXPECTED_SETS_PER_ROOM` in `scripts/touo/plan.ts`. Those counts were read off the PDF
by hand, separately from the extractor. If the PDF changes, update them from the PDF,
not from the snapshot, or the check checks nothing.

Import rows are `touo26-p-*` and LOTD rows are `lotd26-p-*`, so neither importer's
`--prune` can delete the other's sets. Acts that are also on the LOTD lineup get linked
to their `Artist` row, so "Also plays" and the `#n/m` ordinals connect both programmes.

LOTD's end times are estimates, and both importers clip them at the next set in the
room, whichever programme that set belongs to. The Guest List at Rotown (Fri 23:30)
ends when Sticker Night starts at 00:00, and re-running either importer keeps it that
way. A LOTD set that *starts* inside a side-programme set is a real clash and fails the
import.

## Importing London Calling October 2026

London Calling publishes its timetable only as two JPG posters
(https://www.londoncalling.nl/timetable/), so `scripts/data/lc26oct.json` is
hand-transcribed from the printed `HH.MM-HH.MM` labels, then checked by code:

```bash
# 1. Poster pixels vs. snapshot. Finds every box per room column, fits the time axis
#    to the transcribed times, and fails on a missing/extra box or any set >10 min
#    from its box. Also the only source for the two club nights, which have no
#    printed times. Pillow lives in a throwaway venv, not the project.
python3 -m venv /tmp/lc-venv && /tmp/lc-venv/bin/pip install pillow
/tmp/lc-venv/bin/python -I scripts/lc/measure-poster.py scripts/data/lc26oct.json \
  page-0001-scaled.jpg page-0002-scaled.jpg

# 2. Artist pages -> snapshot. Name, festival page and Spotify (from the page's
#    embedded player). Each Spotify link is checked against Spotify's own artist name
#    and dropped on a mismatch: Really Good Time's page embeds Robber Robber.
npm run import:lc -- --fetch-artists

# 3. Snapshot -> Postgres.
npm run import:lc -- --check            # validate the snapshot, no network, no DB
npm run import:lc -- --apply --dry-run  # report what would change
npm run import:lc -- --apply            # snapshot -> Postgres
npm run import:lc -- --apply --prune    # also remove sets that left the snapshot
```

The posters' boxes are hand-placed and drift up to ~8 min from their own labels
(Momo Boyd's box starts at 15:48 for a printed 15.40). Labels are authoritative, and
the club nights' measured times inherit that drift. Each `artistSlug` is explicit,
because the site's slugs don't follow names (Sandhouse is `/artists/swapmeet-2/`) and
older editions reuse names (`/artists/cardinals/` is not this year's Cardinals).
Rows are `lc26oct-p-*` / `lc26oct-a-*`.

## Deployment (Vercel + Neon)

1. **Database.** In the Vercel dashboard: Storage → Create Database → Postgres (Neon).
   This gives you a `DATABASE_URL`.
2. **Env vars.** In the Vercel project settings, set:
   - `DATABASE_URL` — from step 1
   - `ADMIN_PASSWORD` — a real password, not the local dev one
   - `SESSION_SECRET` — generate with `openssl rand -base64 32`
   - `TZ` — `UTC` (see the timezone note above; don't skip this one)
3. **Link the repo.** Import `soaresilva/horarios` in Vercel (or `vercel link` +
   `vercel git connect` from this directory).
4. **Run migrations against the production database** before or right after the first
   deploy:
   ```bash
   DATABASE_URL="<production connection string>" npx prisma migrate deploy
   DATABASE_URL="<production connection string>" npx prisma db seed
   ```
5. Push to `main` — Vercel deploys automatically from there on.

Admin edits after that go live immediately (no redeploy) — the dashboard writes
directly to Postgres via Server Actions.
