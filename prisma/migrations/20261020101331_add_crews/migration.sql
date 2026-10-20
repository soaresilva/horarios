-- CreateTable
CREATE TABLE "Crew" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Crew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewMember" (
    "id" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "tag" VARCHAR(2) NOT NULL,
    "tagKey" VARCHAR(2) NOT NULL,
    "colorIndex" INTEGER NOT NULL,
    "shareNotes" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrewMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Crew_code_key" ON "Crew"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CrewMember_visitorId_key" ON "CrewMember"("visitorId");

-- CreateIndex
CREATE INDEX "CrewMember_crewId_idx" ON "CrewMember"("crewId");

-- CreateIndex
CREATE UNIQUE INDEX "CrewMember_crewId_tagKey_key" ON "CrewMember"("crewId", "tagKey");

-- AddForeignKey
ALTER TABLE "CrewMember" ADD CONSTRAINT "CrewMember_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew"("id") ON DELETE CASCADE ON UPDATE CASCADE;
