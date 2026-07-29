/* Limpa somente os dados dependentes do catálogo antes de uma nova carga API TCG. Preserva usuários, posts, taxonomias e torneios. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const deleted = await prisma.$transaction(async (tx) => {
    const tournamentEntries = await tx.tournamentEntry.deleteMany();
    const deckItems = await tx.deckItem.deleteMany();
    const decks = await tx.deck.deleteMany();
    const binderItems = await tx.cardBinderItem.deleteMany();
    const binders = await tx.cardBinder.deleteMany();
    const rulings = await tx.ruling.deleteMany();
    const cards = await tx.card.deleteMany();
    const sets = await tx.cardSet.deleteMany();
    return { tournamentEntries: tournamentEntries.count, deckItems: deckItems.count, decks: decks.count, binderItems: binderItems.count, binders: binders.count, rulings: rulings.count, cards: cards.count, sets: sets.count };
  });
  console.log("Catálogo limpo:", deleted);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
