/**
 * Utilitários de Marketplace e Afiliados para Gundam Card Game no Brasil.
 *
 * Gera links de busca direcionada e afiliados para:
 * - Liga Gundam (Rede LigaMagic)
 * - MyPcards
 * - Mercado Livre
 * - Amazon Brasil
 */

const ML_AFFILIATE_TAG = import.meta.env.VITE_MERCADOLIVRE_AFFILIATE_TAG || "";
const AMAZON_AFFILIATE_TAG = import.meta.env.VITE_AMAZON_AFFILIATE_TAG || "";
const LIGA_AFFILIATE_TAG = import.meta.env.VITE_LIGAGUNDAM_AFFILIATE_TAG || "";
const MYPCARDS_AFFILIATE_TAG = import.meta.env.VITE_MYPCARDS_AFFILIATE_TAG || "";

export interface CardMarketLinks {
  ligaGundamUrl: string;
  myPcardsUrl: string;
  mercadoLivreUrl: string;
  amazonUrl: string;
}

export interface SetMarketLinks {
  ligaGundamUrl: string;
  mercadoLivreUrl: string;
  amazonUrl: string;
}

/**
 * Gera links de busca e compra para uma carta individual pelo seu código (ex: ST01-001) e nome.
 */
export function getCardMarketLinks(params: {
  code?: string | null;
  namePt?: string | null;
  nameEn?: string | null;
  setCode?: string | null;
}): CardMarketLinks {
  const code = (params.code || "").trim();
  const nameEn = (params.nameEn || "").trim();
  const namePt = (params.namePt || "").trim();
  const cardName = nameEn || namePt;

  // 1. Liga Gundam (Rede LigaMagic) - busca direta pelo código da carta ou nome
  const ligaQuery = code || cardName;
  const ligaBase = `https://www.ligagundam.com.br/?view=cards/card&card=${encodeURIComponent(ligaQuery)}`;
  const ligaGundamUrl = LIGA_AFFILIATE_TAG ? `${ligaBase}&ref=${encodeURIComponent(LIGA_AFFILIATE_TAG)}` : ligaBase;

  // 2. MyPcards - plataforma brasileira de compra e venda de TCG
  const mypQuery = code || cardName;
  const mypBase = `https://mypcards.com/gundam?search=${encodeURIComponent(mypQuery)}`;
  const myPcardsUrl = MYPCARDS_AFFILIATE_TAG ? `${mypBase}&ref=${encodeURIComponent(MYPCARDS_AFFILIATE_TAG)}` : mypBase;

  // 3. Mercado Livre - busca por Gundam Card Game + código ou nome
  const mlQuery = code ? `gundam card game ${code}` : `gundam card game ${cardName}`;
  const mlBase = `https://lista.mercadolivre.com.br/${encodeURIComponent(mlQuery)}`;
  const mercadoLivreUrl = ML_AFFILIATE_TAG ? `${mlBase}#origin=${encodeURIComponent(ML_AFFILIATE_TAG)}` : mlBase;

  // 4. Amazon Brasil - busca especializada
  const amazonQuery = code ? `gundam card game ${code}` : `gundam card game ${cardName}`;
  const amazonBase = `https://www.amazon.com.br/s?k=${encodeURIComponent(amazonQuery)}`;
  const amazonUrl = AMAZON_AFFILIATE_TAG ? `${amazonBase}&tag=${encodeURIComponent(AMAZON_AFFILIATE_TAG)}` : amazonBase;

  return {
    ligaGundamUrl,
    myPcardsUrl,
    mercadoLivreUrl,
    amazonUrl,
  };
}

/**
 * Gera links para coleções/expansões seladas (Starter Decks, Booster Boxes).
 */
export function getSetMarketLinks(setCode: string, setName?: string): SetMarketLinks {
  const cleanCode = (setCode || "").trim();
  const cleanName = (setName || "").trim();
  const isStarter = /^st/i.test(cleanCode);
  const isBooster = /^gd/i.test(cleanCode);

  const productType = isStarter ? "starter deck" : isBooster ? "booster box" : "cards";
  const query = `gundam card game ${cleanCode} ${productType} ${cleanName}`.trim();

  const mlBase = `https://lista.mercadolivre.com.br/${encodeURIComponent(query)}`;
  const amazonBase = `https://www.amazon.com.br/s?k=${encodeURIComponent(query)}`;
  const ligaBase = `https://www.ligagundam.com.br/?view=cards/search&card=${encodeURIComponent(cleanCode)}`;

  return {
    ligaGundamUrl: LIGA_AFFILIATE_TAG ? `${ligaBase}&ref=${encodeURIComponent(LIGA_AFFILIATE_TAG)}` : ligaBase,
    mercadoLivreUrl: ML_AFFILIATE_TAG ? `${mlBase}#origin=${encodeURIComponent(ML_AFFILIATE_TAG)}` : mlBase,
    amazonUrl: AMAZON_AFFILIATE_TAG ? `${amazonBase}&tag=${encodeURIComponent(AMAZON_AFFILIATE_TAG)}` : amazonBase,
  };
}
