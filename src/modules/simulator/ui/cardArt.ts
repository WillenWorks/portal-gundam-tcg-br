/* docs/19, Sessão 3 — tipos + helper puro de "melhor URL de arte" (sem JSX,
 * pra não quebrar o Fast Refresh dos componentes que o consomem). Os
 * componentes visuais (`CardFace`, `CardBack`) vivem em `CardFace.tsx`. */
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

/** Melhor URL de arte disponível pra um `code`, preferindo a resolução certa pro tamanho pedido. */
export function artSrc(art: ArtLookup, code: string, size: CardFaceSize): string | undefined {
  const entry = art[code];
  if (!entry) return undefined;
  const wantsBig = size === "md" || size === "lg" || size === "xl";
  return wantsBig ? (entry.imageUrl ?? entry.imageSmallUrl) : (entry.imageSmallUrl ?? entry.imageUrl);
}
