/*
 * Corrige `effectEn` (CardModel + Card) pras 6 cartas legado onde o campo
 * ficou com o texto em PORTUGUÊS em vez de inglês.
 *
 * Causa raiz (já corrigida em `prisma/seed.mjs`): `buildFlattenedText()`
 * sempre preferia `textPt` ao montar o texto plano a partir de
 * `textSectionsJson`, e o cálculo de `effectEn` fazia
 * `card.effectEn || effectPt` — como essas 6 cartas só têm
 * `textSectionsJson` (sem um `effectEn` plano já definido), o resultado
 * virava o texto em português duas vezes (`effectEn === effectPt`). Rodar
 * `prisma:seed` de novo (já com o fix) resolveria isso pra essas 6 cartas,
 * mas um reseed completo mexe em mais coisa do que só esse bug — este script
 * aplica só a correção pontual, sem depender de reseed.
 *
 * Texto correto extraído diretamente de `textSectionsJson.textEn` em
 * `prisma/seed.mjs` (mesma fonte, montado com o mesmo formato `[Label] texto`
 * que `buildFlattenedText` usa — ver ali pra conferir contra a fonte original).
 *
 * Idempotente: rodar de novo não causa problema, só reaplica o mesmo texto.
 *
 * Uso:
 *   node prisma/fix-legacy-card-effect-en.mjs            # dry-run (padrão)
 *   node prisma/fix-legacy-card-effect-en.mjs --apply     # aplica de verdade
 */
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

const FIXES = [
  {
    code: "GD01-001",
    effectEn:
      "[Continuous] All your (White Base Team) Units gain <Repair 1>.\n[When Paired] If you have 2 or more other Units in play, draw 1 card.",
  },
  {
    code: "GD01-090",
    effectEn: "[Burst] Add this card to your hand.\n[During Link] This Unit's AP can't be reduced by enemy effects.",
  },
  {
    code: "GD01-099",
    effectEn:
      "[Burst] Choose 1 enemy Unit with 5 or less HP. Rest it.\n[Main / Action] Choose 1 to 2 enemy Units with 3 or less HP. Rest them.",
  },
  {
    code: "GD01-129",
    effectEn:
      "[Burst] Deploy this card.\n[Deploy] Add 1 of your Shields to your hand. Then, choose 1 enemy Unit with 3 or less HP and return it to its owner's hand.",
  },
  { code: "T-011", effectEn: "[Blocker] Rest this Unit to change the attack target to it." },
  { code: "R-002", effectEn: "[Rule] Rest a Resource when paying a cost." },
];

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log(APPLY ? "APLICANDO correção de effectEn (texto em PT nas 6 cartas legado).\n" : "DRY-RUN — nada será gravado.\n");

    let updated = 0;
    let unchanged = 0;
    let missingInDb = 0;

    for (const { code, effectEn } of FIXES) {
      const model = await prisma.cardModel.findUnique({ where: { code }, select: { id: true, effectEn: true } });
      if (!model) {
        missingInDb += 1;
        console.log(`  [faltando no banco] ${code} — CardModel não encontrado`);
        continue;
      }

      if (model.effectEn === effectEn) {
        unchanged += 1;
        console.log(`  já correto: ${code}`);
        continue;
      }

      updated += 1;
      console.log(`  ${APPLY ? "corrigindo" : "corrigiria"}: ${code}`);
      console.log(`    antes:  ${JSON.stringify(model.effectEn)}`);
      console.log(`    depois: ${JSON.stringify(effectEn)}`);

      if (APPLY) {
        await prisma.cardModel.update({ where: { id: model.id }, data: { effectEn } });
        const { count } = await prisma.card.updateMany({ where: { code }, data: { effectEn } });
        console.log(`    -> CardModel atualizado + ${count} print(s) em Card atualizados`);
      }
    }

    console.log(`\nResumo: ${updated} corrigida(s), ${unchanged} já estavam corretas, ${missingInDb} não encontradas no banco.`);
    if (!APPLY) console.log("Nada foi gravado (dry-run). Rode com --apply pra aplicar de verdade.");
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
