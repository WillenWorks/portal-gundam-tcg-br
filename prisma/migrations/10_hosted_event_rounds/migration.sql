-- Fase C do plano "reorganização do admin + hoster": rodadas e confrontos de um
-- HostedEvent. Pareamento e lançamento de resultado são manuais no MVP (o Hoster
-- monta os confrontos e digita quem ganhou) -- o schema (roundNumber/status em
-- HostedEventRound, participantA/participantB/result em HostedEventMatch) foi
-- pensado pra também caber um pareamento automático (Swiss) no futuro sem precisar
-- ser reescrito. participantBId nulo em HostedEventMatch representa um bye (folga).

-- CreateEnum
CREATE TYPE "HostedEventRoundStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "HostedEventMatchResult" AS ENUM ('PENDING', 'PLAYER_A_WIN', 'PLAYER_B_WIN', 'DRAW', 'BYE');

-- CreateTable
CREATE TABLE "HostedEventRound" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" "HostedEventRoundStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HostedEventRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostedEventMatch" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "tableNumber" INTEGER,
    "participantAId" TEXT NOT NULL,
    "participantBId" TEXT,
    "result" "HostedEventMatchResult" NOT NULL DEFAULT 'PENDING',
    "reportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HostedEventMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HostedEventRound_eventId_roundNumber_key" ON "HostedEventRound"("eventId", "roundNumber");

-- CreateIndex
CREATE INDEX "HostedEventRound_eventId_idx" ON "HostedEventRound"("eventId");

-- CreateIndex
CREATE INDEX "HostedEventMatch_roundId_idx" ON "HostedEventMatch"("roundId");

-- CreateIndex
CREATE INDEX "HostedEventMatch_participantAId_idx" ON "HostedEventMatch"("participantAId");

-- CreateIndex
CREATE INDEX "HostedEventMatch_participantBId_idx" ON "HostedEventMatch"("participantBId");

-- AddForeignKey
ALTER TABLE "HostedEventRound" ADD CONSTRAINT "HostedEventRound_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HostedEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostedEventMatch" ADD CONSTRAINT "HostedEventMatch_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "HostedEventRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostedEventMatch" ADD CONSTRAINT "HostedEventMatch_participantAId_fkey" FOREIGN KEY ("participantAId") REFERENCES "HostedEventParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostedEventMatch" ADD CONSTRAINT "HostedEventMatch_participantBId_fkey" FOREIGN KEY ("participantBId") REFERENCES "HostedEventParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
