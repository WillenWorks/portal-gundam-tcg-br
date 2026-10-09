import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { CardArt, ArtLookup } from "./cardArt";

export type { CardArt, ArtLookup };

export interface CardArtLookup {
  art: ArtLookup;
  artLoading: boolean;
  /** code -> { pt, en } do efeito */
  cardText: Record<string, { pt?: string; en?: string }>;
  /** nameEn / namePt minúsculo -> { code, art } — pra resolver o piloto de um link `pilotName` */
  cardByName: Record<string, { code: string; art: CardArt }>;
}

export const CANONICAL_ART_ALIASES: Record<string, string> = {
  "ST01-RESOURCE": "R-001",
  "ST02-RESOURCE": "R-001",
  "ST03-RESOURCE": "R-001",
  "ST04-RESOURCE": "R-001",
  "ST05-RESOURCE": "R-001",
  "ST06-RESOURCE": "R-001",
  "ST07-RESOURCE": "R-001",
  "ST08-RESOURCE": "R-001",
  "ST09-RESOURCE": "R-001",
  "ST10-RESOURCE": "R-001",
  "RESOURCE-01": "R-001",
  "TOKEN-EX-BASE": "EXB-001",
  "TOKEN-EX-RESOURCE": "EXR-001",
  "TOKEN-GUNDAM": "T-001",
  "TOKEN-GUNCANNON": "T-002",
  "TOKEN-GUNTANK": "T-003",
  "TOKEN-GM": "T-004",
  "TOKEN-CORE-FIGHTER": "T-005",
  "TOKEN-TALLGEESE": "T-006",
  "TOKEN-LEO": "T-007",
  "TOKEN-ZAKU-II": "T-008",
  "TOKEN-FATUM-00": "T-009",
  "TOKEN-MOBILE-WORKER": "T-010",
  "TOKEN-DAUGHTRESS": "T-012",
};

interface CachedLookup {
  art: ArtLookup;
  cardText: Record<string, { pt?: string; en?: string }>;
  cardByName: Record<string, { code: string; art: CardArt }>;
}

let inMemoryLookup: CachedLookup | null = null;
let inFlightPromise: Promise<CachedLookup> | null = null;

/**
 * Carrega e indexa todas as artes e textos de cartas do portal em cache de memória único.
 * Suporta 100% das coleções (ST01-ST10, GD01-GD05, EB01, R, T, EXB, EXR).
 */
export async function loadSimulatorCardLookup(): Promise<CachedLookup> {
  if (inMemoryLookup) {
    return inMemoryLookup;
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    const art: ArtLookup = {};
    const cardText: Record<string, { pt?: string; en?: string }> = {};
    const cardByName: Record<string, { code: string; art: CardArt }> = {};

    // Injeta primeiro as traduções pré-compiladas oficiais como base (chunk à parte, carregado só aqui)
    const { PRECOMPILED_CARD_TRANSLATIONS } = await import("@/i18n/translatedCardsData");
    for (const [code, trans] of Object.entries(PRECOMPILED_CARD_TRANSLATIONS)) {
      const upper = code.toUpperCase();
      cardText[upper] = {
        pt: trans.pt || undefined,
        en: trans.en || undefined,
      };
    }

    try {
      // Busca todas as cartas ativas cadastradas no portal em requisição única
      const list = await api.listCards({});
      for (const raw of list) {
        if (!raw?.code) continue;
        const code = String(raw.code).trim().toUpperCase();
        const entry: CardArt = {
          imageUrl: (raw.imageMediumUrl ?? raw.imageUrl) || undefined,
          imageSmallUrl: (raw.imageSmallUrl ?? raw.imageMediumUrl ?? raw.imageUrl) || undefined,
        };

        art[code] = entry;

        // Efeito traduzido: prioriza o que vem do banco se tiver, ou o pré-compilado oficial
        const existing = cardText[code] || {};
        const pt = raw.effectPt || existing.pt || undefined;
        const en = raw.effectEn || existing.en || undefined;
        if (pt || en) {
          cardText[code] = { pt, en };
        }

        if (raw.nameEn) {
          cardByName[String(raw.nameEn).trim().toLowerCase()] = { code, art: entry };
        }
        if (raw.namePt) {
          cardByName[String(raw.namePt).trim().toLowerCase()] = { code, art: entry };
        }
      }
    } catch (err) {
      console.warn("[SimulatorCardLookup] Falha ao carregar catálogo online; usando fallback local.", err);
    }

    // Aliases do motor -> arte canônica do catálogo
    for (const [alias, real] of Object.entries(CANONICAL_ART_ALIASES)) {
      const upperAlias = alias.toUpperCase();
      const upperReal = real.toUpperCase();
      if (art[upperReal] && !art[upperAlias]) {
        art[upperAlias] = art[upperReal];
      }
      if (cardText[upperReal] && !cardText[upperAlias]) {
        cardText[upperAlias] = cardText[upperReal];
      }
    }

    // Fallback curinga: qualquer código com "-RESOURCE" aponta pra R-001 se não tiver arte própria
    const r001Art = art["R-001"];
    if (r001Art) {
      for (let i = 1; i <= 20; i++) {
        const pad = String(i).padStart(2, "0");
        const resCode = `ST${pad}-RESOURCE`;
        if (!art[resCode]) {
          art[resCode] = r001Art;
        }
      }
    }

    inMemoryLookup = { art, cardText, cardByName };
    return inMemoryLookup;
  })();

  return inFlightPromise;
}

/**
 * Hook para consumo reativo e instantâneo da arte e textos de cartas no simulador.
 */
export function useCardArtLookup(): CardArtLookup {
  const [state, setState] = useState<CachedLookup>(() => inMemoryLookup ?? { art: {}, cardText: {}, cardByName: {} });
  const [artLoading, setArtLoading] = useState(!inMemoryLookup);

  useEffect(() => {
    let cancelled = false;
    loadSimulatorCardLookup()
      .then((res) => {
        if (!cancelled) {
          setState(res);
          setArtLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setArtLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, artLoading };
}
