-- The Official Unofficial: LOTD's free daytime side programme (Fri 23 and
-- Sat 24 October 2026, 12:00-16:00). Sets come from scripts/import-touo.ts,
-- read off the side programme's PDF timetable; this migration adds only the
-- two columns that tell those sets apart and the four rooms the main
-- programme doesn't use. The other eight TOUO rooms (Rotown, Uniek, V11,
-- Stalles, Mono, Reijngoud, Salsability, the TR halls) are the same Stage
-- rows the main programme already has, so walking distances keep working.

ALTER TABLE "Performance" ADD COLUMN "series" TEXT;
ALTER TABLE "Performance" ADD COLUMN "host" TEXT;

-- Orders continue after Bird (25). Grouping sorts by zone first and order
-- second, so each room lands at the end of its own zone.
--
-- ADDRESSES (October 2026):
-- - Plato: Nieuwe Binnenweg 13, two doors from Stalles (rotterdamstyle.com).
-- - Tramhuis: the 1914 RET waiting house back on the Eendrachtsplein
--   (rotterdamstyle.com, uitagendarotterdam.nl). Uitagenda still lists the
--   older Hermesplantsoen 3 address, which is a couple of minutes from
--   the square either way.
-- - Zondebok & 't Zwarte Schaap: Witte de Withstraat 96 (yelp, uitagenda).
-- - Time Is The New Space: Schiekade 185 (uitagendarotterdam.nl).
INSERT INTO "Stage" ("id", "festivalId", "zoneId", "name", "slug", "address", "order", "updatedAt")
VALUES
  ('lotd26-plato',          'lotd26', 'lotd26-z-eendrachtsplein', 'Plato',                       'plato',          'Nieuwe Binnenweg 13, Rotterdam', 26, CURRENT_TIMESTAMP),
  ('lotd26-tramhuis',       'lotd26', 'lotd26-z-eendrachtsplein', 'Tramhuis',                    'tramhuis',       'Eendrachtsplein, Rotterdam',     27, CURRENT_TIMESTAMP),
  ('lotd26-zondebok',       'lotd26', 'lotd26-z-witte-de-with',   'Zondebok & ''t Zwarte Schaap', 'zondebok',       'Witte de Withstraat 96, Rotterdam', 28, CURRENT_TIMESTAMP),
  ('lotd26-time-new-space', 'lotd26', 'lotd26-z-schieblock',      'Time Is The New Space',       'time-new-space', 'Schiekade 185, Rotterdam',       29, CURRENT_TIMESTAMP);
