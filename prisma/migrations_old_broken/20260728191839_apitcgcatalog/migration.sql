/*
  Warnings:

  - A unique constraint covering the columns `[shareId]` on the table `Deck` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[kind,name]` on the table `TaxonomyEntry` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[kind,slug]` on the table `TaxonomyEntry` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `cardType` on the `Card` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - The required column `shareId` was added to the `Deck` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Changed the type of `kind` on the `TaxonomyEntry` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `username` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CardLanguage" AS ENUM ('PT_BR', 'EN');

-- CreateEnum
CREATE TYPE "BinderKind" AS ENUM ('WISHLIST', 'OWNED');

-- CreateEnum
CREATE TYPE "SetKind" AS ENUM ('BOOSTER_PACK', 'STARTER_DECK', 'ACCESSORIES', 'PREMIUM_BANDAI', 'OTHER');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('UNIT', 'PILOT', 'COMMAND', 'COMMAND_PILOT', 'BASE', 'RESOURCE', 'EX_BASE', 'EX_RESOURCE', 'UNIT_TOKEN');

-- CreateEnum
CREATE TYPE "TaxonomyKind" AS ENUM ('TRAIT', 'SOURCE_TITLE');

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "cardSubtypes" TEXT[],
ADD COLUMN     "effectKeywords" TEXT[],
ADD COLUMN     "hasAction" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasBurst" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasMain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linkText" TEXT,
ADD COLUMN     "metadataJson" JSONB,
ADD COLUMN     "officialUrl" TEXT,
ADD COLUMN     "oncePerTurn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pilotName" TEXT,
ADD COLUMN     "sourceTitle" TEXT,
ADD COLUMN     "textSectionsJson" JSONB,
ADD COLUMN     "thumbUrl" TEXT,
ADD COLUMN     "traits" TEXT[],
ADD COLUMN     "triggerKeywords" TEXT[],
ADD COLUMN     "zone" TEXT,
DROP COLUMN "cardType",
ADD COLUMN     "cardType" "CardType" NOT NULL;

-- AlterTable
ALTER TABLE "CardSet" ADD COLUMN     "contentSummaryEn" TEXT,
ADD COLUMN     "contentSummaryPt" TEXT,
ADD COLUMN     "coverImage" TEXT,
ADD COLUMN     "metadataJson" JSONB,
ADD COLUMN     "msrpUsd" DOUBLE PRECISION,
ADD COLUMN     "officialUrl" TEXT,
ADD COLUMN     "productCodeAlt" TEXT,
ADD COLUMN     "productNotes" TEXT,
ADD COLUMN     "raritySummary" TEXT,
ADD COLUMN     "setType" "SetKind" NOT NULL DEFAULT 'BOOSTER_PACK',
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "sourceTitles" TEXT[],
ADD COLUMN     "starterDeckVariantOf" TEXT;

-- AlterTable
ALTER TABLE "Deck" ADD COLUMN     "featuredCardIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "shareId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Ruling" ADD COLUMN     "originalUrl" TEXT;

-- AlterTable
ALTER TABLE "TaxonomyEntry" DROP COLUMN "kind",
ADD COLUMN     "kind" "TaxonomyKind" NOT NULL,
ADD CONSTRAINT "TaxonomyEntry_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "preferredCardLanguage" "CardLanguage" NOT NULL DEFAULT 'PT_BR',
ADD COLUMN     "preferredTheme" TEXT DEFAULT 'dark',
ADD COLUMN     "username" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "CardBinder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "BinderKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shareId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardBinder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardBinderItem" (
    "id" TEXT NOT NULL,
    "binderId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,

    CONSTRAINT "CardBinderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardBinder_shareId_key" ON "CardBinder"("shareId");

-- CreateIndex
CREATE UNIQUE INDEX "CardBinder_userId_kind_key" ON "CardBinder"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "CardBinderItem_binderId_cardId_key" ON "CardBinderItem"("binderId", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "Deck_shareId_key" ON "Deck"("shareId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyEntry_kind_name_key" ON "TaxonomyEntry"("kind", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyEntry_kind_slug_key" ON "TaxonomyEntry"("kind", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "CardBinder" ADD CONSTRAINT "CardBinder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardBinderItem" ADD CONSTRAINT "CardBinderItem_binderId_fkey" FOREIGN KEY ("binderId") REFERENCES "CardBinder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardBinderItem" ADD CONSTRAINT "CardBinderItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
