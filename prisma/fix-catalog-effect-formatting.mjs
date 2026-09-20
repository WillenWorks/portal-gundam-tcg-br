/*
 * Corrige o campo `effectEn` no banco (CardModel + Card) para GD02-053:
 * `[Suppression]` em colchetes retos em vez de `<Suppression>`, apontado por
 * `docs/_generated/catalog-audit.md` (auditoria de 2026-09-20).
 *
 * Escopo deliberadamente restrito a esta 1 carta: o banco popula `effectEn`
 * a partir de `data/apitcg-gundam.json` (vendor diferente, formatação própria
 * — `[X]` colchete reto, `•` bullet, `<br>`/`\r\n`), normalizado de propósito
 * pra esse estilo (ver AI_GUIDE.md linha 146). As outras 11 cartas do mesmo
 * relatório de auditoria (separador ・→･) tinham o bug só dentro de
 * `data/gcg-official-cards.json` (fonte oficial canônica, já corrigida nesse
 * mesmo saneamento) — esse texto nunca chegou ao Postgres nessas 11, que usam
 * `•` (bullet) como separador no formato apitcg, então não há nada a corrigir
 * nelas aqui. Só GD02-053 tem o MESMO bug (colchete reto em vez de `<>`)
 * também presente no texto já normalizado que está no banco.
 *
 * Faz um find-and-replace pontual (`[Suppression]` → `<Suppression>`) dentro
 * do texto ATUAL do banco — não substitui o campo inteiro por outra fonte,
 * pra não introduzir uma formatação diferente do resto do catálogo.
 *
 * Idempotente: rodar de novo não causa problema, só reaplica o mesmo texto.
 *
 * Uso:
 *   node prisma/fix-catalog-effect-formatting.mjs            # dry-run (padrão)
 *   node prisma/fix-catalog-effect-formatting.mjs --apply     # aplica de verdade
 */
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

const FIXES = [
  { code: "GD02-053", find: "[Suppression]", replace: "<Suppression>" },
];

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log(APPLY ? "APLICANDO correção pontual de effectEn.\n" : "DRY-RUN — nada será gravado.\n");

    let updated = 0;
    let unchanged = 0;
    let missingInDb = 0;
    let notFoundInText = 0;

    for (const { code, find, replace } of FIXES) {
      const model = await prisma.cardModel.findUnique({ where: { code }, select: { id: true, effectEn: true } });
      if (!model) {
        missingInDb += 1;
        console.log(`  [faltando no banco] ${code} — CardModel não encontrado`);
        continue;
      }

      if (!model.effectEn || !model.effectEn.includes(find)) {
        if (model.effectEn && model.effectEn.includes(replace)) {
          unchanged += 1;
          console.log(`  já correto: ${code}`);
        } else {
          notFoundInText += 1;
          console.log(`  [texto não bate] ${code} — não contém ${JSON.stringify(find)} nem ${JSON.stringify(replace)}; confira manualmente`);
          console.log(`    atual: ${JSON.stringify(model.effectEn)}`);
        }
        continue;
      }

      const newEffect = model.effectEn.split(find).join(replace);
      updated += 1;
      console.log(`  ${APPLY ? "corrigindo" : "corrigiria"}: ${code}`);
      console.log(`    antes:  ${JSON.stringify(model.effectEn)}`);
      console.log(`    depois: ${JSON.stringify(newEffect)}`);

      if (APPLY) {
        await prisma.cardModel.update({ where: { id: model.id }, data: { effectEn: newEffect } });
        const prints = await prisma.card.findMany({ where: { code }, select: { id: true, effectEn: true } });
        let printsUpdated = 0;
        for (const print of prints) {
          if (print.effectEn && print.effectEn.includes(find)) {
            await prisma.card.update({ where: { id: print.id }, data: { effectEn: print.effectEn.split(find).join(replace) } });
            printsUpdated += 1;
          }
        }
        console.log(`    -> CardModel atualizado + ${printsUpdated}/${prints.length} print(s) em Card atualizados`);
      }
    }

    console.log(`\nResumo: ${updated} corrigida(s), ${unchanged} já estavam corretas, ${notFoundInText} com texto inesperado, ${missingInDb} não encontradas no banco.`);
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
