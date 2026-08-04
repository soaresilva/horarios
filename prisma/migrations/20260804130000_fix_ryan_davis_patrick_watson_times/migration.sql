-- Data migration (no schema change): fixes two rows the previous migration
-- (20260804120000_reveal_vodafone_coura_lineup) silently failed to update.
-- That migration matched existing rows by exact artistName + date text, but
-- two rows in production have different wording than prisma/seed.ts assumed
-- (edited via /admin at some point, never synced back):
--   - id cmrz4dvv3001g4m5nr1tfm9nw: artistName "Ryan Davis and the Roadhouse
--     Band" (seed.ts/the prior migration expected "Ryan Davis & The
--     Roadhouse Band" — an ampersand vs "and"), recommended = true.
--   - id cmrz4dwgq001o4m5n5ek9lwom: artistName "Patrick Watson" (seed.ts/the
--     prior migration expected "Patrick Watson Solo Piano").
-- Because the WHERE clause matched zero rows for both, they were left at
-- their pre-reveal guessed times (21:50-22:50 and 20:40-21:55 respectively),
-- which now overlapped the newly-correct Terraplana (21:55-22:45) and Meute
-- (20:45-21:45) slots on their stages — rendering as two performance blocks
-- stacked at the same position in the grid.
--
-- Fixed here by targeting the exact row ids instead of artistName, and only
-- touching startTime/endTime — artistName, notes, and the recommended flag
-- (set true on the Ryan Davis row, presumably curated directly via /admin)
-- are left exactly as they are in production. stageId is already correct
-- for both rows (Coura Sem Paredes / Vodafone respectively), so it isn't
-- touched either.
--
-- Times carry an explicit +01:00 offset (mainland Portugal is WEST/UTC+1
-- all August) so they store as the correct UTC instant regardless of the
-- migration connection's session timezone.

UPDATE "Performance"
SET "startTime" = TIMESTAMPTZ '2026-08-14 19:55:00+01',
    "endTime" = TIMESTAMPTZ '2026-08-14 20:40:00+01',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'cmrz4dvv3001g4m5nr1tfm9nw';

UPDATE "Performance"
SET "startTime" = TIMESTAMPTZ '2026-08-15 17:10:00+01',
    "endTime" = TIMESTAMPTZ '2026-08-15 18:10:00+01',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'cmrz4dwgq001o4m5n5ek9lwom';
