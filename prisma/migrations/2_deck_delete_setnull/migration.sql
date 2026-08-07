-- Excluir um deck não pode mais ficar bloqueado por causa de referência histórica em
-- resultado de torneio — a referência vira null, o registro do torneio continua existindo.
ALTER TABLE "TournamentEntry" DROP CONSTRAINT "TournamentEntry_deckId_fkey";
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
