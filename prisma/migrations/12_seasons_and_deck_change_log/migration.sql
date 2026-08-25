-- Season como model real (código, nome, datas, flag "atual") + vínculo em CardSet,
-- Tournament e HostedEvent -- resolve o pedido do usuário de tratar temporada como
-- dado estrutural (não texto livre), preparado pro futuro sistema de rotação. Só
-- uma Season deve ter isCurrent=true por vez (garantido em aplicação, não em SQL).
-- Tournament.season (texto livre) é mantido como legado -- torneios antigos não têm
-- como ser reclassificados com certeza.
--
-- TournamentEntryDeckChangeLog: auditoria de troca do deckId vinculado a um
-- TournamentEntry já registrado. O report retroativo não trava de forma rígida
-- como o HostedEventParticipant (o admin pode corrigir um vínculo errado), mas toda
-- troca fica logada -- quem trocou, quando, qual era o snapshot anterior.

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentEntryDeckChangeLog" (
    "id" TEXT NOT NULL,
    "tournamentEntryId" TEXT NOT NULL,
    "previousDeckId" TEXT,
    "previousDeckSnapshotId" TEXT,
    "nextDeckId" TEXT,
    "nextDeckSnapshotId" TEXT,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentEntryDeckChangeLog_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CardSet" ADD COLUMN "seasonId" TEXT;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "seasonId" TEXT;

-- AlterTable
ALTER TABLE "HostedEvent" ADD COLUMN "seasonId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Season_code_key" ON "Season"("code");

-- CreateIndex
CREATE INDEX "Season_isCurrent_idx" ON "Season"("isCurrent");

-- CreateIndex
CREATE INDEX "TournamentEntryDeckChangeLog_tournamentEntryId_idx" ON "TournamentEntryDeckChangeLog"("tournamentEntryId");

-- CreateIndex
CREATE INDEX "CardSet_seasonId_idx" ON "CardSet"("seasonId");

-- CreateIndex
CREATE INDEX "Tournament_seasonId_idx" ON "Tournament"("seasonId");

-- CreateIndex
CREATE INDEX "HostedEvent_seasonId_idx" ON "HostedEvent"("seasonId");

-- AddForeignKey
ALTER TABLE "CardSet" ADD CONSTRAINT "CardSet_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostedEvent" ADD CONSTRAINT "HostedEvent_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentEntryDeckChangeLog" ADD CONSTRAINT "TournamentEntryDeckChangeLog_tournamentEntryId_fkey" FOREIGN KEY ("tournamentEntryId") REFERENCES "TournamentEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentEntryDeckChangeLog" ADD CONSTRAINT "TournamentEntryDeckChangeLog_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
