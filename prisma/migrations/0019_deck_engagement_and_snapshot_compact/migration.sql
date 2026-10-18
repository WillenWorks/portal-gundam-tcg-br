-- Retrofit: schema.prisma (commit 931a887) já tinha Deck.viewCount, Deck.likeCount,
-- os models DeckView/DeckLike e DeckSnapshot.compactListJson, mas nenhuma migration
-- foi gerada na hora -- o Prisma Client em produção ficou pedindo colunas/tabelas que
-- nunca existiram no banco, quebrando /api/decks/public (e likes/views de deck) com
-- PrismaClientKnownRequestError (P2022 coluna inexistente).

-- AlterTable
ALTER TABLE "Deck" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Deck" ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "DeckSnapshot" ADD COLUMN "compactListJson" JSONB;

-- CreateTable
CREATE TABLE "DeckView" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "userId" TEXT,
    "viewerHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeckView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckLike" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeckLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeckView_deckId_createdAt_idx" ON "DeckView"("deckId", "createdAt");

-- CreateIndex
CREATE INDEX "DeckView_createdAt_idx" ON "DeckView"("createdAt");

-- CreateIndex
CREATE INDEX "DeckView_viewerHash_deckId_idx" ON "DeckView"("viewerHash", "deckId");

-- CreateIndex
CREATE UNIQUE INDEX "DeckLike_deckId_userId_key" ON "DeckLike"("deckId", "userId");

-- CreateIndex
CREATE INDEX "DeckLike_deckId_idx" ON "DeckLike"("deckId");

-- CreateIndex
CREATE INDEX "DeckLike_userId_idx" ON "DeckLike"("userId");

-- AddForeignKey
ALTER TABLE "DeckView" ADD CONSTRAINT "DeckView_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckView" ADD CONSTRAINT "DeckView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckLike" ADD CONSTRAINT "DeckLike_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckLike" ADD CONSTRAINT "DeckLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
