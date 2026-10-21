-- CreateTable
CREATE TABLE "HiddenAct" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "actKey" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiddenAct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HiddenAct_visitorId_idx" ON "HiddenAct"("visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "HiddenAct_visitorId_festivalId_actKey_key" ON "HiddenAct"("visitorId", "festivalId", "actKey");

-- AddForeignKey
ALTER TABLE "HiddenAct" ADD CONSTRAINT "HiddenAct_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;
