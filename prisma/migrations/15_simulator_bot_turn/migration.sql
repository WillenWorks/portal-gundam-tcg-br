-- docs/44 Fase 2 §10.2 — fila em Postgres dos turnos do bot heurístico (modo
-- treino solo). O web server NUNCA roda a policy do bot inline: quando o motor
-- autoritativo (`matchStore`) fica com a vez no assento do bot, ele só ENFILEIRA
-- uma linha aqui (status `pending`). O worker dedicado (`services/sim-bot/`) faz
-- polling desta tabela, carrega a partida, roda a heurística em loop até o turno
-- do bot acabar e aplica cada ação de volta pela API autoritativa. Sem FK —
-- mesma filosofia de blob autocontido do `SimulatorMatch` / `SimulatorBugReport`.

-- CreateTable
CREATE TABLE "SimulatorBotTurn" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "seat" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulatorBotTurn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimulatorBotTurn_status_createdAt_idx" ON "SimulatorBotTurn"("status", "createdAt");
