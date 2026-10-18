-- Rename Le Guess Who?'s "Neude" walking zone (Jacobikerk, EKKO, Kapitaal,
-- BAK / Basecamp) to "Wijk C/Pijlsweerd", at Diogo's request. Only the
-- display name changes: the id and slug stay 'lgw26-z-neude' / 'neude',
-- because the Stage and ZoneWalk rows reference them. scripts/lgw/venues.ts
-- carries the new name, and `createdAs` for the original one.
UPDATE "Zone" SET "name" = 'Wijk C/Pijlsweerd' WHERE "id" = 'lgw26-z-neude';
