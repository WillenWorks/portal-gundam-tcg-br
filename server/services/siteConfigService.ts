import fs from "node:fs";
import path from "node:path";

export interface SiteAnnouncement {
  active: boolean;
  message: string;
  type: "INFO" | "WARNING" | "SUCCESS" | "URGENT";
  link?: string;
  linkText?: string;
  updatedAt?: string;
}

export interface SiteSeoConfig {
  metaTitleDefault: string;
  metaDescriptionDefault: string;
  targetKeywords: string[];
  googleAnalyticsId?: string;
  googleSearchConsoleTag?: string;
}

export interface SiteMonetizationConfig {
  adsEnabled: boolean;
  adSenseClientId: string;
  slots: {
    topBanner: boolean;
    sidebarBanner: boolean;
    inArticleSponsored: boolean;
    torneiosSponsored: boolean;
  };
  estimatedRpmBrl: number;
}

export interface SiteMetagameConfig {
  featuredDeckId?: string | null;
  featuredTournamentId?: string | null;
  maintenanceMode: boolean;
  maintenanceNotice?: string;
}

export interface SiteConfig {
  announcement: SiteAnnouncement;
  seo: SiteSeoConfig;
  monetization: SiteMonetizationConfig;
  metagame: SiteMetagameConfig;
  updatedAt: string;
}

const DEFAULT_CONFIG: SiteConfig = {
  announcement: {
    active: true,
    message: "Bem-vindo ao Anaheim Hub — Portal Oficial da Comunidade Gundam Card Game Brasil! Teste o Simulador Beta e explore o metagame.",
    type: "INFO",
    link: "/simulador",
    linkText: "Abrir Simulador",
    updatedAt: new Date().toISOString(),
  },
  seo: {
    metaTitleDefault: "Portal Gundam TCG Brasil | Anaheim Hub — Database, Simulador & Metagame",
    metaDescriptionDefault: "O hub brasileiro definitivo de Gundam Card Game: catálogo completo de cartas traduzido em pt-BR, deckbuilder avançado, simulador em tempo real e relatórios de torneio Veda.",
    targetKeywords: [
      "Gundam Card Game Brasil",
      "Gundam TCG",
      "Simulador Gundam TCG",
      "Deckbuilder Gundam",
      "Metagame Gundam TCG",
      "Regras Gundam TCG pt-BR",
      "Anaheim Hub",
      "Cartas Gundam TCG",
    ],
    googleAnalyticsId: "",
    googleSearchConsoleTag: "",
  },
  monetization: {
    adsEnabled: true,
    adSenseClientId: "ca-pub-anaheim-portal",
    slots: {
      topBanner: true,
      sidebarBanner: true,
      inArticleSponsored: true,
      torneiosSponsored: true,
    },
    estimatedRpmBrl: 14.5,
  },
  metagame: {
    featuredDeckId: null,
    featuredTournamentId: null,
    maintenanceMode: false,
    maintenanceNotice: "Servidores em atualização programada. O simulador voltará em instantes.",
  },
  updatedAt: new Date().toISOString(),
};

const CONFIG_PATH = path.resolve(process.cwd(), "data", "site-config.json");

let memoryConfigCache: SiteConfig | null = null;

export function getSiteConfig(): SiteConfig {
  if (memoryConfigCache) {
    return memoryConfigCache;
  }

  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      memoryConfigCache = {
        ...DEFAULT_CONFIG,
        ...parsed,
        announcement: { ...DEFAULT_CONFIG.announcement, ...(parsed.announcement || {}) },
        seo: { ...DEFAULT_CONFIG.seo, ...(parsed.seo || {}) },
        monetization: { ...DEFAULT_CONFIG.monetization, ...(parsed.monetization || {}) },
        metagame: { ...DEFAULT_CONFIG.metagame, ...(parsed.metagame || {}) },
      };
      return memoryConfigCache!;
    }
  } catch (err) {
    console.error("[SiteConfig] Erro ao ler site-config.json, usando padrão:", err);
  }

  memoryConfigCache = { ...DEFAULT_CONFIG };
  return memoryConfigCache;
}

export function updateSiteConfig(partial: Partial<SiteConfig>): SiteConfig {
  const current = getSiteConfig();
  const updated: SiteConfig = {
    ...current,
    ...partial,
    announcement: partial.announcement ? { ...current.announcement, ...partial.announcement } : current.announcement,
    seo: partial.seo ? { ...current.seo, ...partial.seo } : current.seo,
    monetization: partial.monetization ? { ...current.monetization, ...partial.monetization } : current.monetization,
    metagame: partial.metagame ? { ...current.metagame, ...partial.metagame } : current.metagame,
    updatedAt: new Date().toISOString(),
  };

  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), "utf-8");
  } catch (err) {
    console.error("[SiteConfig] Falha ao persistir site-config.json:", err);
  }

  memoryConfigCache = updated;
  return updated;
}
