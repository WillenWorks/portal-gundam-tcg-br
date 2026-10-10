/**
 * Corrige as impressões "seed:" que ficaram como impressão principal sem imagem (ex.: GD01-001 Gundam, cujo
 * primeiro quadro da galeria aparecia vazio). Cada uma tem uma "gêmea" importada do TCGplayer (apitcg:) com a
 * mesma raridade e do mesmo set — a mesma carta física, duplicada. O script copia a imagem da gêmea para a
 * impressão principal, move para ela as referências (decks, fichários, FAQ) e desativa a gêmea.
 *
 *   node prisma/fix-seed-prints.mjs            # simulação (não grava)
 *   node prisma/fix-seed-prints.mjs --apply    # grava
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const APPLY = process.argv.includes("--apply");
const IMAGE_FIELDS = ["imageUrl", "thumbUrl", "imageSmallUrl", "imageMediumUrl", "imageLargeUrl", "imageSourceUrl"];

const RARITY_ALIASES = {
  "legend rare": "LR",
  "super rare": "SR",
  rare: "R",
  uncommon: "U",
  common: "C",
  resource: "C",
  token: "C",
  promo: "P",
};

export function normalizeRarity(raw) {
  const key = String(raw ?? "").trim().toLowerCase();
  return RARITY_ALIASES[key] ?? String(raw ?? "").trim().toUpperCase();
}

/**
 * prints: impressões ativas de um mesmo modelo; apitcgSets: Map<apitcgId, setCode>.
 * Devolve { seed, twin } quando a principal é "seed:" sem imagem e existe gêmea com imagem, ou null.
 */
export function planSeedFix(prints, apitcgSets, modelSetCode) {
  const seed = prints.find((p) => p.isPrimaryPrint && p.externalId?.startsWith("seed:") && !p.imageUrl && !p.imageLargeUrl);
  if (!seed) return null;
  const rarity = normalizeRarity(seed.rarity);
  const candidates = prints.filter(
    (p) => p.id !== seed.id && !p.isPrimaryPrint && p.externalId?.startsWith("apitcg:") && p.imageUrl && normalizeRarity(p.rarity) === rarity,
  );
  if (!candidates.length) return null;
  const setOf = (p) => apitcgSets.get(Number(p.externalId.slice("apitcg:".length))) ?? null;
  const apiId = (p) => Number(p.externalId.slice("apitcg:".length));
  // prefere a do set de origem; nunca a "Edition Beta" (GD01_b) nem reimpressões de outros produtos
  const ranked = [...candidates].sort((a, b) => {
    const score = (p) => (setOf(p) === modelSetCode ? 0 : setOf(p)?.endsWith("_b") ? 2 : 1);
    return score(a) - score(b) || apiId(a) - apiId(b);
  });
  return { seed, twin: ranked[0] };
}

async function loadApitcgSets() {
  const raw = JSON.parse(await readFile(fileURLToPath(new URL("../data/apitcg-gundam.json", import.meta.url)), "utf8"));
  return new Map((raw.cards ?? []).map((c) => [c._id, c.set?.code ?? null]));
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const apitcgSets = await loadApitcgSets();
    const seeds = await prisma.card.findMany({
      where: { isActive: true, isPrimaryPrint: true, externalId: { startsWith: "seed:" }, imageUrl: null },
      select: { cardModelId: true },
    });
    const modelIds = [...new Set(seeds.map((s) => s.cardModelId).filter(Boolean))];
    console.log(`${APPLY ? "APLICANDO" : "SIMULAÇÃO (nada é gravado)"} — ${modelIds.length} carta(s) com impressão principal seed sem imagem`);
    let fixed = 0;
    for (const modelId of modelIds) {
      const model = await prisma.cardModel.findUnique({
        where: { id: modelId },
        include: { prints: { where: { isActive: true } } },
      });
      if (!model) continue;
      const setCode = model.code.split("-")[0];
      const plan = planSeedFix(model.prints, apitcgSets, setCode);
      if (!plan) {
        console.log(`  ${model.code}: sem gêmea com imagem — revisar manualmente`);
        continue;
      }
      const { seed, twin } = plan;
      console.log(`  ${model.code}: ${seed.externalId} ← imagem de ${twin.externalId} (${twin.rarity}); ${twin.externalId} desativada`);
      if (!APPLY) continue;
      await prisma.$transaction(async (tx) => {
        await tx.card.update({
          where: { id: seed.id },
          data: Object.fromEntries(IMAGE_FIELDS.map((f) => [f, twin[f] ?? seed[f] ?? null])),
        });
        await tx.deckItem.updateMany({ where: { cardId: twin.id }, data: { cardId: seed.id } });
        await tx.deckSnapshotItem.updateMany({ where: { cardId: twin.id }, data: { cardId: seed.id } });
        // fichário tem unique (binderId, cardId): se já existe a principal no mesmo fichário, apaga a da gêmea
        const binderItems = await tx.cardBinderItem.findMany({ where: { cardId: twin.id } });
        for (const item of binderItems) {
          const clash = await tx.cardBinderItem.findFirst({ where: { binderId: item.binderId, cardId: seed.id } });
          if (clash) await tx.cardBinderItem.delete({ where: { id: item.id } });
          else await tx.cardBinderItem.update({ where: { id: item.id }, data: { cardId: seed.id } });
        }
        await tx.ruling.updateMany({ where: { cardId: twin.id }, data: { cardId: seed.id } });
        await tx.card.update({ where: { id: twin.id }, data: { isActive: false, deletedAt: new Date() } });
      });
      fixed += 1;
    }
    console.log(APPLY ? `${fixed} corrigida(s).` : "Para gravar: node prisma/fix-seed-prints.mjs --apply");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
