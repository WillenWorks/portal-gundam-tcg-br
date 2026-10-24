-- Agenda semanal do Instagram: post de torneios (segunda) e carrossel com várias imagens

-- AlterEnum
ALTER TYPE "SocialPostType" ADD VALUE 'TOURNAMENT_REPORT';

-- AlterTable
ALTER TABLE "SocialMediaPost" ADD COLUMN "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
