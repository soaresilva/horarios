# Horários Bolachas

Mobile-first, offline-capable timetable app for multiple festival editions. `/` lists
every edition from the `Festival` table; each one gets a public route at `/<slug>` and
an admin route at `/admin/<slug>`. Live current-time line, tap-to-star favourites
(localStorage only, no accounts), and a password-protected admin panel scoped to one
festival at a time.

Two editions, two layouts, chosen per festival by `Festival.layout`:

- **`/pdc26`** — Vodafone Paredes de Coura 2026 (Aug 9–16, including the bonus
  afterparty day). `VERTICAL`: time runs down, two stages side by side as columns.
- **`/lotd26`** — Left of the Dial 2026, Rotterdam (Oct 21–24). `TRANSPOSED`: time runs
  across, one row per room, because 26 rooms cannot be read as columns. Rows are
  grouped by walking zone, and tapping a set re-labels every zone with the walking time
  from that venue.

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
