export const POST_TAG_LIMIT = 5;
const POST_TAG_MAX_LENGTH = 24;

// valem para qualquer artigo do site: como filtro não separam nada
const GENERIC_TAGS = new Set(["gundamcardgame", "gundamtcg", "gundam", "anaheimhub", "tcg"]);

/** Forma única da hashtag: "#Simulador", "simulador" e "Simuladór" são a mesma. */
export function normalizePostTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags = value.map((raw) =>
    String(raw)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, POST_TAG_MAX_LENGTH),
  );
  return [...new Set(tags)].filter((tag) => tag && !GENERIC_TAGS.has(tag)).slice(0, POST_TAG_LIMIT);
}
