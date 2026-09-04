-- docs/23 — persistência da partida do Simulador. O matchStore server-side segue
-- com um Map em memória como cache de trabalho; esta tabela é o write-through
-- pra a partida sobreviver a restart/deploy/idle do Render (free plan derruba
-- tudo o que está em memória). Sem FK — blob de estado autocontido.

-- CreateTable
CREATE TABLE "SimulatorMatch" (
    "id" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "seats" JSONB NOT NULL,
    "deckKeys" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "phase" TEXT NOT NULL,
    "turnDeadlineAt" BIGINT,
    "lastSeenAt" JSONB NOT NULL DEFAULT '{}',
    "gameOver" JSONB,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulatorMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimulatorMatch_updatedAt_idx" ON "SimulatorMatch"("updatedAt");

-- CreateIndex
CREATE INDEX "SimulatorMatch_finishedAt_idx" ON "SimulatorMatch"("finishedAt");
