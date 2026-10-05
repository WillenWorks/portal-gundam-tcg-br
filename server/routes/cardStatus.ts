import { Router, type Request, type Response } from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_CARD_DEFS, getCardDefByCode } from "../../src/modules/simulator/content/allCardDefs.ts";
import { isCardPlayable } from "../deckCoverageGate.ts";
import type { CardDef } from "../../src/modules/simulator/engine/types.ts";

export type PlayabilityStatus = "apta" | "revisao" | "fora";

export interface CardStatusEntry {
  code: string;
  name?: string;
  status: PlayabilityStatus;
  motivo?: string;
  set: string;
  missingClauses?: string[];
  totalClauses?: number;
  implementedClauses?: number;
}

export interface SetStatusSummary {
  set: string;
  total: number;
  aptas: number;
  revisao: number;
  fora: number;
  percentAptas: number;
}

export interface OverallStatusSummary {
  total: number;
  aptas: number;
  revisao: number;
  fora: number;
  percentAptas: number;
}

export interface CardStatusResponse {
  cards: Record<string, CardStatusEntry>;
  sets: Record<string, SetStatusSummary>;
  summary: OverallStatusSummary;
  [code: string]: unknown;
}

interface OfficialCardJson {
  code: string;
  name?: string;
  setCode?: string;
  cardType?: string;
  effect?: string;
}

interface ClauseCoverageCardJson {
  code: string;
  status?: string;
  clauses?: Array<{
    i: number;
    triggers?: string[];
    by?: string;
    text?: string;
  }>;
}

