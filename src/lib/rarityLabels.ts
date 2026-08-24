/* Normalização de raridade -- o catálogo guarda a raridade "crua" por impressão, e boa
 * parte das cartas tem variações de foil/parallel marcadas com sufixo "+"/"++" ou código
 * curto (C, U, R, LR) em vez do nome completo (ex: "C+", "LR++" ao lado de "Common",
 * "Legend Rare"). Pro filtro e pro badge, essas variações devem contar como a raridade
 * base -- só "Promo" fica de fora do agrupamento, por ser categoria própria (impressão
 * promocional), não uma variante de foil de outra raridade.
 */
const SHORT_CODE_LABELS: Record<string, string> = {
  C: "Common",
  U: "Uncommon",
  R: "Rare",
  LR: "Legend Rare",
  SR: "Super Rare",
  SEC: "Secret",
  P: "Promo",
};

export function normalizeRarityLabel(raw: string | undefined | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const base = trimmed.replace(/\+{1,}$/, "").trim();
  return SHORT_CODE_LABELS[base.toUpperCase()] ?? base;
}

/** Agrupa uma lista de raridades "cruas" (como vêm da API) por rótulo canônico -- usado
 * pra popular o filtro com os rótulos canônicos e, na hora de consultar a API, expandir
 * de volta pra lista de valores crus que aquele rótulo representa. */
export function groupRaritiesByLabel(rawRarities: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const raw of rawRarities) {
    const label = normalizeRarityLabel(raw);
    if (!label) continue;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(raw);
  }
  return groups;
}

/** Expande um valor de filtro (rótulo(s) canônico(s), separados por vírgula) pra lista
 * de valores crus equivalentes, unidos por vírgula -- formato que a API espera (mesmo
 * padrão de cor/trait: `?rarity=Common,C+,C++`). Rótulo sem grupo conhecido passa
 * direto, pra não quebrar um valor cru vindo de um link antigo. */
export function expandRarityFilter(value: string, groups: Map<string, string[]>): string {
  const labels = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!labels.length) return "";
  const raw = labels.flatMap((label) => groups.get(label) ?? [label]);
  return Array.from(new Set(raw)).join(",");
}
