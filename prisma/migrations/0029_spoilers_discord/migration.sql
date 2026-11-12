-- Spoilers capturados do canal seguido do Discord: cada imagem vira um SpoilerCapture; os do dia viram um
-- SpoilerDigest (artigo + carrossel + stories) aprovado de uma vez.

-- AlterEnum
ALTER TYPE "SocialPostType" ADD VALUE 'SPOILER_DIGEST';

-- CreateEnum
CREATE TYPE "SpoilerCaptureStatus" AS ENUM ('CAPTURED', 'FAILED', 'DIGESTED');

-- CreateEnum
CREATE TYPE "SpoilerDigestStatus" AS ENUM ('PENDING_APPROVAL', 'PUBLISHED', 'REJECTED');

-- CreateTable
CREATE TABLE "SpoilerDigest" (
    "id" TEXT NOT NULL,
    "status" "SpoilerDigestStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "setCode" TEXT,
    "articleId" TEXT,
    "socialPostId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpoilerDigest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpoilerCapture" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "discordMessageId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "messageText" TEXT,
    "imageUrl" TEXT NOT NULL,
    "status" "SpoilerCaptureStatus" NOT NULL DEFAULT 'CAPTURED',
    "extracted" JSONB,
    "cardCode" TEXT,
    "cardModelId" TEXT,
    "error" TEXT,
    "digestId" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpoilerCapture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpoilerCapture_sourceKey_key" ON "SpoilerCapture"("sourceKey");

-- CreateIndex
CREATE INDEX "SpoilerCapture_status_postedAt_idx" ON "SpoilerCapture"("status", "postedAt");

-- CreateIndex
CREATE INDEX "SpoilerCapture_digestId_idx" ON "SpoilerCapture"("digestId");

-- AddForeignKey
ALTER TABLE "SpoilerCapture" ADD CONSTRAINT "SpoilerCapture_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "SpoilerDigest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
