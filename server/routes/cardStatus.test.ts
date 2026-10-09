import { describe, expect, it, beforeEach, afterEach } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  cardStatusRouter,
  getCardStatus,
  getAllCardStatuses,
  clearCardStatusCache,
} from "./cardStatus.ts";
import { ALL_CARD_DEFS } from "../../src/modules/simulator/content/allCardDefs.ts";
import { isCardPlayable } from "../deckCoverageGate.ts";

describe("cardStatus — lógica de playability", () => {
  beforeEach(() => {
    clearCardStatusCache();
  });

  it("uma carta de set fechado é apta (ST01-001 e GD01-008)", () => {
    const st01 = getCardStatus("ST01-001");
    expect(st01.status).toBe("apta");
    expect(st01.set).toBe("ST01");
    expect(st01.motivo).toBeUndefined();

    const gd01 = getCardStatus("GD01-008");
    expect(gd01.status).toBe("apta");
    expect(gd01.set).toBe("GD01");
    expect(gd01.motivo).toBeUndefined();
  });

  it("W11 — a última carta de EB01 que faltava é apta (EB01-003); nenhuma carta do catálogo fica em revisão", () => {
    const eb01 = getCardStatus("EB01-003");
    expect(eb01.status).toBe("apta");
    expect(eb01.set).toBe("EB01");
    expect(getAllCardStatuses().summary.revisao).toBe(0);
  });

  it("uma carta de EB01 implementada é apta (EB01-001)", () => {
    const eb01Playable = getCardStatus("EB01-001");
    expect(eb01Playable.status).toBe("apta");
    expect(eb01Playable.set).toBe("EB01");
    expect(eb01Playable.motivo).toBeUndefined();
  });

  it("um código inexistente ou fora do catálogo é fora (GD01-999 e ST11-001)", () => {
    const forged = getCardStatus("GD01-999");
    expect(forged.status).toBe("fora");
    expect(forged.motivo).toMatch(/fora do simulador/i);

    const outside = getCardStatus("ST11-001");
    expect(outside.status).toBe("fora");
    expect(outside.motivo).toMatch(/fora do simulador/i);
  });

  it("critério de aceite: o veredito bate 100% com isCardPlayable para todo o catálogo do motor", () => {
    const discrepancies: string[] = [];

    for (const [code, def] of Object.entries(ALL_CARD_DEFS)) {
      const playable = isCardPlayable(def);
      const statusEntry = getCardStatus(code);

      const statusPlayable = statusEntry.status === "apta";
      if (playable !== statusPlayable) {
        discrepancies.push(
          `${code}: isCardPlayable=${playable} vs status=${statusEntry.status} (motivo: ${statusEntry.motivo})`,
        );
      }
    }

    expect(discrepancies).toEqual([]);
  });

  it("resumo por set reflete o estado atual do motor", () => {
    const response = getAllCardStatuses();
    const sets = response.sets;

    // Sets fechados (ST01..ST10, GD01..GD05, EB01 desde a W11) têm 100% aptas
    const closedSets = [
      "ST01", "ST02", "ST03", "ST04", "ST05", "ST06", "ST07", "ST08", "ST09", "ST10",
      "GD01", "GD02", "GD03", "GD04", "GD05", "EB01",
    ];

    for (const set of closedSets) {
      const setSummary = sets[set];
      expect(setSummary, `Set ${set} deve estar presente no resumo`).toBeDefined();
      expect(setSummary.total, `Set ${set} deve ter cartas`).toBeGreaterThan(0);
      expect(setSummary.revisao, `Set ${set} não deve ter cartas em revisão`).toBe(0);
      expect(setSummary.percentAptas, `Set ${set} deve estar 100% apto`).toBe(100);
    }

    // EB01: as 90 cartas prontas
    const eb01Summary = sets["EB01"];
    expect(eb01Summary).toBeDefined();
    expect(eb01Summary.aptas).toBe(90);
    expect(eb01Summary.revisao).toBe(0);
  });

  it("cache em memória reutiliza o mesmo objeto sem reprocessar", () => {
    const first = getAllCardStatuses();
    const second = getAllCardStatuses();
    expect(first).toBe(second);

    clearCardStatusCache();
    const third = getAllCardStatuses();
    expect(third).not.toBe(first);
    expect(third.summary).toEqual(first.summary);
  });
});

