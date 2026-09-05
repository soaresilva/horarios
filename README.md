# Horários Bolachas

Mobile-first, offline-capable timetable app for multiple festival editions. `/` lists
every edition from the `Festival` table; each one gets a public route at `/<slug>`
(currently just `/pdc26`, the Vodafone Paredes de Coura 2026 timetable, Aug 9–16
including the bonus afterparty day) and an admin route at `/admin/<slug>`. Two-stage
side-by-side grid with a live current-time line, tap-to-star favorites (localStorage
only, no accounts), and a password-protected admin panel for schedule edits, scoped to
one festival at a time.

A festival needs no flag to become "archived" — `/` and each festival's own page mark
it as such automatically once its `endDate` has passed (see `isFestivalOver` in
`src/lib/festival.ts`). PdC 2026 has already happened, so `/pdc26` shows as an archived
record of that lineup today.

Left of the Dial (Rotterdam, 10+ venues) is the next edition planned — see the
`Festival`/`Stage` model in `prisma/schema.prisma` for how a new one plugs in: one
`Festival` row plus its `Stage` rows (own timezone, own slug namespace) is all a new
edition needs; no route or admin code changes required.

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS
- Postgres via Prisma 7 (`@prisma/adapter-pg`) — `Festival` → `Stage` → `Performance`
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
npm test          # Vitest — pure time/grid-math + grouping logic, RTL component tests
npm run test:e2e  # Playwright — admin CRUD flow, offline-after-first-visit
```

`npm test` also runs automatically on `git commit` via a Husky pre-commit hook (along
with `npm run lint`). `test:e2e` builds and starts a production server itself
(`playwright.config.ts`'s `webServer`) since the service worker only registers in
production — see `RegisterServiceWorker.tsx`.

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