interface CoverageCardJson {
  code: string;
  name?: string;
  status?: string;
  deferredClauses?: string[];
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OFFICIAL_CARDS_PATH = path.join(REPO_ROOT, "data/gcg-official-cards.json");
const CLAUSE_COVERAGE_PATH = path.join(REPO_ROOT, "src/modules/simulator/content/_index/clause-coverage.json");
const COVERAGE_PATH = path.join(REPO_ROOT, "src/modules/simulator/content/_index/coverage.json");

let cachedResponse: CardStatusResponse | null = null;

function loadJsonSafe<T>(filePath: string): T | null {
  try {
    const raw = readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[cardStatus] Aviso: não foi possível carregar ${filePath}:`, err);
    return null;
  }
}

/**
 * Constrói o mapa de status de todas as cartas e o resumo por set.
 * A fonte da verdade para "apta" é 100% o retorno de `isCardPlayable(def)` de `deckCoverageGate.ts`.
 */
export function buildCardStatusResponse(): CardStatusResponse {
  const officialData = loadJsonSafe<{ cards: OfficialCardJson[] }>(OFFICIAL_CARDS_PATH);
  const clauseData = loadJsonSafe<{ sets: Record<string, { cards: ClauseCoverageCardJson[] }> }>(CLAUSE_COVERAGE_PATH);
  const covData = loadJsonSafe<{ sets: Record<string, { cards: CoverageCardJson[] }> }>(COVERAGE_PATH);

  const officialCards = officialData?.cards ?? [];

  // Mapeia cláusulas por código em maiúsculas
  const clauseByCode = new Map<string, ClauseCoverageCardJson>();
  if (clauseData?.sets) {
    for (const setObj of Object.values(clauseData.sets)) {
      if (Array.isArray(setObj?.cards)) {
        for (const card of setObj.cards) {
          if (card?.code) {
            clauseByCode.set(card.code.toUpperCase(), card);
          }
        }
      }
    }
  }

  // Mapeia coverage legado por código
  const legacyByCode = new Map<string, CoverageCardJson>();
  if (covData?.sets) {
    for (const setObj of Object.values(covData.sets)) {
      if (Array.isArray(setObj?.cards)) {
        for (const card of setObj.cards) {
          if (card?.code) {
            legacyByCode.set(card.code.toUpperCase(), card);
          }
        }
      }
    }
  }

  // Conjunto de todos os códigos conhecidos (oficiais + CardDefs do motor)
  const allCodes = new Set<string>();
  const officialMap = new Map<string, OfficialCardJson>();

  for (const c of officialCards) {
    if (c?.code) {
      const codeUpper = c.code.toUpperCase();
      allCodes.add(codeUpper);
      officialMap.set(codeUpper, c);
    }
  }

  for (const code of Object.keys(ALL_CARD_DEFS)) {
    allCodes.add(code.toUpperCase());
  }

  const cardsMap: Record<string, CardStatusEntry> = {};
  const setBuckets = new Map<string, { total: number; aptas: number; revisao: number; fora: number }>();

  function registerToSet(setName: string, status: PlayabilityStatus) {
    const s = setBuckets.get(setName) ?? { total: 0, aptas: 0, revisao: 0, fora: 0 };
    s.total++;
    if (status === "apta") s.aptas++;
    else if (status === "revisao") s.revisao++;
    else s.fora++;
    setBuckets.set(setName, s);
  }

  for (const code of allCodes) {
    const official = officialMap.get(code);
    const def: CardDef | undefined = getCardDefByCode(code);
    const clauseCard = clauseByCode.get(code);
    const legacyCard = legacyByCode.get(code);

    const name = official?.name ?? def?.nameEn;
    const rawSet = code.includes("-") ? code.split("-")[0] : (official?.setCode ?? "OUTROS");
    const set = rawSet.toUpperCase();

    let status: PlayabilityStatus;
    let motivo: string | undefined;
    let missingClauses: string[] | undefined;
    let totalClauses: number | undefined;
    let implementedClauses: number | undefined;

    if (!def) {
      status = "fora";
      motivo = "Fora do simulador: carta ainda não catalogada no motor.";
    } else {
      const playable = isCardPlayable(def);
      if (playable) {
        status = "apta";
        motivo = undefined;
      } else {
        status = "revisao";

        // Extrai cláusulas missing/partial
        const missing = clauseCard?.clauses
          ?.filter((cl) => cl.by === "missing" || cl.by === "partial")
          .map((cl) => cl.text?.trim())
          .filter((t): t is string => Boolean(t)) ?? [];

        const deferred = legacyCard?.deferredClauses ?? [];

        if (missing.length > 0) {
          missingClauses = missing;
          motivo = "Ainda em revisão no simulador: algumas cláusulas desta carta não foram implementadas.";
        } else if (deferred.length > 0) {
          motivo = "Ainda em revisão no simulador: carta possui cláusulas deferidas no motor.";
        } else {
          motivo = "Ainda em revisão no simulador: implementação incompleta no motor.";
        }
      }
    }

    if (clauseCard?.clauses) {
      totalClauses = clauseCard.clauses.length;
      implementedClauses = clauseCard.clauses.filter((cl) => cl.by !== "missing" && cl.by !== "partial").length;
    }

    const entry: CardStatusEntry = {
      code,
      name,
      status,
      motivo,
      set,
      ...(missingClauses && missingClauses.length > 0 ? { missingClauses } : {}),
      ...(totalClauses !== undefined ? { totalClauses, implementedClauses } : {}),
    };

    cardsMap[code] = entry;
    registerToSet(set, status);
  }

  // Gera resumo por set
  const setsMap: Record<string, SetStatusSummary> = {};
  let totalAll = 0;
  let aptasAll = 0;
  let revisaoAll = 0;
  let foraAll = 0;

  for (const [setName, stats] of setBuckets.entries()) {
    const percentAptas = stats.total > 0 ? Math.round((stats.aptas / stats.total) * 1000) / 10 : 0;
    setsMap[setName] = {
      set: setName,
      total: stats.total,
      aptas: stats.aptas,
      revisao: stats.revisao,
      fora: stats.fora,
      percentAptas,
    };
    totalAll += stats.total;
    aptasAll += stats.aptas;
    revisaoAll += stats.revisao;
    foraAll += stats.fora;
  }

  const overallPercent = totalAll > 0 ? Math.round((aptasAll / totalAll) * 1000) / 10 : 0;

  return {
    cards: cardsMap,
    sets: setsMap,
    summary: {
      total: totalAll,
      aptas: aptasAll,
      revisao: revisaoAll,
      fora: foraAll,
      percentAptas: overallPercent,
    },
    // Espalha as cartas no nível raiz para máxima compatibilidade com `res.body[code]`
    ...cardsMap,
  };
}

/**
 * Retorna a resposta completa com cache em memória (só muda com novo deploy/processo).
 */
export function getAllCardStatuses(): CardStatusResponse {
  if (!cachedResponse) {
    cachedResponse = buildCardStatusResponse();
  }
  return cachedResponse;
}

/**
 * Invalida o cache em memória (útil para testes).
 */
export function clearCardStatusCache(): void {
  cachedResponse = null;
}

/**
 * Consulta o status individual de uma carta por código.
 * Se o código não estiver no catálogo pré-computado, avalia dinamicamente.
 */
export function getCardStatus(code: string): CardStatusEntry {
  if (!code) {
    return {
      code: "",
      status: "fora",
      motivo: "Código inválido.",
      set: "OUTROS",
    };
  }
  const normalized = code.trim().toUpperCase();
  const all = getAllCardStatuses();
  const found = all.cards[normalized];
  if (found) return found;

  const def = getCardDefByCode(normalized);
  if (!def) {
    return {
      code: normalized,
      status: "fora",
      motivo: "Fora do simulador: código inexistente ou não catalogado no motor.",
      set: normalized.includes("-") ? normalized.split("-")[0] : "OUTROS",
    };
  }

  const playable = isCardPlayable(def);
  return {
    code: normalized,
    name: def.nameEn,
    status: playable ? "apta" : "revisao",
    motivo: playable ? undefined : "Ainda em revisão no simulador: pendente de validação no motor.",
    set: normalized.includes("-") ? normalized.split("-")[0] : "OUTROS",
  };
}

/**
 * Handler HTTP principal: GET /api/simulator/card-status
 */
export function handleGetCardStatus(req: Request, res: Response): void {
  const queryCode = typeof req.query.code === "string" ? req.query.code.trim() : undefined;
  if (queryCode) {
    res.json(getCardStatus(queryCode));
    return;
  }

  const querySet = typeof req.query.set === "string" ? req.query.set.trim().toUpperCase() : undefined;
  const data = getAllCardStatuses();

  if (querySet) {
    const setSummary = data.sets[querySet] ?? {
      set: querySet,
      total: 0,
      aptas: 0,
      revisao: 0,
      fora: 0,
      percentAptas: 0,
    };
    const setCards: Record<string, CardStatusEntry> = {};
    for (const [c, info] of Object.entries(data.cards)) {
      if (info.set === querySet) {
        setCards[c] = info;
      }
    }
    res.json({ set: querySet, summary: setSummary, cards: setCards });
    return;
  }

  if (req.query.flat === "true") {
    res.json(data.cards);
    return;
  }

  res.json(data);
}

/**
 * Handler HTTP para consulta por parâmetro de rota: GET /api/simulator/card-status/:code
 */
export function handleGetCardStatusByCode(req: Request, res: Response): void {
  const rawCode = req.params.code;
  const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;
  res.json(getCardStatus(code || ""));
}

export const cardStatusRouter = Router();

// Registra em ambos os formatos para garantir compatibilidade
// se montado como app.use(cardStatusRouter) ou app.use("/api/simulator/card-status", cardStatusRouter)
cardStatusRouter.get("/api/simulator/card-status", handleGetCardStatus);
cardStatusRouter.get("/api/simulator/card-status/:code", handleGetCardStatusByCode);
cardStatusRouter.get("/", handleGetCardStatus);
cardStatusRouter.get("/:code", handleGetCardStatusByCode);

export default cardStatusRouter;
