-- Data migration: London Calling October 2026 (edition 34; Amsterdam, Fri 30
-- and Sat 31 October) and its four rooms. Structure only: the sets come from
-- scripts/import-lc.ts, which reads the committed snapshot
-- scripts/data/lc26oct.json and never creates a Stage. An unknown room slug
-- is a hard importer failure rather than a silently invented room.
--
-- Slug carries the month because London Calling runs twice a year (April
-- and October): a bare 'lc26' would be ambiguous by spring.
--
-- Three rooms a night, drawn as three side-by-side columns (gridColumns: 3
-- in src/lib/festival-copy.ts): the two Paradiso halls both nights, plus De
-- Kring on Friday and Barlaeus on Saturday. `order` is the poster's column
-- order; De Kring and Barlaeus never share a night, so both sit third.
--
-- Literal ids throughout (same pattern as 'pdc26' and 'lotd26') so reruns,
-- the empty shadow database, and the importer's foreign keys all behave.
-- Addresses left null: the vertical layout doesn't link venues to a map.

INSERT INTO "Festival" ("id", "slug", "name", "location", "startDate", "endDate", "timezone", "locale", "layout", "updatedAt")
VALUES ('lc26oct', 'lc26oct', 'London Calling October 2026', 'Amsterdam, Netherlands', '2026-10-30', '2026-10-31', 'Europe/Amsterdam', 'en-GB', 'VERTICAL', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Stage" ("id", "festivalId", "name", "slug", "order", "updatedAt")
VALUES
  ('lc26oct-small-hall', 'lc26oct', 'Small Hall Paradiso', 'small-hall', 0, CURRENT_TIMESTAMP),
  ('lc26oct-main-hall',  'lc26oct', 'Main Hall Paradiso',  'main-hall',  1, CURRENT_TIMESTAMP),
  ('lc26oct-de-kring',   'lc26oct', 'De Kring',            'de-kring',   2, CURRENT_TIMESTAMP),
  ('lc26oct-barlaeus',   'lc26oct', 'Barlaeus',            'barlaeus',   2, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
