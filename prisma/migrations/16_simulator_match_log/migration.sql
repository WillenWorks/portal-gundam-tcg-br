-- Log analítico e de treino de partida finalizada no Simulador.
-- Gravado assincronamente ao término da partida para replay determinístico no treino do bot
-- e consolidação de telemetria estatística.

-- CreateTable
CREATE TABLE "SimulatorMatchLog" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'casual',
    "deckKeyA" TEXT,
    "deckKeyB" TEXT,
    "deckA" JSONB,
    "deckB" JSONB,
    "playerAId" TEXT,
    "playerBId" TEXT,
    "winner" TEXT NOT NULL,
    "winReason" TEXT NOT NULL,
    "turns" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "seed" BIGINT NOT NULL,
    "engineVersion" TEXT,
    "actions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulatorMatchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SimulatorMatchLog_matchId_key" ON "SimulatorMatchLog"("matchId");

-- CreateIndex
CREATE INDEX "SimulatorMatchLog_mode_idx" ON "SimulatorMatchLog"("mode");

-- CreateIndex
CREATE INDEX "SimulatorMatchLog_winner_idx" ON "SimulatorMatchLog"("winner");

-- CreateIndex
CREATE INDEX "SimulatorMatchLog_createdAt_idx" ON "SimulatorMatchLog"("createdAt");

-- CreateIndex
CREATE INDEX "SimulatorMatchLog_deckKeyA_deckKeyB_idx" ON "SimulatorMatchLog"("deckKeyA", "deckKeyB");
