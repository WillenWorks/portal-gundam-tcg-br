/* Regras de conteúdo da agenda do Instagram (funções puras, sem banco): rodízio de raridade da carta do dia. */

export type RarityTier = "LR" | "R" | "U" | "C";
export const RARITY_ROTATION: RarityTier[] = ["LR", "R", "U", "C"];

/** Como a raridade aparece na impressão principal (o banco tem os dois formatos, conforme a fonte). */
export const PRIMARY_RARITY_VALUES: Record<RarityTier, string[]> = {
  LR: ["LR", "Legend Rare"],
  R: ["R", "Rare"],
  U: ["U", "Uncommon"],
  C: ["C", "Common"],
};

/** Raridade do banco → faixa do rodízio. "+" marca arte alternativa da mesma faixa; Promo, token e recurso ficam de fora. */
export function rarityTier(rarity: string | null | undefined): RarityTier | null {
  const base = String(rarity ?? "").replace(/\+/g, "").trim().toLowerCase();
  if (base === "lr" || base === "legend rare") return "LR";
  if (base === "r" || base === "rare") return "R";
  if (base === "u" || base === "uncommon") return "U";
  if (base === "c" || base === "common") return "C";
  return null;
}

/** Ordem de tentativa depois do último post: a faixa seguinte primeiro; se faltar carta nela, as próximas. */
export function rarityAttemptOrder(last: RarityTier | null): RarityTier[] {
  const start = last ? (RARITY_ROTATION.indexOf(last) + 1) % RARITY_ROTATION.length : 0;
  return RARITY_ROTATION.map((_, i) => RARITY_ROTATION[(start + i) % RARITY_ROTATION.length]);
}
