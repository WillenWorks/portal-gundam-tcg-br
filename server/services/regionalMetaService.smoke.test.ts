/*
 * Smoke test de integração do Painel de Metagame Regional Geográfico contra um Postgres
 * REAL (não o Prisma fake usado em regionalMetaService.test.ts) -- valida que as consultas
 * geográficas (agrupamento País -> Estado -> Cidade -> Loja, join TournamentEntry/
 * DeckSnapshot/DeckSnapshotItem/Card, e o piso estatístico N>=30 de MIN_SAMPLE_SIZE_FOR_ANOMALY)
 * funcionam de ponta a ponta contra o schema real, algo que um mock de Prisma não consegue
 * pegar (nome de campo errado, enum trocado, join que não bate).
 *
 * Opt-in por padrão (não roda no `pnpm test` normal): exige `RUN_DB_SMOKE_TESTS=true` no
 * ambiente e um Postgres real acessível via DATABASE_URL (ver docker-compose.yml / `pnpm
 * run db:up`). Isso evita que o smoke test mute o banco de dev de qualquer dev/CI que não
 * pediu por isso explicitamente.
 *
 * Como rodar localmente:
 *   pnpm run db:up
 *   pnpm run test:smoke:regional-meta   (Windows PowerShell: $env:RUN_DB_SMOKE_TESTS='true'; pnpm ...)
 *
 * Todos os dados de seed usam uma Season com código único por execução e são apagados no
 * afterAll (Tournament -> cascade TournamentEntry; DeckSnapshot -> cascade DeckSnapshotItem;
 * Card só depois disso, já que a FK é onDelete: Restrict) -- nunca deixa lixo no banco.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CardType, PrismaClient } from "@prisma/client";
import { getRegionalMetagame } from "./regionalMetaService.ts";

const RUN_SMOKE = process.env.RUN_DB_SMOKE_TESTS === "true";

describe.skipIf(!RUN_SMOKE)("getRegionalMetagame (smoke test com Postgres real)", () => {
  const prisma = new PrismaClient();
  const runId = `smoke-regional-meta-${Date.now()}`;

  let seasonId: string;
  let cardId: string;
  const tournamentIds: string[] = [];
  const deckSnapshotIds: string[] = [];

  // Reflete o mesmo desenho do fixture unitário (regionalMetaService.test.ts): SP e RJ com
  // 100% de presença da carta "anômala", MG sem nenhuma -- dilui a média nacional pra <100%
  // e cria um desvio >=15pp em ambos os estados, mas só SP tem amostra (N=32>=30) suficiente
  // pra virar alerta; RJ (N=10<30) precisa ficar suprimido.
  const STATE_SEEDS = [
    { uf: "SP", city: "São Paulo", organizer: `${runId}-lgs-sp`, count: 32, withCard: true },
    { uf: "RJ", city: "Rio de Janeiro", organizer: `${runId}-lgs-rj`, count: 10, withCard: true },
    { uf: "MG", city: "Belo Horizonte", organizer: `${runId}-lgs-mg`, count: 40, withCard: false },
  ] as const;

  beforeAll(async () => {
    const season = await prisma.season.create({ data: { code: runId, name: "Smoke Test Season (Regional Meta)" } });
    seasonId = season.id;

    const card = await prisma.card.create({
      data: {
        code: `${runId}-card`,
        nameEn: "Smoke Anomaly Card",
        cardType: CardType.UNIT,
        color: "White",
        cardSubtypes: [],
        traits: [],
        triggerKeywords: [],
        keywordTags: [],
        effectKeywords: [],
      },
    });
    cardId = card.id;

    for (const state of STATE_SEEDS) {
      const tournament = await prisma.tournament.create({
        data: {
          name: `${runId}-tournament-${state.uf}`,
          seasonId,
          isActive: true,
          country: "Brasil",
          city: state.city,
          organizer: state.organizer,
        },
      });
      tournamentIds.push(tournament.id);

      for (let i = 0; i < state.count; i++) {
        const snapshot = await prisma.deckSnapshot.create({ data: { name: `${runId}-deck-${state.uf}-${i}` } });
        deckSnapshotIds.push(snapshot.id);

        if (state.withCard) {
          await prisma.deckSnapshotItem.create({
            data: { deckSnapshotId: snapshot.id, cardId, quantity: 4, section: "main" },
          });
        }

        await prisma.tournamentEntry.create({
          data: {
            tournamentId: tournament.id,
            playerName: `${runId}-player-${state.uf}-${i}`,
            wins: 1,
            losses: 1,
            draws: 0,
            deckSnapshotId: snapshot.id,
          },
        });
      }
    }
  }, 60_000);

  afterAll(async () => {
    await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } }); // cascade -> TournamentEntry
    await prisma.deckSnapshot.deleteMany({ where: { id: { in: deckSnapshotIds } } }); // cascade -> DeckSnapshotItem
    await prisma.card.deleteMany({ where: { id: cardId } });
    await prisma.season.deleteMany({ where: { id: seasonId } });
    await prisma.$disconnect();
  }, 60_000);

  it("agrupa geograficamente (País -> Estado -> Cidade -> Loja) via consulta real ao Postgres", async () => {
    const result = await getRegionalMetagame(prisma, { seasonId });

    expect(result.totalDecks).toBe(32 + 10 + 40);

    const sp = result.states.find((s) => s.key === "SP");
    const rj = result.states.find((s) => s.key === "RJ");
    const mg = result.states.find((s) => s.key === "MG");
    expect(sp?.totalDecks).toBe(32);
    expect(rj?.totalDecks).toBe(10);
    expect(mg?.totalDecks).toBe(40);

    const spCity = result.cities.find((c) => c.label === "São Paulo");
    expect(spCity?.totalDecks).toBe(32);
  });

  it("agrupa por loja parceira dentro da cidade selecionada via consulta real ao Postgres", async () => {
    const result = await getRegionalMetagame(prisma, { seasonId, stateUf: "SP", city: "São Paulo" });
    const store = result.stores.find((s) => s.label === `${runId}-lgs-sp`);
    expect(store?.totalDecks).toBe(32);
  });

  it("com amostra >= 30 (MIN_SAMPLE_SIZE_FOR_ANOMALY), o desvio de presença gera alerta contra a média nacional real", async () => {
    const result = await getRegionalMetagame(prisma, { seasonId, stateUf: "SP" });

    const anomaly = result.anomalies.find((a) => a.kind === "card" && a.label === "Smoke Anomaly Card");
    expect(anomaly).toBeDefined();
    expect(anomaly!.regionRate).toBeGreaterThan(anomaly!.nationalRate);
    expect(result.alerts.some((msg) => msg.includes("Smoke Anomaly Card"))).toBe(true);
  });

  it("com amostra < 30, suprime o alerta mesmo com o mesmo desvio de presença (dado real, não mockado)", async () => {
    const result = await getRegionalMetagame(prisma, { seasonId, stateUf: "RJ" });

    const rj = result.states.find((s) => s.key === "RJ");
    expect(rj?.totalDecks).toBeLessThan(30);
    expect(result.anomalies).toEqual([]);
    expect(result.alerts).toEqual([]);
  });
});
