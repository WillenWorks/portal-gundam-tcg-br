/**
 * Patentes de apoiador e tags de usuário — catálogo único usado pelo site, pelo servidor e pelo painel admin.
 *
 * Patente: espelha as recompensas da campanha no Apoia.se (https://apoia.se/anaheimhubupgrades). Quem apoia
 * ganha o selo "Apoiador · <patente>" no perfil e entra no mural de /apoie.
 * Tags: marcas de reconhecimento que o admin dá a quem faz algo pela comunidade; um usuário pode ter várias.
 * Chave nova só entra aqui — o servidor recusa chave fora do catálogo.
 */

export const SUPPORTER_TIERS = [
  { key: "RECRUTA", label: "Recruta", labelEn: "Recruit", minMonthly: 5, icon: "🎖️" },
  { key: "PILOTO", label: "Piloto", labelEn: "Pilot", minMonthly: 10, icon: "🏷️" },
  { key: "AS", label: "Ás", labelEn: "Ace", minMonthly: 25, icon: "⭐" },
  { key: "COMANDANTE", label: "Comandante", labelEn: "Commander", minMonthly: 50, icon: "👑" },
] as const;

export type SupporterTier = (typeof SUPPORTER_TIERS)[number]["key"];

export const USER_TAGS = [
  { key: "EQUIPE", label: "Equipe Anaheim", labelEn: "Anaheim Staff", tone: "primary" },
  { key: "BETA", label: "Testador beta", labelEn: "Beta tester", tone: "emerald" },
  { key: "ORGANIZADOR", label: "Organizador", labelEn: "Organizer", tone: "amber" },
  { key: "JUIZ", label: "Juiz", labelEn: "Judge", tone: "violet" },
  { key: "CRIADOR", label: "Criador de conteúdo", labelEn: "Content creator", tone: "pink" },
  { key: "TRADUTOR", label: "Tradutor", labelEn: "Translator", tone: "sky" },
  { key: "CAMPEAO", label: "Campeão", labelEn: "Champion", tone: "yellow" },
  { key: "CACADOR_BUGS", label: "Caçador de bugs", labelEn: "Bug hunter", tone: "red" },
] as const;

export type UserTagKey = (typeof USER_TAGS)[number]["key"];

const TIER_KEYS = new Set<string>(SUPPORTER_TIERS.map((t) => t.key));
const TAG_KEYS = new Set<string>(USER_TAGS.map((t) => t.key));

export const isSupporterTier = (value: unknown): value is SupporterTier => typeof value === "string" && TIER_KEYS.has(value);
export const isUserTag = (value: unknown): value is UserTagKey => typeof value === "string" && TAG_KEYS.has(value);

export const supporterTierInfo = (key: string | null | undefined) => SUPPORTER_TIERS.find((t) => t.key === key) ?? null;
export const userTagInfo = (key: string) => USER_TAGS.find((t) => t.key === key) ?? null;

/** Ordem do mural: patente mais alta primeiro (Comandante → Recruta → sem patente). */
export const supporterTierRank = (key: string | null | undefined): number => {
  const index = SUPPORTER_TIERS.findIndex((t) => t.key === key);
  return index === -1 ? -1 : index;
};

/** Tags válidas, sem repetição, na ordem do catálogo. */
export function normalizeUserTags(values: unknown): UserTagKey[] {
  if (!Array.isArray(values)) return [];
  const wanted = new Set(values.filter(isUserTag));
  return USER_TAGS.map((t) => t.key).filter((key) => wanted.has(key));
}
