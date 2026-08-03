-- Data migration (no schema change): add the bonus 16 Aug afterparty
-- performances at the existing Jazz na Relva stage. Runs through the normal
-- deploy pipeline (prisma migrate deploy) so it lands on Neon without
-- re-running the seed's deleteMany — the admin-entered performances are
-- left untouched. No Stage row needed, jazz-na-relva already exists.
--
-- Times carry an explicit +01:00 offset (mainland Portugal is WEST/UTC+1
-- all August), so they store as the correct UTC instant regardless of the
-- migration connection's session timezone. createdAt/recommended fall back
-- to their column defaults; updatedAt has no default.
--
-- Dupplo's set (04:20-06:15) straddles the app's 06:00 "next calendar day"
-- roll boundary (see FESTIVAL_DAY_ROLL_HOUR in src/lib/time.ts) — that's why
-- it's set here as a literal timestamp rather than through the admin's
-- HH:MM pickers, which would misresolve it.
--
-- jazz-na-relva itself was only ever created by prisma/seed.ts, not a prior
-- migration, so it doesn't exist in a from-scratch shadow/CI database. This
-- ON CONFLICT DO NOTHING insert is a no-op against the real dev/prod DB
-- (already seeded, keeps its real id) but keeps `prisma migrate dev`'s
-- shadow-DB validation passing, same pattern as the quarto-mundo stage
-- migration's own self-contained insert.
INSERT INTO "Stage" ("id", "name", "slug", "order")
VALUES ('jazz-na-relva', 'Jazz na Relva by Pleno', 'jazz-na-relva', 4)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Performance" ("id", "artistName", "date", "startTime", "endTime", "stageId", "updatedAt")
VALUES
  ('jazz-na-relva-2026-08-16-dupplo', 'Dupplo', '2026-08-16', '2026-08-16 04:20:00+01', '2026-08-16 06:15:00+01', (SELECT "id" FROM "Stage" WHERE "slug" = 'jazz-na-relva'), CURRENT_TIMESTAMP),
  ('jazz-na-relva-2026-08-16-armanda', 'Armanda', '2026-08-16', '2026-08-16 06:15:00+01', '2026-08-16 08:00:00+01', (SELECT "id" FROM "Stage" WHERE "slug" = 'jazz-na-relva'), CURRENT_TIMESTAMP),
  ('jazz-na-relva-2026-08-16-quarto-mundo', 'Quarto Mundo', '2026-08-16', '2026-08-16 15:00:00+01', '2026-08-16 17:00:00+01', (SELECT "id" FROM "Stage" WHERE "slug" = 'jazz-na-relva'), CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
