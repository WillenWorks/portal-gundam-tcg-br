-- docs/44 Fase 3 §5.1 — captura de bug report do Simulador. Quando o jogador
-- aperta "Reportar situação" no HUD, o servidor congela aqui o GameState
-- completo (repro), o battleLog da visão daquele assento e as cartas em jogo no
-- momento. Sem FK — blob autocontido, mesma filosofia do SimulatorMatch. Os
-- agentes de triagem/fix (Wave 3) consomem status/triage/prUrl.

-- CreateTable
CREATE TABLE "SimulatorBugReport" (
    "id" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "seat" TEXT NOT NULL,
    "note" TEXT,
    "engineVersion" TEXT NOT NULL,
    "gameState" JSONB NOT NULL,
    "battleLog" JSONB NOT NULL,
    "lastAction" JSONB,
    "cardsInvolved" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'new',
    "triage" JSONB,
    "prUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulatorBugReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SimulatorBugReport_shortCode_key" ON "SimulatorBugReport"("shortCode");

-- CreateIndex
CREATE INDEX "SimulatorBugReport_status_idx" ON "SimulatorBugReport"("status");

-- CreateIndex
CREATE INDEX "SimulatorBugReport_createdAt_idx" ON "SimulatorBugReport"("createdAt");
