/**
 * Links de "onde comprar" para Gundam Card Game no Brasil: Liga Gundam (rede LigaMagic), MYP Cards,
 * Mercado Livre e Amazon Brasil.
 *
 * O que paga comissão de verdade (conferido em 23/10/2026):
 * - Amazon: o parâmetro `tag` do Associados vale em qualquer link da amazon.com.br, inclusive busca.
 *   Configure VITE_AMAZON_AFFILIATE_TAG (ex.: anaheimhub-20) depois que a conta for aprovada.
 * - MYP Cards: o programa de parceiros funciona por CUPOM (R$ 10 para o comprador e R$ 10 em crédito para o
 *   parceiro), não por link. Configure VITE_MYPCARDS_COUPON quando o cupom for liberado.
 * - Mercado Livre: o programa NÃO paga em páginas de busca (só em links de produto feitos no gerador de links
 *   do próprio ML). Por isso a busca aqui é só um link comum; produtos com link de afiliado entram curados.
 * - Liga Gundam: sem programa de afiliados público; é um link de comparação de preços.
 */

export type MarketplaceEnv = {
  amazonTag?: string;
  mypCoupon?: string;
};

const DEFAULT_ENV: MarketplaceEnv = {
  amazonTag: import.meta.env.VITE_AMAZON_AFFILIATE_TAG || "",
  mypCoupon: import.meta.env.VITE_MYPCARDS_COUPON || "",
};

const AMAZON_TAG_PATTERN = /^[A-Za-z0-9_-]{2,40}$/;
const COUPON_PATTERN = /^[A-Za-z0-9_-]{2,30}$/;

export interface CardMarketLinks {
  ligaGundamUrl: string;
  myPcardsUrl: string;
  mercadoLivreUrl: string;
  amazonUrl: string;
  /** links que geram comissão para o portal (marcados como rel="sponsored") */
  sponsored: { amazon: boolean };
  /** cupom de parceiro da MYP Cards, quando houver */
  mypCoupon: string | null;
}

export interface SetMarketLinks {
  ligaGundamUrl: string;
  mercadoLivreUrl: string;
  amazonUrl: string;
}

function amazonSearch(query: string, env: MarketplaceEnv): string {
  const url = new URL("https://www.amazon.com.br/s");
  url.searchParams.set("k", query);
  const tag = (env.amazonTag || "").trim();
  if (AMAZON_TAG_PATTERN.test(tag)) url.searchParams.set("tag", tag);
  return url.toString();
}

/** Links de busca e compra para uma carta pelo código (ex.: ST01-001) e/ou nome. */
export function getCardMarketLinks(
  params: { code?: string | null; namePt?: string | null; nameEn?: string | null; setCode?: string | null },
  env: MarketplaceEnv = DEFAULT_ENV,
): CardMarketLinks {
  const code = (params.code || "").trim();
  const cardName = (params.nameEn || "").trim() || (params.namePt || "").trim();
  const query = code || cardName;
  const searchText = `gundam card game ${query}`;
  const amazonTag = (env.amazonTag || "").trim();
  const coupon = (env.mypCoupon || "").trim();

  return {
    ligaGundamUrl: `https://www.ligagundam.com.br/?view=cards/card&card=${encodeURIComponent(query)}`,
    myPcardsUrl: `https://mypcards.com/gundam?search=${encodeURIComponent(query)}`,
    mercadoLivreUrl: `https://lista.mercadolivre.com.br/${encodeURIComponent(searchText)}`,
    amazonUrl: amazonSearch(searchText, env),
    sponsored: { amazon: AMAZON_TAG_PATTERN.test(amazonTag) },
    mypCoupon: COUPON_PATTERN.test(coupon) ? coupon.toUpperCase() : null,
  };
}

/** Links para produtos selados (Starter Decks, Booster Boxes). */
export function getSetMarketLinks(setCode: string, setName?: string, env: MarketplaceEnv = DEFAULT_ENV): SetMarketLinks {
  const cleanCode = (setCode || "").trim();
  const cleanName = (setName || "").trim();
  const productType = /^st/i.test(cleanCode) ? "starter deck" : /^gd/i.test(cleanCode) ? "booster box" : "cards";
  const query = `gundam card game ${cleanCode} ${productType} ${cleanName}`.trim();
  return {
    ligaGundamUrl: `https://www.ligagundam.com.br/?view=cards/search&card=${encodeURIComponent(cleanCode)}`,
    mercadoLivreUrl: `https://lista.mercadolivre.com.br/${encodeURIComponent(query)}`,
    amazonUrl: amazonSearch(query, env),
  };
}
