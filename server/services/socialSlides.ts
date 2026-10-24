/* Slides 1080x1350 (4:5) dos posts do Instagram: moldura comum (marca, selo, aviso de fã, endereço) e o desenho de
 * cada tipo de slide. Todo dado que vem do banco passa por escapeHtml. A renderização em JPEG abre um navegador só
 * para todos os slides do post. */
import fs from "node:fs";
import path from "node:path";
import type { FeaturedDeck, ReportArchetype, WeeklyReport, WeeklyTournament } from "./socialContent";

export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350;

/** Paleta de cores oficial de Gundam Card Game */
export const COLOR_HEX: Record<string, string> = {
  blue: "#38bdf8",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#facc15",
  black: "#94a3b8",
  white: "#f8fafc",
  purple: "#c084fc",
};

export const accentFor = (color: string | null | undefined) => COLOR_HEX[String(color ?? "").toLowerCase()] || "#38bdf8";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Só imagem em https entra no slide (o resto vira placeholder). */
export const safeImageUrl = (url: string | null | undefined) => (url && /^https:\/\//i.test(url) ? url : "");

type FrameInput = {
  badge: string;
  accent?: string;
  body: string;
  css?: string;
  /** chamada do rodapé (padrão: simulador) */
  cta?: string;
  /** posição no carrossel, ex.: "2/5" */
  pager?: string;
};

/** Documento completo de um slide: cabeçalho com marca e selo, conteúdo, rodapé com aviso de fã e endereço. */
export function slideDocument({ badge, accent = "#38bdf8", body, css = "", cta = "Monte seu deck e jogue online no simulador", pager }: FrameInput): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  body { width: ${SLIDE_WIDTH}px; height: ${SLIDE_HEIGHT}px; background: radial-gradient(circle at 50% 20%, #0f172a 0%, #020617 100%); color: #f8fafc; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; padding: 60px; position: relative; }
  body::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px); background-size: 40px 40px; pointer-events: none; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(255, 255, 255, 0.1); padding-bottom: 24px; z-index: 10; gap: 24px; }
  .brand { font-size: 32px; font-weight: 900; letter-spacing: 0.15em; text-transform: uppercase; color: #38bdf8; }
  .badge { background: rgba(56, 189, 248, 0.15); border: 1px solid ${accent}; color: ${accent}; padding: 8px 18px; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; border-radius: 4px; white-space: nowrap; }
  .main { flex: 1; display: flex; flex-direction: column; z-index: 10; margin: 36px 0; min-height: 0; overflow: hidden; }
  .footer { border-top: 2px solid rgba(255, 255, 255, 0.1); padding-top: 24px; display: flex; justify-content: space-between; align-items: center; gap: 24px; z-index: 10; }
  .cta-text { font-size: 20px; font-weight: 700; color: #cbd5e1; }
  .fan-note { font-size: 13px; color: #64748b; margin-top: 6px; }
  .url-badge { background: #38bdf8; color: #020617; font-size: 18px; font-weight: 800; padding: 10px 22px; border-radius: 6px; letter-spacing: 0.05em; white-space: nowrap; }
  .pager { font-size: 16px; font-weight: 800; color: #64748b; letter-spacing: 0.1em; }
  ${css}
</style>
</head>
<body>
  <div class="header">
    <div class="brand">ANAHEIM HUB</div>
    <div style="display:flex;align-items:center;gap:18px;">${pager ? `<div class="pager">${escapeHtml(pager)}</div>` : ""}<div class="badge">${escapeHtml(badge)}</div></div>
  </div>
  <div class="main">${body}</div>
  <div class="footer">
    <div>
      <div class="cta-text">${escapeHtml(cta)}</div>
      <div class="fan-note">Projeto de fãs, sem vínculo com a Bandai. Gundam Card Game © Bandai / Sotsu · Sunrise.</div>
    </div>
    <div class="url-badge">anaheimhub.com</div>
  </div>
</body>
</html>`;
}

export type AltArt = { code: string; name: string; rarity: string | null; setCode: string | null; imageUrl: string };

/** Slide de arte alternativa: a imagem da carta grande, com raridade e coleção. */
export function altArtSlideHtml(art: AltArt, accent: string, pager?: string): string {
  const imageUrl = safeImageUrl(art.imageUrl);
  const detail = [art.rarity, art.setCode].filter(Boolean).join(" · ");
  return slideDocument({
    badge: "ARTE ALTERNATIVA",
    accent,
    pager,
    css: `
      .art-wrap { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
      .art { height: 900px; aspect-ratio: 63 / 88; border-radius: 22px; overflow: hidden; border: 2px solid rgba(255,255,255,0.18); box-shadow: 0 30px 60px -12px rgba(0,0,0,0.85), 0 0 46px ${accent}40; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; }
      .art img { width: 100%; height: 100%; object-fit: cover; }
      .caption { text-align: center; margin-top: 22px; }
      .caption .name { font-size: 34px; font-weight: 900; text-transform: uppercase; }
      .caption .meta { font-size: 20px; font-weight: 800; color: ${accent}; letter-spacing: 0.12em; margin-top: 6px; font-family: monospace; }`,
    body: `
      <div class="art-wrap"><div class="art">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(art.name)}" />` : `<div style="font-size:28px;font-weight:800;color:${accent};">${escapeHtml(art.code)}</div>`}</div></div>
      <div class="caption"><div class="name">${escapeHtml(art.name)}</div><div class="meta">${escapeHtml(art.code)}${detail ? ` · ${escapeHtml(detail)}` : ""}</div></div>`,
  });
}

// ---------- segunda: torneios do Brasil ----------

const WEEKDAY_PT = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
/** "2026-10-21" → "ter., 21/10" (a data do torneio é só dia: lida em UTC para não voltar um dia) */
export const weekdayDate = (iso: string | null) => (iso ? `${WEEKDAY_PT[new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay()]}, ${ddmm(iso)}` : "—");

const colorDots = (colors: string[]) => colors.map((c) => `<span class="dot" style="background:${accentFor(c)}"></span>`).join("");

const archetypeLine = (a: ReportArchetype | null) =>
  a ? `${colorDots(a.colors)}${escapeHtml(a.name)}` : `<span style="color:#64748b">arquétipo não informado</span>`;

const REPORT_CSS = `
  .kicker { font-size: 18px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #38bdf8; }
  .title { font-size: 76px; font-weight: 900; line-height: 1; text-transform: uppercase; margin-top: 14px; }
  .subtitle { font-size: 30px; font-weight: 700; color: #cbd5e1; margin-top: 18px; }
  .dot { display: inline-block; width: 18px; height: 18px; border-radius: 50%; margin-right: 6px; border: 2px solid rgba(2,6,23,0.8); vertical-align: middle; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 56px; }
  .stat { background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255,255,255,0.1); border-top: 4px solid #38bdf8; padding: 26px 24px; border-radius: 8px; }
  .stat .n { font-size: 72px; font-weight: 900; line-height: 1; }
  .stat .l { font-size: 18px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 10px; }
  .chips { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 40px; }
  .chip { border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.04); padding: 10px 18px; border-radius: 999px; font-size: 22px; font-weight: 700; color: #e2e8f0; }
  .champ { margin-top: 40px; background: linear-gradient(135deg, rgba(250, 204, 21, 0.16), rgba(15, 23, 42, 0.9) 55%); border: 2px solid rgba(250, 204, 21, 0.55); border-radius: 14px; padding: 34px 36px; }
  .champ .label { font-size: 18px; font-weight: 900; letter-spacing: 0.2em; color: #facc15; }
  .champ .player { font-size: 64px; font-weight: 900; line-height: 1.05; margin-top: 10px; overflow-wrap: anywhere; }
  .champ .arch { font-size: 28px; font-weight: 700; color: #e2e8f0; margin-top: 14px; }
  .champ .rec { font-size: 22px; font-weight: 800; color: #facc15; font-family: monospace; margin-top: 8px; }
  .places { margin-top: 26px; display: flex; flex-direction: column; gap: 12px; }
  .place { display: flex; align-items: center; gap: 20px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 18px 22px; }
  .place .pos { font-size: 30px; font-weight: 900; color: #94a3b8; width: 52px; }
  .place .who { flex: 1; min-width: 0; }
  .place .name { font-size: 28px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .place .deck { font-size: 20px; color: #94a3b8; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .place .rec { font-size: 22px; font-weight: 800; color: #cbd5e1; font-family: monospace; }
  .rows { margin-top: 30px; display: flex; flex-direction: column; gap: 14px; }
  .row { display: flex; align-items: center; gap: 18px; font-size: 26px; font-weight: 700; }
  .row .bar { height: 14px; border-radius: 7px; background: #38bdf8; }
  .row .wins { font-family: monospace; color: #facc15; font-weight: 900; width: 70px; text-align: right; }
  .others { margin-top: 30px; font-size: 21px; color: #cbd5e1; line-height: 1.6; }
  .others b { color: #fff; }
  .winners { margin-top: 14px; display: flex; flex-direction: column; }
  .winner { display: flex; justify-content: space-between; gap: 24px; padding: 13px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 25px; }
  .winner .where { color: #cbd5e1; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .winner .when { color: #64748b; font-family: monospace; font-size: 20px; margin-left: 8px; }
  .winner .who { color: #facc15; font-weight: 800; white-space: nowrap; }
  .section { margin-top: 40px; }
  .share { font-family: monospace; color: #94a3b8; font-weight: 800; width: 80px; text-align: right; }
  .ask { margin-top: 40px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.45); border-radius: 12px; padding: 26px 30px; font-size: 28px; font-weight: 800; line-height: 1.3; }
  .ask span { display: block; font-size: 20px; font-weight: 600; color: #94a3b8; margin-top: 8px; }`;

// a lista de campeões da capa cabe com 6 linhas acima do rodapé
const COVER_WINNERS = 6;

export function tournamentCoverHtml(report: WeeklyReport, pager?: string): string {
  const count = report.featured.length + report.others.length;
  return slideDocument({
    badge: "TORNEIOS DO BRASIL",
    pager,
    cta: "Arraste para ver os campeões →",
    css: REPORT_CSS,
    body: `
      <div class="kicker">Resultados da semana</div>
      <div class="title">Torneios<br>do Brasil</div>
      <div class="subtitle">${escapeHtml(ddmm(report.from))} a ${escapeHtml(ddmm(report.to))}</div>
      <div class="stats">
        <div class="stat"><div class="n">${count}</div><div class="l">${count === 1 ? "Torneio" : "Torneios"}</div></div>
        <div class="stat"><div class="n">${report.totalPlayers}</div><div class="l">Jogadores</div></div>
        <div class="stat"><div class="n">${report.cities.length}</div><div class="l">${report.cities.length === 1 ? "Cidade" : "Cidades"}</div></div>
      </div>
      <div class="chips">${report.cities
        .slice(0, 12)
        .map((c) => `<span class="chip">${escapeHtml(c)}</span>`)
        .join("")}</div>
      <div class="kicker" style="margin-top:44px;">Campeões</div>
      <div class="winners">${report.featured
        .slice(0, COVER_WINNERS)
        .map((t) => {
          const champ = t.top.find((p) => p.placement === 1);
          return `<div class="winner"><span class="where">${escapeHtml(t.store ?? t.event)} <span class="when">${escapeHtml(ddmm(t.date))}</span></span><span class="who">${champ ? escapeHtml(champ.player) : "—"}</span></div>`;
        })
        .join("")}${count > COVER_WINNERS ? `<div class="winner"><span class="where">e mais ${count - COVER_WINNERS} no carrossel e no site</span></div>` : ""}</div>`,
  });
}

export function tournamentSlideHtml(t: WeeklyTournament, pager?: string): string {
  const champion = t.top.find((p) => p.placement === 1) ?? null;
  const rest = t.top.filter((p) => p !== champion);
  const where = [t.city ? `${t.city}${t.uf ? `-${t.uf}` : ""}` : null, weekdayDate(t.date), `${t.players} jogadores`].filter(Boolean).join(" · ");
  const championBlock = champion
    ? `<div class="champ"><div class="label">CAMPEÃO</div><div class="player">${escapeHtml(champion.player)}</div><div class="arch">${archetypeLine(champion.archetype)}</div>${
        champion.record ? `<div class="rec">${escapeHtml(champion.record)}</div>` : ""
      }</div>`
    : `<div class="champ"><div class="label">RESULTADO</div><div class="arch">Campeão ainda não informado</div></div>`;
  const places = rest.length
    ? `<div class="places">${rest
        .map(
          (p) =>
            `<div class="place"><div class="pos">${p.placement}º</div><div class="who"><div class="name">${escapeHtml(p.player)}</div><div class="deck">${archetypeLine(p.archetype)}</div></div>${
              p.record ? `<div class="rec">${escapeHtml(p.record)}</div>` : ""
            }</div>`,
        )
        .join("")}</div>`
    : "";
  return slideDocument({
    badge: "TORNEIOS DO BRASIL",
    pager,
    cta: "Listas e resultados completos no site",
    css: REPORT_CSS,
    body: `
      <div class="kicker">${escapeHtml(t.event)}</div>
      <div class="title" style="font-size:60px;overflow-wrap:anywhere;">${escapeHtml(t.store ?? t.event)}</div>
      <div class="subtitle" style="font-size:26px;">${escapeHtml(where)}</div>
      ${championBlock}
      ${places}`,
  });
}

export function tournamentClosingHtml(report: WeeklyReport, pager?: string): string {
  const top = report.champions.slice(0, 6);
  const max = Math.max(1, ...top.map((c) => c.wins));
  const others = report.others.slice(0, 8);
  const rows = top.length
    ? `<div class="rows">${top
        .map(
          (c) =>
            `<div class="row"><div style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${archetypeLine(c.archetype)}</div><div class="bar" style="width:${Math.round(
              (c.wins / max) * 220,
            )}px"></div><div class="wins">${c.wins}x</div></div>`,
        )
        .join("")}</div>`
    : `<div class="subtitle">Arquétipos dos campeões não informados nesta semana.</div>`;
  const mostPlayed = report.mostPlayed.length
    ? `<div class="section"><div class="kicker">Mais jogados</div><div class="rows" style="margin-top:16px;">${report.mostPlayed
        .slice(0, 4)
        .map(
          (p) =>
            `<div class="row" style="font-size:24px;"><div style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${archetypeLine(p.archetype)}</div><div class="share">${Math.round(p.share * 100)}%</div></div>`,
        )
        .join("")}</div></div>`
    : "";
  const alsoPlayed = others.length
    ? `<div class="others"><b>Também rolou:</b> ${others
        .map((t) => {
          const champ = t.top.find((p) => p.placement === 1);
          return `${escapeHtml(t.store ?? t.event)} (${escapeHtml(t.city ?? "")}, ${escapeHtml(ddmm(t.date))})${champ ? ` · ${escapeHtml(champ.player)}` : ""}`;
        })
        .join(" · ")}${report.others.length > others.length ? ` e mais ${report.others.length - others.length}` : ""}</div>`
    : "";
  return slideDocument({
    badge: "TORNEIOS DO BRASIL",
    pager,
    cta: "Resultados completos em anaheimhub.com/torneios",
    css: REPORT_CSS,
    body: `
      <div class="kicker">Resumo da semana</div>
      <div class="title" style="font-size:56px;">Quem venceu</div>
      ${rows}
      ${mostPlayed}
      ${alsoPlayed}
      <div class="ask">Qual deck você leva no próximo torneio?<span>Conta nos comentários e marca quem joga com você.</span></div>`,
  });
}

// ---------- sexta: deck em destaque ----------

const DECK_CSS = `${REPORT_CSS}
  .deck-name { font-size: 64px; font-weight: 900; line-height: 1.05; text-transform: uppercase; margin-top: 16px; overflow-wrap: anywhere; }
  .stats.four { grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 44px; }
  .stats.four .n { font-size: 54px; }
  .stats.four .l { font-size: 15px; }
  .hero { display: flex; gap: 14px; margin-top: 40px; justify-content: center; }
  .hero .tile { border-radius: 12px; border: 2px solid rgba(255,255,255,0.18); box-shadow: 0 18px 36px -10px rgba(0,0,0,0.8); }
  .source { margin-top: 34px; font-size: 24px; color: #cbd5e1; line-height: 1.45; }
  .source b { color: #facc15; }
  .grid { display: grid; gap: 12px; margin-top: 24px; }
  .tile { position: relative; aspect-ratio: 63 / 88; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); }
  .tile img { width: 100%; height: 100%; object-fit: cover; }
  .tile .ph { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 14px; font-weight: 800; color: #94a3b8; padding: 6px; }
  .qty { position: absolute; right: 6px; bottom: 6px; background: #020617; border: 2px solid #38bdf8; color: #fff; font-weight: 900; font-size: 22px; min-width: 40px; height: 40px; border-radius: 20px; display: flex; align-items: center; justify-content: center; padding: 0 8px; }
  .key { display: grid; grid-template-columns: repeat(4, 170px); justify-content: center; column-gap: 40px; row-gap: 18px; margin-top: 26px; }
  .key .k { text-align: center; }
  .key .pct { font-size: 24px; font-weight: 900; color: #facc15; margin-top: 8px; }
  .key .nm { font-size: 16px; color: #cbd5e1; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`;

const cardTile = (c: { code: string; name: string; imageUrl: string | null }, qty?: number, style = "") => {
  const img = safeImageUrl(c.imageUrl);
  return `<div class="tile"${style ? ` style="${style}"` : ""}>${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(c.name)}" />` : `<div class="ph">${escapeHtml(c.code)}</div>`}${qty ? `<div class="qty">${qty}</div>` : ""}</div>`;
};

const placementText = (p: number | null) => (p === 1 ? "Campeão" : p ? `${p}º lugar` : "Lista");

export function deckCoverHtml(deck: FeaturedDeck, pager?: string): string {
  const accent = accentFor(deck.archetype.colors[0]);
  const hero = deck.keyCards.length ? deck.keyCards : deck.cards;
  const where = [deck.entry.store ?? deck.entry.tournament, deck.entry.city ? `${deck.entry.city}${deck.entry.uf ? `-${deck.entry.uf}` : ""}` : null, ddmm(deck.entry.date)].filter(Boolean).join(" · ");
  return slideDocument({
    badge: "DECK EM DESTAQUE",
    accent,
    pager,
    cta: "Arraste para ver a lista completa →",
    css: DECK_CSS,
    body: `
      <div class="kicker">${colorDots(deck.archetype.colors)} Melhor desempenho nos últimos 30 dias</div>
      <div class="deck-name">${escapeHtml(deck.archetype.name)}</div>
      <div class="stats four">
        <div class="stat" style="border-top-color:${accent}"><div class="n">${Math.round(deck.topRate * 100)}%</div><div class="l">No top 25%</div></div>
        <div class="stat" style="border-top-color:${accent}"><div class="n">${deck.wins}</div><div class="l">${deck.wins === 1 ? "Título" : "Títulos"}</div></div>
        <div class="stat" style="border-top-color:${accent}"><div class="n">${deck.lists}</div><div class="l">Listas</div></div>
        <div class="stat" style="border-top-color:${accent}"><div class="n">${deck.tournaments}</div><div class="l">Torneios</div></div>
      </div>
      <div class="hero">${hero
        .slice(0, 4)
        .map((c) => cardTile(c, undefined, "width:228px;flex:0 0 228px;"))
        .join("")}</div>
      <div class="source">Lista de <b>${escapeHtml(deck.entry.player)}</b> · ${escapeHtml(placementText(deck.entry.placement))}${deck.entry.record ? ` (${escapeHtml(deck.entry.record)})` : ""}<br>${escapeHtml(where)}</div>`,
  });
}

export function deckListHtml(deck: FeaturedDeck, pager?: string): string {
  const accent = accentFor(deck.archetype.colors[0]);
  const n = deck.cards.length;
  const cols = n <= 15 ? 5 : n <= 24 ? 6 : n <= 35 ? 7 : 8;
  const total = deck.cards.reduce((sum, c) => sum + c.quantity, 0);
  return slideDocument({
    badge: "DECK EM DESTAQUE",
    accent,
    pager,
    cta: "Copie a lista no site e teste no simulador",
    css: DECK_CSS,
    body: `
      <div class="kicker">Lista completa · ${total} cartas</div>
      <div class="title" style="font-size:44px;overflow-wrap:anywhere;">${escapeHtml(deck.entry.player)} · ${escapeHtml(placementText(deck.entry.placement))}</div>
      <div class="grid" style="grid-template-columns:repeat(${cols}, 1fr);">${deck.cards
        .slice(0, 48)
        .map((c) => cardTile(c, c.quantity))
        .join("")}</div>`,
  });
}

export function deckKeyCardsHtml(deck: FeaturedDeck, pager?: string): string {
  const accent = accentFor(deck.archetype.colors[0]);
  return slideDocument({
    badge: "DECK EM DESTAQUE",
    accent,
    pager,
    cta: `anaheimhub.com/arquetipos/${deck.archetype.slug}`.slice(0, 70),
    css: DECK_CSS,
    body: `
      <div class="kicker">O que não pode faltar</div>
      <div class="title" style="font-size:56px;">Cartas-chave</div>
      <div class="subtitle" style="font-size:24px;">Presentes em pelo menos 80% das ${deck.lists} listas do arquétipo</div>
      ${
        deck.keyCards.length
          ? `<div class="key">${deck.keyCards
              .map((c) => `<div class="k">${cardTile(c, c.copies)}<div class="pct">${Math.round(c.inclusion * 100)}%</div><div class="nm">${escapeHtml(c.name)}</div></div>`)
              .join("")}</div>`
          : `<div class="subtitle">O arquétipo ainda varia muito: nenhuma carta aparece em 80% das listas.</div>`
      }
      <div class="ask">Você jogaria com esse deck?<span>Abra a lista no site, monte no deckbuilder e teste no simulador.</span></div>`,
  });
}

/**
 * Renderiza cada HTML no JPEG correspondente (o único formato de imagem que a API do Instagram aceita), num navegador
 * só. Devolve, para cada slide, se o arquivo foi gerado; um slide que falha não derruba os outros.
 */
export async function renderSlides(htmls: string[], outputPaths: string[]): Promise<boolean[]> {
  if (!htmls.length) return [];
  for (const out of outputPaths) fs.mkdirSync(path.dirname(out), { recursive: true });
  // carregado só aqui: o navegador pesa e só é usado ao gerar um post
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    // SOCIAL_CHROMIUM_PATH: usa um Chromium já instalado no servidor em vez do baixado pelo Playwright
    executablePath: process.env.SOCIAL_CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT } });
    const done: boolean[] = [];
    for (let i = 0; i < htmls.length; i += 1) {
      try {
        await page.setContent(htmls[i], { waitUntil: "load", timeout: 20000 });
        await page.screenshot({ path: outputPaths[i], type: "jpeg", quality: 90 });
        done.push(true);
      } catch (err) {
        console.warn(`[socialSlides] slide ${i + 1} não renderizou:`, err instanceof Error ? err.message : err);
        done.push(false);
      }
    }
    return done;
  } finally {
    await browser.close();
  }
}
