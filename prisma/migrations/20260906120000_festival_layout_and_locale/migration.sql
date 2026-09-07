-- CreateEnum
CREATE TYPE "TimetableLayout" AS ENUM ('VERTICAL', 'TRANSPOSED');

-- AlterTable: how each festival's timetable is drawn, and which locale its
-- day labels read in. Both default to Paredes de Coura's existing behaviour
-- (a vertical grid with Portuguese weekday abbreviations), so the one
-- existing row needs no backfill and nothing about /pdc26 changes.
ALTER TABLE "Festival"
  ADD COLUMN "layout" "TimetableLayout" NOT NULL DEFAULT 'VERTICAL',
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'pt-PT';
