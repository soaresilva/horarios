-- CreateTable
CREATE TABLE "Festival" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Festival_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Festival_slug_key" ON "Festival"("slug");

-- Data migration: this app only ever held one festival's worth of data
-- (Paredes de Coura 2026) before it grew a real Festival model. Archive it
-- as that festival now, before any Stage row is asked to point at one.
-- ON CONFLICT DO NOTHING keeps this safe to re-run and lets `prisma migrate
-- dev`'s shadow-database validation (run against an empty DB) succeed too.
INSERT INTO "Festival" ("id", "slug", "name", "location", "startDate", "endDate", "timezone", "updatedAt")
VALUES ('pdc26', 'pdc26', 'Paredes de Coura 2026', 'Paredes de Coura, Portugal', '2026-08-09', '2026-08-16', 'Europe/Lisbon', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- AlterTable: add festivalId nullable first, backfill every existing Stage
-- row to pdc26 (a no-op against the empty shadow DB; a real backfill against
-- dev/prod, where all six existing stages belong to it), then tighten to
-- NOT NULL now that every row has a value.
ALTER TABLE "Stage" ADD COLUMN     "festivalId" TEXT;

UPDATE "Stage" SET "festivalId" = 'pdc26' WHERE "festivalId" IS NULL;

ALTER TABLE "Stage" ALTER COLUMN "festivalId" SET NOT NULL;

-- DropIndex
DROP INDEX "Stage_slug_key";

-- DropIndex
DROP INDEX "Stage_order_idx";

-- CreateIndex: slug only needs to be unique within a festival now — a venue
-- slug like "main-stage" may legitimately recur across different festivals.
CREATE UNIQUE INDEX "Stage_festivalId_slug_key" ON "Stage"("festivalId", "slug");

-- CreateIndex
CREATE INDEX "Stage_festivalId_order_idx" ON "Stage"("festivalId", "order");

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;
