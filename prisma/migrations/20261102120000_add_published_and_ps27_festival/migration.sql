-- Festival.published: false keeps an edition admin-only. Defaults to true so
-- every existing festival stays public.
ALTER TABLE "Festival" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true;

-- Data migration: Primavera Sound Barcelona 2027 (Parc del Fòrum, Wed 2 to
-- Sun 6 June 2027). Structure only: the sets come from scripts/import-ps.ts,
-- which reads the committed snapshot scripts/data/ps27.json and never creates
-- a Stage. Those sets are a GUESS: the festival has published only the day
-- split, so this row starts unpublished.
--
-- Stages: Diogo's seven for Thursday to Saturday, plus the three PS26 stages
-- that take the small print (145 poster acts against 104 sets on the seven in
-- PS26). "Parc del Fòrum" is the single stage on Wednesday and Sunday, where
-- the real stage isn't known either. It sits first so `order` reads top down.
--
-- Literal ids throughout (same pattern as 'pdc26' and 'lc26oct') so reruns,
-- the empty shadow database, and the importer's foreign keys all behave.
INSERT INTO "Festival" ("id", "slug", "name", "location", "startDate", "endDate", "timezone", "locale", "layout", "published", "updatedAt")
VALUES ('ps27', 'ps27', 'Primavera Sound Barcelona 2027', 'Parc del Fòrum, Barcelona', '2027-06-02', '2027-06-06', 'Europe/Madrid', 'en-GB', 'TRANSPOSED', false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Stage" ("id", "festivalId", "name", "slug", "order", "updatedAt")
VALUES
  ('ps27-parc-del-forum',    'ps27', 'Parc del Fòrum',    'parc-del-forum',    0,  CURRENT_TIMESTAMP),
  ('ps27-estrella-damm',     'ps27', 'Estrella Damm',     'estrella-damm',     1,  CURRENT_TIMESTAMP),
  ('ps27-revolut',           'ps27', 'Revolut',           'revolut',           2,  CURRENT_TIMESTAMP),
  ('ps27-occident',          'ps27', 'Occident',          'occident',          3,  CURRENT_TIMESTAMP),
  ('ps27-cupra',             'ps27', 'Cupra',             'cupra',             4,  CURRENT_TIMESTAMP),
  ('ps27-schwarzkopf',       'ps27', 'Schwarzkopf',       'schwarzkopf',       5,  CURRENT_TIMESTAMP),
  ('ps27-port',              'ps27', 'Port',              'port',              6,  CURRENT_TIMESTAMP),
  ('ps27-auditori-rockdelux','ps27', 'Auditori Rockdelux','auditori-rockdelux',7,  CURRENT_TIMESTAMP),
  ('ps27-cupra-pulse',       'ps27', 'Cupra Pulse',       'cupra-pulse',       8,  CURRENT_TIMESTAMP),
  ('ps27-levis-warehouse',   'ps27', 'The Levi''s Warehouse','levis-warehouse',9,  CURRENT_TIMESTAMP),
  ('ps27-plenitude',         'ps27', 'Plenitude',         'plenitude',         10, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
