-- CreateTable: a cluster of venues within trivial walking distance of each
-- other. Timetable rows group by zone so the venue axis doubles as a map.
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "walkMinutesFromHub" INTEGER,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable: approximate walking minutes between two zones, one row per
-- unordered pair. Not derived from walkMinutesFromHub — two zones equidistant
-- from the hub can be adjacent or far apart, so a difference would be wrong.
CREATE TABLE "ZoneWalk" (
    "id" TEXT NOT NULL,
    "fromZoneId" TEXT NOT NULL,
    "toZoneId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,

    CONSTRAINT "ZoneWalk_pkey" PRIMARY KEY ("id")
);

-- CreateTable: per-festival artist reference data, written by the importer.
-- Paredes de Coura does not use this — its links stay in artist-links.ts.
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "genres" TEXT,
    "spotifyUrl" TEXT,
    "instagramUrl" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zone_festivalId_slug_key" ON "Zone"("festivalId", "slug");
CREATE INDEX "Zone_festivalId_order_idx" ON "Zone"("festivalId", "order");
CREATE UNIQUE INDEX "ZoneWalk_fromZoneId_toZoneId_key" ON "ZoneWalk"("fromZoneId", "toZoneId");
CREATE UNIQUE INDEX "Artist_festivalId_slug_key" ON "Artist"("festivalId", "slug");

-- AlterTable: rooms gain a zone and a street address. Both nullable, so
-- Paredes de Coura's six stages are untouched and the vertical layout never
-- reads either.
ALTER TABLE "Stage"
  ADD COLUMN "zoneId" TEXT,
  ADD COLUMN "address" TEXT;

CREATE INDEX "Stage_festivalId_zoneId_order_idx" ON "Stage"("festivalId", "zoneId", "order");

-- AlterTable: optional link to imported artist reference data. artistName
-- stays NOT NULL and remains what the admin edits and the grid renders.
ALTER TABLE "Performance" ADD COLUMN "artistId" TEXT;

CREATE INDEX "Performance_artistId_idx" ON "Performance"("artistId");

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ZoneWalk" ADD CONSTRAINT "ZoneWalk_fromZoneId_fkey" FOREIGN KEY ("fromZoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ZoneWalk" ADD CONSTRAINT "ZoneWalk_toZoneId_fkey" FOREIGN KEY ("toZoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SetNull, not Cascade: deleting a zone must not delete its rooms, and
-- deleting an artist must never delete a scheduled set.
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
