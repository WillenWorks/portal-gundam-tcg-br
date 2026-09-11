-- Fase 3 (scaffold) do plano de metagame/torneios/telemetria: campos de suporte pra
-- Matriz de Confrontos. Nenhum fluxo de captura existe ainda -- ficam null até uma
-- futura UI de lançamento de partida preencher isso (ver comentários no schema).

-- AlterTable
ALTER TABLE "HostedEventParticipant" ADD COLUMN "archetype" TEXT;

-- AlterTable
ALTER TABLE "HostedEventMatch" ADD COLUMN "firstPlayerParticipantId" TEXT;
ALTER TABLE "HostedEventMatch" ADD COLUMN "diceWinnerParticipantId" TEXT;
