/*
 * Aplica a lista oficial de cartas banidas/restritas/pares banidos
 * (gundam-gcg.com/en/news/01_279.html, conferida em ago/2026) ao CardModel.
 * Ver docs/14-motor-regras-deck.md.
 *
 * Idempotente: pode rodar de novo sempre que a lista oficial mudar — só
 * atualiza o que precisa, não duplica CardBanGroup.
 *
 * Uso:
 *   node prisma/apply-official-banlist.mjs            # dry-run (padrão)
 *   node prisma/apply-official-banlist.mjs --apply     # aplica de verdade
 */
import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";

const APPLY = process.argv.includes("--apply");

const BANNED_CODES = ["GD01-020"]; // Anksha

const RESTRICTED = [{ code: "ST02-016", copies: 2 }]; // Corsica Base

const BAN_GROUPS = [
  {
    label: "Amuro Ray x Mikazuki Augus (par banido oficial)",
    maxDistinct: 1,
    note: "Vínculo oficial (Banned pair) — gundam-gcg.com/en/news/01_279.html",
    codes: ["ST01-010", "ST05-010"],
  },
  {
    label: 'Unit "Lv.2 / custo 1 / 2AP / 2HP / sem efeito" (categoria genérica banida)',
    maxDistinct: 1,
    note: 'Regra oficial: "no more than four copies of one card matching this description can be used in a deck" — gundam-gcg.com/en/news/01_279.html',
    codes: [
      "GD01-008", "GD01-035", "GD01-060", "GD01-085", "GD02-013", "GD02-080",
      "GD03-032", "GD03-063", "GD04-078", "GD05-014", "GD05-015", "GD05-027",
      "GD05-042", "GD05-062", "GD05-077", "ST01-005", "ST04-008", "ST05-004",
      "ST05-009", "ST06-004", "ST09-005", "ST10-005",
    ],
  },
];

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log(APPLY ? "APLICANDO lista oficial de banimento/restrição.\n" : "DRY-RUN — nada será gravado.\n");

    let bannedFound = 0, bannedMissing = 0;
    for (const code of BANNED_CODES) {
      const model = await prisma.cardModel.findUnique({ where: { code }, select: { id: true, nameEn: true, legalityStatus: true } });
      if (!model) { bannedMissing += 1; console.log(`  [faltando] ${code} — não encontrado no catálogo`); continue; }
      bannedFound += 1;
      console.log(`  banido: ${code} ${model.nameEn}${model.legalityStatus === "banned" ? " (já estava)" : ""}`);
      if (APPLY) await prisma.cardModel.update({ where: { id: model.id }, data: { legalityStatus: "banned" } });
    }

    let restrictedFound = 0, restrictedMissing = 0;
    for (const { code, copies } of RESTRICTED) {
      const model = await prisma.cardModel.findUnique({ where: { code }, select: { id: true, nameEn: true } });
      if (!model) { restrictedMissing += 1; console.log(`  [faltando] ${code} — não encontrado no catálogo`); continue; }
      restrictedFound += 1;
      console.log(`  restrita <${copies}>: ${code} ${model.nameEn}`);
      if (APPLY) await prisma.cardModel.update({ where: { id: model.id }, data: { legalityStatus: "restricted", restrictedCopies: copies } });
    }

    console.log(`\nBanidas: ${bannedFound} aplicadas, ${bannedMissing} não encontradas no catálogo.`);
    console.log(`Restritas: ${restrictedFound} aplicadas, ${restrictedMissing} não encontradas no catálogo.\n`);

    for (const group of BAN_GROUPS) {
      const models = await prisma.cardModel.findMany({ where: { code: { in: group.codes } }, select: { id: true, code: true } });
      const missing = group.codes.filter((code) => !models.some((m) => m.code === code));
      console.log(`Grupo "${group.label}": ${models.length}/${group.codes.length} codes encontrados no catálogo.`);
      if (missing.length) console.log(`  faltando: ${missing.join(", ")}`);

      if (APPLY) {
        const existingGroup = await prisma.cardBanGroup.findFirst({ where: { label: group.label } });
        const groupId = existingGroup
          ? existingGroup.id
          : (await prisma.cardBanGroup.create({ data: { label: group.label, maxDistinct: group.maxDistinct, note: group.note } })).id;
        if (existingGroup) await prisma.cardBanGroup.update({ where: { id: groupId }, data: { maxDistinct: group.maxDistinct, note: group.note, isActive: true } });
        await prisma.cardModel.updateMany({ where: { id: { in: models.map((m) => m.id) } }, data: { banGroupId: groupId } });
      }
    }

    if (!APPLY) console.log("\nNada foi gravado (dry-run). Rode com --apply pra aplicar de verdade.");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
