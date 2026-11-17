-- Apoiadores (campanha no Apoia.se) e tags de usuário.
-- - User.supporterTier: patente do apoiador (RECRUTA, PILOTO, AS, COMANDANTE — catálogo em src/lib/supporters.ts).
-- - User.supporterClaimedAt: pedido de "já apoiei" feito pela própria pessoa; só vira apoiador quando o admin aprova
--   (antes o pedido já dava o selo, sem conferência).
-- - UserTag: marcas de reconhecimento dadas pelo admin; uma conta pode ter várias.
-- - SupporterWallEntry: nome no mural de quem apoia pelo Apoia.se sem ter conta no site.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "supporterTier" TEXT;
ALTER TABLE "User" ADD COLUMN "supporterClaimedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserTag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupporterWallEntry" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "tier" TEXT,
    "message" TEXT,
    "since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupporterWallEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserTag_userId_tag_key" ON "UserTag"("userId", "tag");

-- CreateIndex
CREATE INDEX "UserTag_tag_idx" ON "UserTag"("tag");

-- CreateIndex
CREATE INDEX "User_supporterClaimedAt_idx" ON "User"("supporterClaimedAt");

-- AddForeignKey
ALTER TABLE "UserTag" ADD CONSTRAINT "UserTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
