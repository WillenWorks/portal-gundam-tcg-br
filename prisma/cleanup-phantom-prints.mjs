/*
 * Remove prints "fantasma" -- Card (impressao) sem nenhuma imagem E com raridade que
 * o pipeline atual (seed-apitcg.mjs + curation) nunca produz. Achado analisando 5
 * exemplos reais (GD01-090, GD01-099, GD01-129, R-002, T-011): cada um tinha uma
 * impressao extra sem arte, com raridade abreviada ("R", "U") ou literalmente o
 * cardType no lugar da raridade ("RESOURCE", "TOKEN"). Nenhuma das duas fontes de
 * dado atuais (apitcg-gundam.json, gcg-official-cards.json) produz esses valores --
 * rastreei ate scripts/catalog-import.mjs, que existe no package.json (catalog:import,
 * catalog:import:local) mas NAO faz parte da cadeia catalog:bootstrap. Foi rodado
 * manualmente uma vez no passado (antes do pipeline atual existir) e deixou esses
 * residuos no banco -- nao vai acontecer de novo num catalog:bootstrap novo, mas o
 * banco que ja tem esses residuos precisa de limpeza manual.
 *
 * Criterio de deteccao (as DUAS condicoes precisam ser verdade, de proposito
 * conservador -- prefere deixar passar um residuo real a apagar uma carta legitima
 * por engano):
 *   1. Sem NENHUMA imagem (imageUrl E imageMediumUrl nulos)
 *   2. Raridade fora da lista que o pipeline atual realmente produz
 *
 * Antes de apagar, checa se algum DeckItem ou CardBinderItem referencia essas
 * impressoes -- se tiver, NAO apaga automaticamente, so avisa (decisao de humano).
 *
 * Modos:
 *   node prisma/cleanup-phantom-prints.mjs           -> dry-run (padrao)
 *   node prisma/cleanup-phantom-prints.mjs --apply   -> aplica de verdade
 */
import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";

const APPLY = process.argv.includes("--apply");

// Toda raridade que o pipeline atual (seed-apitcg.mjs, lendo attributes.Rarity do
// apitcg-gundam.json) realmente produz -- levantado direto do dataset fonte.
const VALID_RARITIES = new Set(["C+", "C++", "Common", "LR+", "LR++", "Legend Rare", "Promo", "R+", "Rare", "U+", "Uncommon"]);

async function main() {
  const prisma = new PrismaClient();
  try {
    const candidates = await prisma.card.findMany({
      where: {
        imageUrl: null,
        imageMediumUrl: null,
      },
      select: { id: true, code: true, nameEn: true, rarity: true, cardModelId: true },
    });

    const phantoms = candidates.filter((c) => !c.rarity || !VALID_RARITIES.has(c.rarity));

    console.log(`Impressoes sem imagem: ${candidates.length} | com raridade suspeita entre essas: ${phantoms.length}`);
    if (!phantoms.length) {
      console.log("Nada a limpar.");
      return;
    }

    console.log("\nCandidatos a remocao:");
    for (const p of phantoms) console.log(`  ${p.code} · ${p.nameEn} · raridade="${p.rarity}" · id=${p.id}`);

    const phantomIds = phantoms.map((p) => p.id);
    const [deckRefs, binderRefs] = await Promise.all([
      prisma.deckItem.findMany({ where: { cardId: { in: phantomIds } }, select: { cardId: true, deckId: true } }),
      prisma.cardBinderItem.findMany({ where: { cardId: { in: phantomIds } }, select: { cardId: true, binderId: true } }),
    ]);

    const referencedIds = new Set([...deckRefs.map((r) => r.cardId), ...binderRefs.map((r) => r.cardId)]);
    const safeToDelete = phantoms.filter((p) => !referencedIds.has(p.id));
    const blocked = phantoms.filter((p) => referencedIds.has(p.id));

    if (blocked.length) {
      console.log(`\n${blocked.length} candidato(s) EM USO (deck ou binder de algum usuario) -- NAO vao ser apagados automaticamente:`);
      for (const b of blocked) console.log(`  ${b.code} · id=${b.id} -- referenciado em ${deckRefs.filter((r) => r.cardId === b.id).length} deck(s) e ${binderRefs.filter((r) => r.cardId === b.id).length} binder(s)`);
      console.log("Decisao manual necessaria pra esses -- provavelmente precisam de troca de print antes de remover.");
    }

    console.log(`\n${safeToDelete.length} candidato(s) seguro(s) pra remover (sem nenhuma referencia).`);

    if (APPLY) {
      if (safeToDelete.length) {
        await prisma.card.deleteMany({ where: { id: { in: safeToDelete.map((c) => c.id) } } });
        console.log(`Removido(s): ${safeToDelete.length} print(s) fantasma.`);
      } else {
        console.log("Nada seguro pra remover nesta rodada.");
      }
    } else {
      console.log("\nDry-run (padrao) -- nada foi apagado. Rode com --apply pra aplicar de verdade.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
