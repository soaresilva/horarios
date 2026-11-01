-- A visitor can now hold seats in several crews. The old unique index on
-- visitorId means no duplicates exist, so the composite below can't fail on
-- existing rows.

-- DropIndex
DROP INDEX "CrewMember_visitorId_key";

-- AlterTable
ALTER TABLE "Crew" ADD COLUMN     "name" VARCHAR(20);

-- CreateIndex
CREATE INDEX "CrewMember_visitorId_idx" ON "CrewMember"("visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "CrewMember_crewId_visitorId_key" ON "CrewMember"("crewId", "visitorId");
