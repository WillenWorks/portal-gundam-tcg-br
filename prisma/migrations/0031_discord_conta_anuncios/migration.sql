-- Discord do Anaheim Hub.
-- - User.discordId/discordUsername/discordLinkedAt: conta do Discord conectada pelo perfil; o bot dá o cargo da
--   patente de apoiador e das tags no servidor.
-- - DiscordAnnouncement: o que o bot já anunciou (artigo, spoiler, torneio), para não postar duas vezes.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "discordId" TEXT;
ALTER TABLE "User" ADD COLUMN "discordUsername" TEXT;
ALTER TABLE "User" ADD COLUMN "discordLinkedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DiscordAnnouncement" (
    "key" TEXT NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordAnnouncement_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");
