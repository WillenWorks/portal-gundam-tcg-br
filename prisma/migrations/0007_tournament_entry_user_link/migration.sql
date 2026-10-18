-- Rastrear se o participante do torneio tem conta cadastrada no site, independente
-- de ter vinculado um deck específico (nem todo jogador cadastrado publica o deck
-- usado). Alimenta a "fase 1" do hub de eventos: proporção de jogadores cadastrados
-- vs convidados nas estatísticas de torneio.
ALTER TABLE "TournamentEntry" ADD COLUMN "userId" TEXT;
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
