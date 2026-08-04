-- Data migration (no schema change): apply the officially revealed 12-15 Aug
-- Vodafone / Coura Sem Paredes lineup (previously seeded with a
-- pre-announcement guess) and rename the "COURA" stage to its confirmed
-- name, "Coura Sem Paredes". Runs through the normal deploy pipeline (prisma
-- migrate deploy). Existing rows are UPDATEd in place, matched by
-- artistName + date rather than deleted/recreated, so any admin-entered
-- notes/recommended flags on these rows survive, and matched without
-- assuming a stable performance id since these rows were originally created
-- by prisma/seed.ts's prisma.performance.create (auto cuid), not a prior
-- data migration with readable ids.
--
-- Only start times were published; end times are guessed as the start of
-- the next act, on either stage, whichever comes first — merging both
-- stages' start times chronologically shows Vodafone and Coura Sem Paredes
-- strictly alternate with zero overlap on all four nights, so this always
-- lands on the true changeover instant. Each night's final act (no
-- following act) gets a flat +75min guess, matching the closing-set
-- lengths already used elsewhere in this lineup (Bassvictim/Marie Davidson
-- DJ Set/Amyl and the Sniffers were all guessed at 75-90min previously).
-- Several acts also moved stage between the pre-reveal guess and the
-- official lineup (e.g. Westside Cowboy: Coura -> Vodafone), which is why
-- stageId is reassigned here too, not just the times.
--
-- Times carry an explicit +01:00 offset (mainland Portugal is WEST/UTC+1
-- all August) so they store as the correct UTC instant regardless of the
-- migration connection's session timezone. Artist names match the spelling
-- already used elsewhere in this dataset/on the site (e.g. "Pale Jay", not
-- "Pale Jav"; "Wu Lyf", not "Wu Lvf").

UPDATE "Stage" SET "name" = 'Coura Sem Paredes' WHERE "slug" = 'palco-2';

UPDATE "Performance" p
SET "startTime" = v.start_time,
    "endTime" = v.end_time,
    "stageId" = s."id",
    "updatedAt" = CURRENT_TIMESTAMP