describe("cardStatus — rotas HTTP", () => {
  let app: express.Express;
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use(cardStatusRouter);

    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("GET /api/simulator/card-status retorna payload completo com cards, sets e summary", async () => {
    const res = await fetch(`${baseUrl}/api/simulator/card-status`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.cards).toBeDefined();
    expect(body.sets).toBeDefined();
    expect(body.summary).toBeDefined();
    expect(body.cards["ST01-001"].status).toBe("apta");
    expect(body.cards["EB01-003"].status).toBe("apta");

    // Compatibilidade no nível raiz: res.body[code]
    expect(body["ST01-001"].status).toBe("apta");
  });

  it("GET /api/simulator/card-status?code=ST01-001 retorna status da carta individual", async () => {
    const res = await fetch(`${baseUrl}/api/simulator/card-status?code=ST01-001`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.code).toBe("ST01-001");
    expect(body.status).toBe("apta");
  });

  it("GET /api/simulator/card-status/:code retorna status por rota", async () => {
    const resApta = await fetch(`${baseUrl}/api/simulator/card-status/ST01-001`);
    expect(resApta.status).toBe(200);
    const bodyApta = (await resApta.json()) as any;
    expect(bodyApta.status).toBe("apta");

    const resEb01 = await fetch(`${baseUrl}/api/simulator/card-status/EB01-003`);
    expect(resEb01.status).toBe(200);
    const bodyEb01 = (await resEb01.json()) as any;
    expect(bodyEb01.status).toBe("apta");

    const resFora = await fetch(`${baseUrl}/api/simulator/card-status/FORGED-999`);
    expect(resFora.status).toBe(200);
    const bodyFora = (await resFora.json()) as any;
    expect(bodyFora.status).toBe("fora");
  });

  it("GET /api/simulator/card-status?set=ST01 filtra por set", async () => {
    const res = await fetch(`${baseUrl}/api/simulator/card-status?set=ST01`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.set).toBe("ST01");
    expect(body.summary.percentAptas).toBe(100);
    expect(body.cards["ST01-001"]).toBeDefined();
    expect(body.cards["EB01-001"]).toBeUndefined();
  });

  it("GET /api/simulator/card-status?flat=true retorna apenas o mapa de cartas", async () => {
    const res = await fetch(`${baseUrl}/api/simulator/card-status?flat=true`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body["ST01-001"].status).toBe("apta");
    expect(body.cards).toBeUndefined();
    expect(body.sets).toBeUndefined();
  });
});

describe("playabilityWhere (filtro \"Só aptas\" do catálogo no servidor)", () => {
  it("apta/revisao filtram pelos códigos com o mesmo veredito do card-status; fora exclui os dois", async () => {
    const { playabilityWhere, getAllCardStatuses } = await import("./cardStatus.ts");
    const cards = Object.values(getAllCardStatuses().cards);
    const apta = playabilityWhere("apta").code as { in: string[] };
    expect(apta.in).toContain("ST01-001");
    expect(apta.in.every((c) => getAllCardStatuses().cards[c].status === "apta")).toBe(true);
    expect(apta.in).toHaveLength(cards.filter((c) => c.status === "apta").length);
    const fora = playabilityWhere("fora").code as { notIn: string[] };
    expect(fora.notIn).toContain("ST01-001");
    expect(playabilityWhere(undefined)).toEqual({});
    expect(playabilityWhere("qualquer")).toEqual({});
  });
});
