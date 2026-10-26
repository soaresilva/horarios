-- AlterTable
ALTER TABLE "Festival" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

-- At most one featured festival (Prisma can't express a partial index).
CREATE UNIQUE INDEX "Festival_single_featured" ON "Festival" ("featured") WHERE "featured" = true;
