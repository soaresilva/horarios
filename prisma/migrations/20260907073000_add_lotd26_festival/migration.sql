-- Data migration: Left of the Dial 2026 (Rotterdam, 21-24 October), its
-- walking zones, and its 26 rooms. Structure only — the schedule itself is
-- volatile and comes from scripts/import-lotd.ts, which reads the festival's
-- own act pages and never creates a Stage or Zone. An unknown venue string is
-- a hard importer failure rather than a silently invented room.
--
-- Literal ids throughout (the same pattern as 'pdc26') so reruns, the empty
-- shadow database, and the importer's foreign keys all behave.
--
-- ADDRESSES: sourced from each venue's own site where possible. Three are
-- NOT first-party confirmed and should be checked before anyone relies on a
-- walking time: BARRIO (assumed to be the former 160K at Schiekade 201),
-- THEATER ROTTERDAM (the three small halls are assumed to be at TR8, William
-- Boothlaan 8, not the Schouwburgplein building), and SALSABILITY.

INSERT INTO "Festival" ("id", "slug", "name", "location", "startDate", "endDate", "timezone", "locale", "layout", "updatedAt")
VALUES ('lotd26', 'lotd26', 'Left of the Dial 2026', 'Rotterdam, Netherlands', '2026-10-21', '2026-10-24', 'Europe/Amsterdam', 'en-GB', 'TRANSPOSED', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Zones, ordered outward from the Eendrachtsplein ticket desk, which is also
-- what makes the venue axis read as a walk across the city.
INSERT INTO "Zone" ("id", "festivalId", "name", "slug", "order", "walkMinutesFromHub")
VALUES
  ('lotd26-z-eendrachtsplein', 'lotd26', 'Eendrachtsplein',   'eendrachtsplein',  0, 2),
  ('lotd26-z-museumpark',      'lotd26', 'Museumpark',        'museumpark',       1, 4),
  ('lotd26-z-schouwburgplein', 'lotd26', 'Schouwburgplein',   'schouwburgplein',  2, 8),
  ('lotd26-z-witte-de-with',   'lotd26', 'Witte de With',     'witte-de-with',    3, 10),
  ('lotd26-z-schieblock',      'lotd26', 'Schieblock',        'schieblock',       4, 15),
  ('lotd26-z-willemsplein',    'lotd26', 'Willemsplein',      'willemsplein',     5, 16),
  ('lotd26-z-wijnhaven',       'lotd26', 'Wijnhaven',         'wijnhaven',        6, 18),
  ('lotd26-z-zoho',            'lotd26', 'ZOHO',              'zoho',             7, 22)
ON CONFLICT ("id") DO NOTHING;

-- Rooms. `order` runs zone by zone so it doubles as a sensible fallback
-- ordering anywhere zones aren't used.
INSERT INTO "Stage" ("id", "festivalId", "zoneId", "name", "slug", "address", "order", "updatedAt")
VALUES
  ('lotd26-stalles',       'lotd26', 'lotd26-z-eendrachtsplein', 'Stalles',            'stalles',       'Nieuwe Binnenweg 11A, 3014 GA Rotterdam',  0, CURRENT_TIMESTAMP),
  ('lotd26-rotown',        'lotd26', 'lotd26-z-eendrachtsplein', 'Rotown',             'rotown',        'Nieuwe Binnenweg 19, 3014 GB Rotterdam',   1, CURRENT_TIMESTAMP),
  ('lotd26-paradijskerk',  'lotd26', 'lotd26-z-eendrachtsplein', 'Paradijskerk',       'paradijskerk',  'Nieuwe Binnenweg 25, 3014 GB Rotterdam',   2, CURRENT_TIMESTAMP),
  ('lotd26-uniek',         'lotd26', 'lotd26-z-eendrachtsplein', 'Uniek',              'uniek',         'Mauritsweg 34, 3012 JT Rotterdam',         3, CURRENT_TIMESTAMP),
  ('lotd26-v2',            'lotd26', 'lotd26-z-eendrachtsplein', 'V2_',                'v2',            'Eendrachtsstraat 10, 3012 XL Rotterdam',   4, CURRENT_TIMESTAMP),

  ('lotd26-worm-1',        'lotd26', 'lotd26-z-museumpark',      'Worm 1',             'worm-1',        'Boomgaardsstraat 71, 3012 XA Rotterdam',   5, CURRENT_TIMESTAMP),
  ('lotd26-worm-2',        'lotd26', 'lotd26-z-museumpark',      'Worm 2',             'worm-2',        'Boomgaardsstraat 71, 3012 XA Rotterdam',   6, CURRENT_TIMESTAMP),
  ('lotd26-arminius-down', 'lotd26', 'lotd26-z-museumpark',      'Arminius Down',      'arminius-down', 'Museumpark 3, 3015 CB Rotterdam',          7, CURRENT_TIMESTAMP),
  ('lotd26-arminius-up',   'lotd26', 'lotd26-z-museumpark',      'Arminius Up',        'arminius-up',   'Museumpark 3, 3015 CB Rotterdam',          8, CURRENT_TIMESTAMP),

  ('lotd26-de-doelen-up',  'lotd26', 'lotd26-z-schouwburgplein', 'De Doelen Up',       'de-doelen-up',  'Schouwburgplein 50, 3012 CL Rotterdam',    9, CURRENT_TIMESTAMP),
  ('lotd26-de-doelen-wbh', 'lotd26', 'lotd26-z-schouwburgplein', 'De Doelen WBH',      'de-doelen-wbh', 'Kruisplein 40, 3012 CC Rotterdam',        10, CURRENT_TIMESTAMP),

  ('lotd26-tr-up',         'lotd26', 'lotd26-z-witte-de-with',   'TR Up',              'tr-up',         'William Boothlaan 8, 3012 VJ Rotterdam',  11, CURRENT_TIMESTAMP),
  ('lotd26-tr-down',       'lotd26', 'lotd26-z-witte-de-with',   'TR Down',            'tr-down',       'William Boothlaan 8, 3012 VJ Rotterdam',  12, CURRENT_TIMESTAMP),
  ('lotd26-tr-foyer',      'lotd26', 'lotd26-z-witte-de-with',   'TR Foyer',           'tr-foyer',      'William Boothlaan 8, 3012 VJ Rotterdam',  13, CURRENT_TIMESTAMP),
  ('lotd26-baanhof',       'lotd26', 'lotd26-z-witte-de-with',   'Baanhof',            'baanhof',       'Baan 159, 3011 CA Rotterdam',             14, CURRENT_TIMESTAMP),
  ('lotd26-waalse-kerk',   'lotd26', 'lotd26-z-witte-de-with',   'Waalse Kerk',        'waalse-kerk',   'Schiedamse Vest 190, 3011 BH Rotterdam',  15, CURRENT_TIMESTAMP),

  ('lotd26-annabel-down',  'lotd26', 'lotd26-z-schieblock',      'Annabel Down',       'annabel-down',  'Schiestraat 20, 3013 AH Rotterdam',       16, CURRENT_TIMESTAMP),
  ('lotd26-annabel-up',    'lotd26', 'lotd26-z-schieblock',      'Annabel Up',         'annabel-up',    'Schiestraat 20, 3013 AH Rotterdam',       17, CURRENT_TIMESTAMP),
  ('lotd26-sahara',        'lotd26', 'lotd26-z-schieblock',      'Sahara',             'sahara',        'Schiestraat 18, 3013 AH Rotterdam',       18, CURRENT_TIMESTAMP),
  ('lotd26-barrio',        'lotd26', 'lotd26-z-schieblock',      'Barrio',             'barrio',        'Schiekade 201, 3013 BR Rotterdam',        19, CURRENT_TIMESTAMP),
  ('lotd26-salsability',   'lotd26', 'lotd26-z-schieblock',      'Salsability',        'salsability',   'Delftseplein 36, 3013 AA Rotterdam',      20, CURRENT_TIMESTAMP),

  ('lotd26-remastered',    'lotd26', 'lotd26-z-willemsplein',    'Remastered',         'remastered',    'Willemsplein 79, 3016 DR Rotterdam',      21, CURRENT_TIMESTAMP),

  ('lotd26-v11',           'lotd26', 'lotd26-z-wijnhaven',       'V11',                'v11',           'Wijnhaven 101B, 3011 WN Rotterdam',       22, CURRENT_TIMESTAMP),

  ('lotd26-mono',          'lotd26', 'lotd26-z-zoho',            'Mono',               'mono',          'Vijverhofstraat 15, 3032 SB Rotterdam',   23, CURRENT_TIMESTAMP),
  ('lotd26-reijngoud',     'lotd26', 'lotd26-z-zoho',            'Reijngoud',          'reijngoud',     'Vijverhofstraat 10, 3032 SN Rotterdam',   24, CURRENT_TIMESTAMP),
  ('lotd26-bird',          'lotd26', 'lotd26-z-zoho',            'Bird',               'bird',          'Raampoortstraat 26, 3032 AH Rotterdam',   25, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Walking minutes between every pair of zones. Stored once per unordered
-- pair; walkMinutesBetween() checks both directions.
INSERT INTO "ZoneWalk" ("id", "fromZoneId", "toZoneId", "minutes")
VALUES
  ('lotd26-w-eend-muse', 'lotd26-z-eendrachtsplein', 'lotd26-z-museumpark',       4),
  ('lotd26-w-eend-scho', 'lotd26-z-eendrachtsplein', 'lotd26-z-schouwburgplein',  8),
  ('lotd26-w-eend-witt', 'lotd26-z-eendrachtsplein', 'lotd26-z-witte-de-with',   10),
  ('lotd26-w-eend-schi', 'lotd26-z-eendrachtsplein', 'lotd26-z-schieblock',      15),
  ('lotd26-w-eend-will', 'lotd26-z-eendrachtsplein', 'lotd26-z-willemsplein',    16),
  ('lotd26-w-eend-wijn', 'lotd26-z-eendrachtsplein', 'lotd26-z-wijnhaven',       18),
  ('lotd26-w-eend-zoho', 'lotd26-z-eendrachtsplein', 'lotd26-z-zoho',            22),

  ('lotd26-w-muse-scho', 'lotd26-z-museumpark',      'lotd26-z-schouwburgplein',  7),
  ('lotd26-w-muse-witt', 'lotd26-z-museumpark',      'lotd26-z-witte-de-with',    8),
  ('lotd26-w-muse-schi', 'lotd26-z-museumpark',      'lotd26-z-schieblock',      16),
  ('lotd26-w-muse-will', 'lotd26-z-museumpark',      'lotd26-z-willemsplein',    15),
  ('lotd26-w-muse-wijn', 'lotd26-z-museumpark',      'lotd26-z-wijnhaven',       17),
  ('lotd26-w-muse-zoho', 'lotd26-z-museumpark',      'lotd26-z-zoho',            23),

  ('lotd26-w-scho-witt', 'lotd26-z-schouwburgplein', 'lotd26-z-witte-de-with',    6),
  ('lotd26-w-scho-schi', 'lotd26-z-schouwburgplein', 'lotd26-z-schieblock',       8),
  ('lotd26-w-scho-will', 'lotd26-z-schouwburgplein', 'lotd26-z-willemsplein',    15),
  ('lotd26-w-scho-wijn', 'lotd26-z-schouwburgplein', 'lotd26-z-wijnhaven',       13),
  ('lotd26-w-scho-zoho', 'lotd26-z-schouwburgplein', 'lotd26-z-zoho',            15),

  ('lotd26-w-witt-schi', 'lotd26-z-witte-de-with',   'lotd26-z-schieblock',      12),
  ('lotd26-w-witt-will', 'lotd26-z-witte-de-with',   'lotd26-z-willemsplein',     8),
  ('lotd26-w-witt-wijn', 'lotd26-z-witte-de-with',   'lotd26-z-wijnhaven',        8),
  ('lotd26-w-witt-zoho', 'lotd26-z-witte-de-with',   'lotd26-z-zoho',            19),

  ('lotd26-w-schi-will', 'lotd26-z-schieblock',      'lotd26-z-willemsplein',    20),
  ('lotd26-w-schi-wijn', 'lotd26-z-schieblock',      'lotd26-z-wijnhaven',       15),
  ('lotd26-w-schi-zoho', 'lotd26-z-schieblock',      'lotd26-z-zoho',             8),

  ('lotd26-w-will-wijn', 'lotd26-z-willemsplein',    'lotd26-z-wijnhaven',        9),
  ('lotd26-w-will-zoho', 'lotd26-z-willemsplein',    'lotd26-z-zoho',            27),

  ('lotd26-w-wijn-zoho', 'lotd26-z-wijnhaven',       'lotd26-z-zoho',            21)
ON CONFLICT ("id") DO NOTHING;