FROM (VALUES
  ('Westside Cowboy', DATE '2026-08-12', 'vodafone', TIMESTAMPTZ '2026-08-12 17:25:00+01', TIMESTAMPTZ '2026-08-12 18:25:00+01'),
  ('First Breath After Coma + Salvador Sobral', DATE '2026-08-12', 'vodafone', TIMESTAMPTZ '2026-08-12 19:15:00+01', TIMESTAMPTZ '2026-08-12 20:15:00+01'),
  ('CMAT', DATE '2026-08-12', 'vodafone', TIMESTAMPTZ '2026-08-12 21:00:00+01', TIMESTAMPTZ '2026-08-12 22:05:00+01'),
  ('Wet Leg', DATE '2026-08-12', 'vodafone', TIMESTAMPTZ '2026-08-12 23:05:00+01', TIMESTAMPTZ '2026-08-13 00:20:00+01'),
  ('Kneecap', DATE '2026-08-12', 'vodafone', TIMESTAMPTZ '2026-08-13 01:25:00+01', TIMESTAMPTZ '2026-08-13 02:40:00+01'),
  ('Miramar', DATE '2026-08-12', 'palco-2', TIMESTAMPTZ '2026-08-12 16:45:00+01', TIMESTAMPTZ '2026-08-12 17:25:00+01'),
  ('Greg Freeman', DATE '2026-08-12', 'palco-2', TIMESTAMPTZ '2026-08-12 18:25:00+01', TIMESTAMPTZ '2026-08-12 19:15:00+01'),
  ('Horsegirl', DATE '2026-08-12', 'palco-2', TIMESTAMPTZ '2026-08-12 20:15:00+01', TIMESTAMPTZ '2026-08-12 21:00:00+01'),
  ('Capitão Fausto', DATE '2026-08-12', 'palco-2', TIMESTAMPTZ '2026-08-12 22:05:00+01', TIMESTAMPTZ '2026-08-12 23:05:00+01'),
  ('The Horrors', DATE '2026-08-12', 'palco-2', TIMESTAMPTZ '2026-08-13 00:20:00+01', TIMESTAMPTZ '2026-08-13 01:25:00+01'),
  ('Getdown Services', DATE '2026-08-12', 'palco-2', TIMESTAMPTZ '2026-08-13 02:40:00+01', TIMESTAMPTZ '2026-08-13 04:00:00+01'),
  ('University', DATE '2026-08-12', 'palco-2', TIMESTAMPTZ '2026-08-13 04:00:00+01', TIMESTAMPTZ '2026-08-13 05:15:00+01'),
  ('A Garota Não', DATE '2026-08-13', 'vodafone', TIMESTAMPTZ '2026-08-13 17:10:00+01', TIMESTAMPTZ '2026-08-13 18:00:00+01'),
  ('Aldous Harding', DATE '2026-08-13', 'vodafone', TIMESTAMPTZ '2026-08-13 19:00:00+01', TIMESTAMPTZ '2026-08-13 20:00:00+01'),
  ('Kurt Vile & The Violators', DATE '2026-08-13', 'vodafone', TIMESTAMPTZ '2026-08-13 21:00:00+01', TIMESTAMPTZ '2026-08-13 22:15:00+01'),
  ('Hermanos Gutiérrez', DATE '2026-08-13', 'vodafone', TIMESTAMPTZ '2026-08-13 23:15:00+01', TIMESTAMPTZ '2026-08-14 00:30:00+01'),
  ('Underworld', DATE '2026-08-13', 'vodafone', TIMESTAMPTZ '2026-08-14 01:30:00+01', TIMESTAMPTZ '2026-08-14 02:45:00+01'),
  ('Milhanas', DATE '2026-08-13', 'palco-2', TIMESTAMPTZ '2026-08-13 16:30:00+01', TIMESTAMPTZ '2026-08-13 17:10:00+01'),
  ('Tomode', DATE '2026-08-13', 'palco-2', TIMESTAMPTZ '2026-08-13 18:00:00+01', TIMESTAMPTZ '2026-08-13 19:00:00+01'),
  ('Friko', DATE '2026-08-13', 'palco-2', TIMESTAMPTZ '2026-08-13 20:00:00+01', TIMESTAMPTZ '2026-08-13 21:00:00+01'),
  ('Pale Jay', DATE '2026-08-13', 'palco-2', TIMESTAMPTZ '2026-08-13 22:15:00+01', TIMESTAMPTZ '2026-08-13 23:15:00+01'),
  ('Wu Lyf', DATE '2026-08-13', 'palco-2', TIMESTAMPTZ '2026-08-14 00:30:00+01', TIMESTAMPTZ '2026-08-14 01:30:00+01'),
  ('Show Me The Body', DATE '2026-08-13', 'palco-2', TIMESTAMPTZ '2026-08-14 02:45:00+01', TIMESTAMPTZ '2026-08-14 03:45:00+01'),
  ('Bassvictim', DATE '2026-08-13', 'palco-2', TIMESTAMPTZ '2026-08-14 03:45:00+01', TIMESTAMPTZ '2026-08-14 05:00:00+01'),
  ('Carolina Durante', DATE '2026-08-14', 'vodafone', TIMESTAMPTZ '2026-08-14 16:55:00+01', TIMESTAMPTZ '2026-08-14 17:55:00+01'),
  ('Sérgio & Os Assessores Com Amigos', DATE '2026-08-14', 'vodafone', TIMESTAMPTZ '2026-08-14 18:40:00+01', TIMESTAMPTZ '2026-08-14 19:55:00+01'),
  ('Benjamin Clementine', DATE '2026-08-14', 'vodafone', TIMESTAMPTZ '2026-08-14 20:40:00+01', TIMESTAMPTZ '2026-08-14 21:55:00+01'),
  ('Bloc Party', DATE '2026-08-14', 'vodafone', TIMESTAMPTZ '2026-08-14 22:45:00+01', TIMESTAMPTZ '2026-08-15 00:00:00+01'),
  ('M.I.A.', DATE '2026-08-14', 'vodafone', TIMESTAMPTZ '2026-08-15 01:00:00+01', TIMESTAMPTZ '2026-08-15 02:00:00+01'),
  ('Noko Woi', DATE '2026-08-14', 'palco-2', TIMESTAMPTZ '2026-08-14 16:15:00+01', TIMESTAMPTZ '2026-08-14 16:55:00+01'),
  ('Strawberry Guy', DATE '2026-08-14', 'palco-2', TIMESTAMPTZ '2026-08-14 17:55:00+01', TIMESTAMPTZ '2026-08-14 18:40:00+01'),
  ('Ryan Davis & The Roadhouse Band', DATE '2026-08-14', 'palco-2', TIMESTAMPTZ '2026-08-14 19:55:00+01', TIMESTAMPTZ '2026-08-14 20:40:00+01'),
  ('Terraplana', DATE '2026-08-14', 'palco-2', TIMESTAMPTZ '2026-08-14 21:55:00+01', TIMESTAMPTZ '2026-08-14 22:45:00+01'),
  ('Vendredi Sur Mer', DATE '2026-08-14', 'palco-2', TIMESTAMPTZ '2026-08-15 00:00:00+01', TIMESTAMPTZ '2026-08-15 01:00:00+01'),
  ('Maruja', DATE '2026-08-14', 'palco-2', TIMESTAMPTZ '2026-08-15 02:00:00+01', TIMESTAMPTZ '2026-08-15 03:25:00+01'),
  ('Joy Orbison', DATE '2026-08-14', 'palco-2', TIMESTAMPTZ '2026-08-15 03:25:00+01', TIMESTAMPTZ '2026-08-15 04:40:00+01'),
  ('Patrick Watson Solo Piano', DATE '2026-08-15', 'vodafone', TIMESTAMPTZ '2026-08-15 17:10:00+01', TIMESTAMPTZ '2026-08-15 18:10:00+01'),
  ('Cate Le Bon', DATE '2026-08-15', 'vodafone', TIMESTAMPTZ '2026-08-15 18:55:00+01', TIMESTAMPTZ '2026-08-15 19:55:00+01'),
  ('Meute', DATE '2026-08-15', 'vodafone', TIMESTAMPTZ '2026-08-15 20:45:00+01', TIMESTAMPTZ '2026-08-15 21:45:00+01'),
  ('Thundercat', DATE '2026-08-15', 'vodafone', TIMESTAMPTZ '2026-08-15 22:45:00+01', TIMESTAMPTZ '2026-08-15 23:45:00+01'),
  ('Amyl and the Sniffers', DATE '2026-08-15', 'vodafone', TIMESTAMPTZ '2026-08-16 00:35:00+01', TIMESTAMPTZ '2026-08-16 01:35:00+01'),
  ('Noiserv', DATE '2026-08-15', 'palco-2', TIMESTAMPTZ '2026-08-15 16:30:00+01', TIMESTAMPTZ '2026-08-15 17:10:00+01'),
  ('Hudson Freeman', DATE '2026-08-15', 'palco-2', TIMESTAMPTZ '2026-08-15 18:10:00+01', TIMESTAMPTZ '2026-08-15 18:55:00+01'),
  ('Sophia Stel', DATE '2026-08-15', 'palco-2', TIMESTAMPTZ '2026-08-15 19:55:00+01', TIMESTAMPTZ '2026-08-15 20:45:00+01'),
  ('Julia Mestre', DATE '2026-08-15', 'palco-2', TIMESTAMPTZ '2026-08-15 21:45:00+01', TIMESTAMPTZ '2026-08-15 22:45:00+01'),
  ('Prostitute', DATE '2026-08-15', 'palco-2', TIMESTAMPTZ '2026-08-15 23:45:00+01', TIMESTAMPTZ '2026-08-16 00:35:00+01'),
  ('Dame Area', DATE '2026-08-15', 'palco-2', TIMESTAMPTZ '2026-08-16 01:35:00+01', TIMESTAMPTZ '2026-08-16 02:50:00+01'),
  ('Marie Davidson DJ Set', DATE '2026-08-15', 'palco-2', TIMESTAMPTZ '2026-08-16 02:50:00+01', TIMESTAMPTZ '2026-08-16 04:05:00+01')
) AS v(artist_name, perf_date, stage_slug, start_time, end_time)
JOIN "Stage" s ON s."slug" = v.stage_slug
WHERE p."artistName" = v.artist_name AND p."date" = v.perf_date;
