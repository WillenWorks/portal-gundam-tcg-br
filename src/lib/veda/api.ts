// Cliente de API do Veda System (páginas de torneios, reports, decklists, jogadores e arquétipos)
// Contrato oficial em docs/agentes/CONTRATO-VEDA.md e tipos em src/lib/veda/types.ts

import { API_BASE_URL } from "@/lib/api";
import type {
  Paginated,
  VedaArchetypeDetail,
  VedaArchetypeRow,
  VedaCardUsage,
  VedaDecklist,
  VedaFilters,
  VedaPlayer,
  VedaSummary,
  VedaTier,
  VedaTournamentCard,
  VedaTournamentDetail,
} from "@/lib/veda/types";

export class VedaApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "VedaApiError";
    this.status = status;
  }
}

export interface VedaTournamentQueryParams {
  season?: string;
  tier?: VedaTier;
  source?: string;
  country?: string;
  uf?: string;
  city?: string;
  store?: string;
  q?: string;
  from?: string;
  to?: string;
  offset?: number;
  limit?: number;
}

export interface VedaArchetypesQueryParams {
  season?: string;
  /** "Brasil" = meta local; vazio = global */
  country?: string;
  uf?: string;
  tier?: VedaTier;
  from?: string;
  to?: string;
}

export interface VedaArchetypeDetailParams {
  season?: string;
  uf?: string;
}

export interface VedaPlayerParams {
  season?: string;
}

export interface VedaCardUsageParams {
  season?: string;
}

function buildQueryString(params?: Record<string, string | number | boolean | null | undefined>): string {
  if (!params) return "";
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

async function fetchVeda<T>(path: string, searchParams?: Record<string, any>): Promise<T> {
  const url = `${API_BASE_URL}${path}${buildQueryString(searchParams)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    let errorMsg = `Erro ${res.status} ao carregar dados do Veda.`;
    try {
      const data = await res.json();
      if (data?.error) {
        errorMsg = data.error;
      }
    } catch {
      // Ignora erro ao parsear JSON de erro
    }
    throw new VedaApiError(errorMsg, res.status);
  }

  return (await res.json()) as T;
}

export const vedaApi = {
  /** Resumo global do Veda (amostra, temporadas, fontes) */
  getSummary: (): Promise<VedaSummary> => {
    return fetchVeda<VedaSummary>("/veda/summary");
  },

  /** Filtros disponíveis para a busca de torneios */
  getFilters: (): Promise<VedaFilters> => {
    return fetchVeda<VedaFilters>("/veda/filters");
  },

  /** Lista paginada de torneios com filtros */
  getTournaments: (params?: VedaTournamentQueryParams): Promise<Paginated<VedaTournamentCard>> => {
    return fetchVeda<Paginated<VedaTournamentCard>>("/veda/tournaments", params);
  },

  /** Detalhe e report completo de um torneio */
  getTournament: (id: string): Promise<VedaTournamentDetail> => {
    return fetchVeda<VedaTournamentDetail>(`/veda/tournaments/${encodeURIComponent(id)}`);
  },

  /** Decklist registrada de uma inscrição no torneio */
  getDecklist: (entryId: string): Promise<VedaDecklist> => {
    return fetchVeda<VedaDecklist>(`/veda/decklists/${encodeURIComponent(entryId)}`);
  },

  /** Histórico e estatísticas de um jogador pelo slug */
  getPlayer: (slug: string, params?: VedaPlayerParams): Promise<VedaPlayer> => {
    return fetchVeda<VedaPlayer>(`/veda/players/${encodeURIComponent(slug)}`, params);
  },

  /** Ranking geral de arquétipos */
  getArchetypes: (params?: VedaArchetypesQueryParams): Promise<VedaArchetypeRow[]> => {
    return fetchVeda<VedaArchetypeRow[]>("/veda/archetypes", params);
  },

  /** Detalhes de um arquétipo pelo slug */
  getArchetype: (slug: string, params?: VedaArchetypeDetailParams): Promise<VedaArchetypeDetail> => {
    return fetchVeda<VedaArchetypeDetail>(`/veda/archetypes/${encodeURIComponent(slug)}`, params);
  },

  /** Uso de uma carta em torneios competitivos */
  getCardUsage: (cardModelId: string, params?: VedaCardUsageParams): Promise<VedaCardUsage> => {
    return fetchVeda<VedaCardUsage>(`/veda/cards/${encodeURIComponent(cardModelId)}`, params);
  },
};
