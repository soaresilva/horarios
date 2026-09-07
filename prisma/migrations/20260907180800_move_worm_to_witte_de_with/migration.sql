-- Correction: Worm 1 and Worm 2 belong to the Witte de With zone, not
-- Museumpark. They were misassigned in 20260907073000_add_lotd26_festival.
-- That migration is already applied (a later one sits on top of it), so it
-- can't be edited in place — this moves the two rooms with an UPDATE instead.

UPDATE "Stage"
SET "zoneId" = 'lotd26-z-witte-de-with', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN ('lotd26-worm-1', 'lotd26-worm-2');
