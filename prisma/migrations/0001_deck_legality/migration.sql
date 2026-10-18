-- CreateTable
CREATE TABLE "CardBanGroup" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maxDistinct" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CardBanGroup_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CardModel" ADD COLUMN "restrictedCopies" INTEGER;
ALTER TABLE "CardModel" ADD COLUMN "banGroupId" TEXT;

-- AddForeignKey
ALTER TABLE "CardModel" ADD CONSTRAINT "CardModel_banGroupId_fkey" FOREIGN KEY ("banGroupId") REFERENCES "CardBanGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "CardModel_banGroupId_idx" ON "CardModel"("banGroupId");
