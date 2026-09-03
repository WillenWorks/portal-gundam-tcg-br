/* docs/19, Sessão 3 — tipos + helper puro de "melhor URL de arte" (sem JSX,
 * pra não quebrar o Fast Refresh dos componentes que o consomem). Os
 * componentes visuais (`CardFace`, `CardBack`) vivem em `CardFace.tsx`. */
import cardBackUrl from "@/assets/gundam-card-back.png";

/** arte do verso — Sprint 6. Verso de qualquer carta virada pra baixo + fallback
 *  de recursos/EX/tokens enquanto só rodamos ST01/ST02 (ver `isGenericArtCard`). */
export { cardBackUrl };

export type CardArt = { imageUrl?: string; imageSmallUrl?: string };
export type ArtLookup = Record<string, CardArt>;

export type CardFaceSize = "xs" | "sm" | "md" | "lg" | "xl";

export const CARD_FACE_WIDTH: Record<CardFaceSize, string> = {
  xs: "w-9",
  sm: "w-14",
  md: "w-20",
  lg: "w-28",
  xl: "w-40",
};

/**
 * Enquanto o simulador só roda ST01/ST02: recursos, EX Base, EX Resource e
 * tokens não têm arte própria — usam o verso padrão (`gundam-card-back.png`).
 * Decks criados pelo usuário trazem a arte escolhida em `art[code]` e ela ganha
 * prioridade (ver `CardFace`, que só cai no verso quando `artSrc` volta vazio).
 */
export function isGenericArtCard(cardType: string, isToken?: boolean): boolean {
  return cardType === "RESOURCE" || isToken === true;
}

/** Melhor URL de arte disponível pra um `code`, preferindo a resolução certa pro tamanho pedido. */
export function artSrc(art: ArtLookup, code: string, size: CardFaceSize): string | undefined {
  const entry = art[code];
  if (!entry) return undefined;
  const wantsBig = size === "md" || size === "lg" || size === "xl";
  return wantsBig ? (entry.imageUrl ?? entry.imageSmallUrl) : (entry.imageSmallUrl ?? entry.imageUrl);
}
