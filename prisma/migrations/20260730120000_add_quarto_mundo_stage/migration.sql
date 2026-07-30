-- Data migration (no schema change): add the "Quarto Mundo Sessions by
-- Cabriz" side-programme stage and its 10-15 Aug daytime sets, and reorder
-- the existing side stages to sit below it. Runs through the normal deploy
-- pipeline (prisma migrate deploy) so it lands on Neon without re-running the
-- seed's deleteMany — the admin-entered performances are left untouched.

INSERT INTO "Stage" ("id", "name", "slug", "order")
VALUES ('quarto-mundo', 'Quarto Mundo Sessions by Cabriz', 'quarto-mundo', 3)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "Stage" SET "order" = 4 WHERE "slug" = 'jazz-na-relva';
UPDATE "Stage" SET "order" = 5 WHERE "slug" = 'xapas-lounge';

-- One 11:00-15:00 set per day. Times carry an explicit +01:00 offset (mainland
-- Portugal is WEST/UTC+1 all August), so they store as the correct UTC instant
-- regardless of the migration connection's session timezone. createdAt/
-- recommended fall back to their column defaults; updatedAt has no default.
INSERT INTO "Performance" ("id", "artistName", "date", "startTime", "endTime", "stageId", "updatedAt")
VALUES
  ('quarto-mundo-2026-08-10', 'Quarto Mundo', '2026-08-10', '2026-08-10 11:00:00+01', '2026-08-10 15:00:00+01', 'quarto-mundo', CURRENT_TIMESTAMP),
  ('quarto-mundo-2026-08-11', 'James Keating', '2026-08-11', '2026-08-11 11:00:00+01', '2026-08-11 15:00:00+01', 'quarto-mundo', CURRENT_TIMESTAMP),
  ('quarto-mundo-2026-08-12', 'Quarto Mundo', '2026-08-12', '2026-08-12 11:00:00+01', '2026-08-12 15:00:00+01', 'quarto-mundo', CURRENT_TIMESTAMP),
  ('quarto-mundo-2026-08-13', 'Sounzstore', '2026-08-13', '2026-08-13 11:00:00+01', '2026-08-13 15:00:00+01', 'quarto-mundo', CURRENT_TIMESTAMP),
  ('quarto-mundo-2026-08-14', 'Quarto Mundo', '2026-08-14', '2026-08-14 11:00:00+01', '2026-08-14 15:00:00+01', 'quarto-mundo', CURRENT_TIMESTAMP),
  ('quarto-mundo-2026-08-15', 'Trol2000', '2026-08-15', '2026-08-15 11:00:00+01', '2026-08-15 15:00:00+01', 'quarto-mundo', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
