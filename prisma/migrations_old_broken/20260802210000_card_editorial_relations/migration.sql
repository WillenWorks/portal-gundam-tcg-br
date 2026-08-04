CREATE TYPE "CardRelationType" AS ENUM ('PILOT_OF', 'SUPPORTS', 'UPGRADE_OF', 'SAME_ARCHETYPE', 'STORY_RELATED');

CREATE TABLE "CardRelation" (
  "id" TEXT NOT NULL,
  "sourceCardId" TEXT NOT NULL,
  "targetCardId" TEXT NOT NULL,
  "relationType" "CardRelationType" NOT NULL,
  "notePt" TEXT,
  "sourceUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CardRelation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CardRelation_sourceCardId_fkey" FOREIGN KEY ("sourceCardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CardRelation_targetCardId_fkey" FOREIGN KEY ("targetCardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CardRelation_sourceCardId_targetCardId_relationType_key" ON "CardRelation"("sourceCardId", "targetCardId", "relationType");
CREATE INDEX "CardRelation_sourceCardId_isActive_idx" ON "CardRelation"("sourceCardId", "isActive");
CREATE INDEX "CardRelation_targetCardId_isActive_idx" ON "CardRelation"("targetCardId", "isActive");
