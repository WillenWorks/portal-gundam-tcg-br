-- Publicação no Instagram depois da aprovação: estado intermediário, agenda (seg/qua/sex) e token renovável

-- AlterEnum
ALTER TYPE "SocialPostStatus" ADD VALUE 'PUBLISHING' BEFORE 'PUBLISHED';

-- AlterTable
ALTER TABLE "SocialMediaPost" ADD COLUMN "instagramPermalink" TEXT,
ADD COLUMN "scheduledFor" TIMESTAMP(3),
ADD COLUMN "slotKey" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "publishError" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SocialMediaPost_slotKey_key" ON "SocialMediaPost"("slotKey");

-- CreateIndex
CREATE INDEX "SocialMediaPost_status_scheduledFor_idx" ON "SocialMediaPost"("status", "scheduledFor");

-- CreateTable
CREATE TABLE "SocialIntegrationToken" (
    "provider" TEXT NOT NULL,
    "tokenEnc" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialIntegrationToken_pkey" PRIMARY KEY ("provider")
);
