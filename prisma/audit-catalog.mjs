/**
 * Auditoria somente leitura dos dados do site (catálogo, FAQ, relações, Veda). Não grava nada.
 * Roda no Actions (workflow dados-site.yml, tarefa "auditoria") ou local com o DATABASE_URL de produção.
 *
 *   node prisma/audit-catalog.mjs
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const key = (t) => String(t ?? "").trim().toLowerCase().replace(/\s+/g, " ");

try {
  const models = await p.cardModel.findMany({ include: { prints: { where: { isActive: true } } } });
  const semImagem = [];
  for (const m of models) {
    const prim = m.prints.find((c) => c.isPrimaryPrint) ?? m.prints[0];
    if (prim && !prim.imageUrl && !prim.imageLargeUrl) semImagem.push(m.code);
  }

  const rulings = await p.ruling.findMany({ where: { isActive: true } });
  const porPergunta = new Map();
  for (const r of rulings) {
    if (!r.cardModelId) continue;
    const k = `${r.cardModelId}|${key(r.questionEn || r.questionPt || r.title)}`;
    porPergunta.set(k, (porPergunta.get(k) ?? 0) + 1);
  }
  const faqRepetida = [...porPergunta.values()].filter((n) => n > 1).length;

  const rels = await p.cardRelation.findMany({ where: { isActive: true, deletedAt: null } });
  const comRelacao = new Set(rels.flatMap((r) => [r.sourceModelId, r.targetModelId]));
  const porSet = {};
  for (const m of models) {
    const set = m.code.split("-")[0];
    porSet[set] ??= { cartas: 0, unidadesComLinkSemRelacao: 0 };
    porSet[set].cartas += 1;
    const link = m.prints[0]?.linkText;
    if (m.cardType === "UNIT" && link && link.includes("[") && !comRelacao.has(m.id)) porSet[set].unidadesComLinkSemRelacao += 1;
  }

  const [temporadas, torneios, inscricoes, comLista] = await Promise.all([
    p.season.findMany({ select: { code: true, isCurrent: true, _count: { select: { tournaments: true } } } }),
    p.tournament.count({ where: { isActive: true } }),
    p.tournamentEntry.count(),
    p.tournamentEntry.count({ where: { deckSnapshotId: { not: null } } }),
  ]);
  const ultimo = await p.tournament.findFirst({ where: { isActive: true }, orderBy: { dateStart: "desc" }, select: { name: true, dateStart: true } });

  console.log("## Auditoria dos dados do site\n");
  console.log(`- Cartas: ${models.length} · impressão principal sem imagem: ${semImagem.length}${semImagem.length ? ` (${semImagem.join(", ")})` : ""}`);
  console.log(`- FAQ: ${rulings.length} ativas · perguntas repetidas no mesmo modelo: ${faqRepetida}`);
  console.log(`- Relações: ${rels.length}`);
  console.log(`- Veda: ${temporadas.length} temporadas · ${torneios} torneios · ${inscricoes} inscrições (${comLista} com lista) · último: ${ultimo ? `${ultimo.name} (${ultimo.dateStart?.toISOString().slice(0, 10) ?? "s/ data"})` : "—"}`);
  for (const t of temporadas) console.log(`  - ${t.code}${t.isCurrent ? " (atual)" : ""}: ${t._count.tournaments} torneios`);
  console.log("\n| Set | Cartas | Unidades com link sem relação |\n|---|---|---|");
  for (const [set, v] of Object.entries(porSet).sort()) console.log(`| ${set} | ${v.cartas} | ${v.unidadesComLinkSemRelacao} |`);
} finally {
  await p.$disconnect();
}
