import { SUPPORTER_TIERS } from "./supporters";

/* Página "Apoie o Anaheim Hub" (/apoie). Mesmo esquema da /sobre: o texto mora aqui e é lido pelo React
 * (SupportPage.tsx) e pelo HTML que o servidor entrega (server/htmlContent.ts → supportBody).
 *
 * Os canais que dependem de conta (Apoia.se/Ko-fi, chave Pix, Instagram, Discord, cupom da MYP) vêm de variáveis
 * VITE_* do .env: sem a variável, o canal simplesmente não aparece. O servidor lê as mesmas variáveis do .env. */

export type SupportEnv = {
  supportUrl?: string;
  pixKey?: string;
  instagramUrl?: string;
  discordUrl?: string;
  mypCoupon?: string;
};

/** Custo mensal aproximado mostrado na página (transparência). Atualize quando o plano mudar. */
export const SUPPORT_MONTHLY_COST = "cerca de R$ 40 por mês";

export type SupportChannel = { title: string; text: string; href?: string; cta?: string; copy?: string };

const httpsOnly = (url: string | undefined) => (url && /^https:\/\/[^\s"'<>]+$/.test(url.trim()) ? url.trim() : undefined);

/** Canais na ordem em que ajudam mais com menos esforço de quem apoia. Só entram os configurados. */
export function supportChannels(env: SupportEnv): SupportChannel[] {
  const channels: SupportChannel[] = [];
  const supportUrl = httpsOnly(env.supportUrl);
  if (supportUrl) channels.push({ title: "Apoio mensal no Apoia.se", text: "A partir de R$ 5 por mês você ganha uma patente: selo de Apoiador no perfil e seu nome no mural desta página. É o que paga o servidor de forma previsível.", href: supportUrl, cta: "Quero apoiar" });
  const pix = env.pixKey?.trim();
  if (pix) channels.push({ title: "Pix", text: "Uma contribuição única, do valor que você quiser, direto pelo Pix.", copy: pix });
  const coupon = env.mypCoupon?.trim();
  if (coupon) channels.push({ title: `Cupom ${coupon} na MYP Cards`, text: `Compras acima de R$ 300 na MYP Cards com o cupom ${coupon} ganham R$ 10 de desconto e geram crédito para o Anaheim Hub, sem custo extra para você.`, href: "https://mypcards.com", cta: "Ir para a MYP Cards" });
  channels.push({ title: "Comprar pelos nossos links", text: "Nas páginas de carta e nos artigos, os links marcados como publicidade levam a lojas parceiras. A loja paga uma pequena comissão ao site; o preço para você é o mesmo." });
  const instagram = httpsOnly(env.instagramUrl);
  if (instagram) channels.push({ title: "Seguir e compartilhar", text: "Spoilers, metagame e novidades todo dia no Instagram. Compartilhar um post ajuda o site a chegar a mais jogadores.", href: instagram, cta: "Abrir o Instagram" });
  const discord = httpsOnly(env.discordUrl);
  if (discord) channels.push({ title: "Comunidade no Discord", text: "Tire dúvidas de regra, mande correções e acompanhe os spoilers com outros jogadores.", href: discord, cta: "Entrar no Discord" });
  channels.push({ title: "Mandar correções e resultados", text: "Achou um erro numa carta, regra ou torneio? Organizou um evento? Escreva para admin@anaheimhub.com: conteúdo certo é o que mantém o site útil." });
  return channels;
}

export const SUPPORT_TITLE = "Apoie o Anaheim Hub";
export const SUPPORT_LEAD =
  "O Anaheim Hub é gratuito e independente. Manter catálogo, torneios, regras e simulador no ar custa " +
  SUPPORT_MONTHLY_COST +
  " em servidor e domínio, pagos com anúncios, links de afiliado e a ajuda de quem usa o site.";

export const SUPPORT_WHY = [
  "Todo o conteúdo continua aberto, sem conta e sem paywall: as recompensas são reconhecimento e bastidores, nunca conteúdo trancado.",
  "O dinheiro vai primeiro para o servidor e o domínio. O que sobrar paga ferramentas que melhoram o site, como a leitura automática dos spoilers.",
];

/** O que cada patente do Apoia.se recebe (patentes em src/lib/supporters.ts). Cada uma inclui as anteriores. */
export const SUPPORT_TIER_PERKS: Record<string, string[]> = {
  RECRUTA: ["Seu nome no mural de apoiadores desta página", "Agradecimento no post mensal do Instagram"],
  PILOTO: ["Selo de Apoiador · Piloto no seu perfil e nos comentários", "Voto na enquete mensal do próximo artigo ou recurso"],
  AS: ["Convite para testar novidades do simulador antes de todo mundo", "Seu deck analisado em artigo ou story (até 3 por mês)"],
  COMANDANTE: ["Suas sugestões com prioridade na lista de próximas funções", "Destaque no topo do mural"],
};

export const SUPPORTERS_TITLE = "Mural de apoiadores";
export const SUPPORTERS_LEAD =
  "Quem mantém o hangar funcionando: cada nome aqui ajuda a pagar o servidor, a tradução dos spoilers e a evolução do simulador. O Anaheim Hub continua gratuito para todo mundo graças a essas pessoas. Muito obrigado!";

export type SupporterGroup<T> = { key: string; title: string; icon?: string; supporters: T[] };

/** Agrupa o mural por patente, da mais alta para a mais baixa; quem não tem patente fica em "Apoiadores". */
export function groupSupportersByTier<T extends { tier?: string | null }>(supporters: T[]): SupporterGroup<T>[] {
  const groups: SupporterGroup<T>[] = [...SUPPORTER_TIERS]
    .reverse()
    .map((t) => ({ key: t.key, title: t.label === "Ás" ? "Ases" : `${t.label}s`, icon: t.icon, supporters: supporters.filter((s) => s.tier === t.key) }));
  groups.push({ key: "SEM_PATENTE", title: "Apoiadores", supporters: supporters.filter((s) => !SUPPORTER_TIERS.some((t) => t.key === s.tier)) });
  return groups.filter((g) => g.supporters.length > 0);
}

