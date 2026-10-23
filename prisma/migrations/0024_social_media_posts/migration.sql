-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "SocialPostType" AS ENUM ('CARD_SPOTLIGHT', 'DECK_FEATURE', 'META_INSIGHT', 'PRODUCT_AFFILIATE');

-- CreateTable
CREATE TABLE "SocialMediaPost" (
    "id" TEXT NOT NULL,
    "type" "SocialPostType" NOT NULL DEFAULT 'CARD_SPOTLIGHT',
    "status" "SocialPostStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "title" TEXT,
    "caption" TEXT NOT NULL,
    "cardCode" TEXT,
    "deckId" TEXT,
    "imageUrl" TEXT,
    "discordMessageId" TEXT,
    "instagramPostId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialMediaPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialMediaPost_status_idx" ON "SocialMediaPost"("status");

-- CreateIndex
CREATE INDEX "SocialMediaPost_createdAt_idx" ON "SocialMediaPost"("createdAt");
