-- Fase B do plano "reorganização do admin + hoster": trava de deck com decklist
-- congelada (DeckSnapshot/DeckSnapshotItem), participantes de eventos do Hoster
-- (HostedEventParticipant, sempre usuário cadastrado, diferente do TournamentEntry
-- de report que aceita jogador convidado) e o mesmo retrofit no TournamentEntry pra
-- resolver o gap: hoje o deckId aponta pro Deck vivo, então editar/apagar o deck
-- depois perderia a decklist usada no resultado histórico.

-- CreateTable
CREATE TABLE "DeckSnapshot" (
    "id" TEXT NOT NULL,
    "sourceDeckId" TEXT,
    "sourceUserId" TEXT,
    "name" TEXT NOT NULL,
    "format" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeckSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckSnapshotItem" (
    "id" TEXT NOT NULL,
    "deckSnapshotId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "section" TEXT NOT NULL DEFAULT 'main',
    CONSTRAINT "DeckSnapshotItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostedEventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deckId" TEXT,
    "deckSnapshotId" TEXT,
    "deckLockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HostedEventParticipant_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "TournamentEntry" ADD COLUMN "deckSnapshotId" TEXT;

-- CreateIndex
CREATE INDEX "DeckSnapshot_sourceDeckId_idx" ON "DeckSnapshot"("sourceDeckId");

-- CreateIndex
CREATE INDEX "DeckSnapshot_sourceUserId_idx" ON "DeckSnapshot"("sourceUserId");

-- CreateIndex
CREATE INDEX "DeckSnapshotItem_deckSnapshotId_idx" ON "DeckSnapshotItem"("deckSnapshotId");

-- CreateIndex
CREATE INDEX "DeckSnapshotItem_cardId_idx" ON "DeckSnapshotItem"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "HostedEventParticipant_eventId_userId_key" ON "HostedEventParticipant"("eventId", "userId");

-- CreateIndex
CREATE INDEX "HostedEventParticipant_eventId_idx" ON "HostedEventParticipant"("eventId");

-- CreateIndex
CREATE INDEX "HostedEventParticipant_userId_idx" ON "HostedEventParticipant"("userId");

-- AddForeignKey
ALTER TABLE "DeckSnapshot" ADD CONSTRAINT "DeckSnapshot_sourceDeckId_fkey" FOREIGN KEY ("sourceDeckId") REFERENCES "Deck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckSnapshot" ADD CONSTRAINT "DeckSnapshot_sourceUserId_fkey" FOREIGN KEY ("sourceUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckSnapshotItem" ADD CONSTRAINT "DeckSnapshotItem_deckSnapshotId_fkey" FOREIGN KEY ("deckSnapshotId") REFERENCES "DeckSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckSnapshotItem" ADD CONSTRAINT "DeckSnapshotItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostedEventParticipant" ADD CONSTRAINT "HostedEventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HostedEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostedEventParticipant" ADD CONSTRAINT "HostedEventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostedEventParticipant" ADD CONSTRAINT "HostedEventParticipant_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostedEventParticipant" ADD CONSTRAINT "HostedEventParticipant_deckSnapshotId_fkey" FOREIGN KEY ("deckSnapshotId") REFERENCES "DeckSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_deckSnapshotId_fkey" FOREIGN KEY ("deckSnapshotId") REFERENCES "DeckSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
