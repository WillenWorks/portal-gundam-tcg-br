/* Slides 1080x1350 (4:5) e Reels 1080x1920 (9:16) dos posts do Instagram: moldura comum (marca, selo, aviso de fã,
 * endereço), desenho de cada tipo de slide e animação de revelação da Carta da Semana em MP4. Todo dado que vem do
 * banco passa por escapeHtml. */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { FeaturedDeck, ReportArchetype, WeeklyReport, WeeklyTournament } from "./socialContent";

export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350;

export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;
export const REEL_DURATION_MS = 6500;
export const STORY_DURATION_MS = 5000;

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

// ---------- artigo publicado no site ----------

export type ArticleSlide = { title: string; kind: string; coverUrl: string };

/**
 * Capa do artigo inteira (sem corte, qualquer proporção) sobre um fundo desfocado dela mesma, com o título embaixo.
 * Sem capa em https, fica o fundo padrão com o título maior.
 */
export function articleCoverHtml(article: ArticleSlide): string {
  const cover = safeImageUrl(article.coverUrl);
  return slideDocument({
    badge: "NOVO ARTIGO",
    cta: "Leia o artigo completo no site (link na bio)",
    css: `
      .art-bg { position: absolute; inset: 0; background-size: cover; background-position: center; filter: blur(38px) brightness(0.35); transform: scale(1.15); z-index: -1; }
      .header, .footer { flex-shrink: 0; }
      /* sem camada própria no .main: o fundo desfocado (z-index -1) fica atrás do cabeçalho, não por cima */
      .main { z-index: auto; }
      .cover-wrap { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; overflow: hidden; }
      .cover { max-width: 100%; max-height: 100%; border-radius: 14px; border: 2px solid rgba(255,255,255,0.16); box-shadow: 0 30px 60px -12px rgba(0,0,0,0.85); object-fit: contain; }
      .kind { font-size: 20px; font-weight: 800; color: #38bdf8; letter-spacing: 0.18em; text-transform: uppercase; margin-top: 30px; }
      .title { font-size: ${cover ? 46 : 72}px; font-weight: 900; line-height: 1.12; margin-top: 10px; display: -webkit-box; -webkit-line-clamp: ${cover ? 3 : 6}; -webkit-box-orient: vertical; overflow: hidden; }`,
    body: `
      ${cover ? `<div class="art-bg" style="background-image:url('${escapeHtml(cover)}')"></div><div class="cover-wrap"><img class="cover" src="${escapeHtml(cover)}" alt="" /></div>` : `<div class="cover-wrap"></div>`}
      <div class="kind">${escapeHtml(article.kind)}</div>
      <div class="title">${escapeHtml(article.title)}</div>`,
  });
}

// ---------- Reel 9:16 (1080x1920): animação de revelação da Carta da Semana ----------

export type ReelCardInput = {
  code: string;
  name: string;
  color: string;
  typeLabel: string;
  rarity?: string | null;
  cost?: number | null;
  level?: number | null;
  ap?: number | null;
  hp?: number | null;
  imageUrl?: string | null;
  altArtCount?: number;
  isSpoiler?: boolean;
  cardUrl?: string | null;
  storyTitle?: string | null;
};

let cachedCardBackDataUri: string | null = null;

/** Carrega a imagem oficial do verso do Gundam Card Game (`src/assets/gundam-card-back.png`) como Data URI para uso imediato no Canvas. */
function readOfficialCardBackDataUri(): string {
  if (cachedCardBackDataUri !== null) return cachedCardBackDataUri;
  try {
    const filePath = path.resolve(process.cwd(), "src/assets/gundam-card-back.png");
    const buf = fs.readFileSync(filePath);
    cachedCardBackDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    cachedCardBackDataUri = "";
  }
  return cachedCardBackDataUri;
}

/**
 * Documento HTML 1080x1920 (9:16) com Canvas + Web Audio que desenha e grava a animação de revelação da Carta da Semana
 * (mostrando primeiro o verso oficial do Gundam Card Game antes do giro 3D) e direciona o espectador para o post completo no feed (@anaheimhub).
 */
export function buildCardRevealReelHtml(card: ReelCardInput): string {
  const accent = accentFor(card.color);
  const safeImg = safeImageUrl(card.imageUrl);
  const codeUpper = String(card.code || "").toUpperCase();
  const payload = JSON.stringify({
    code: codeUpper,
    name: String(card.name || ""),
    typeLabel: String(card.typeLabel || "UNIDADE").toUpperCase(),
    rarity: String(card.rarity || "GCG").toUpperCase(),
    costText: `${card.cost ?? "—"}${card.level !== undefined && card.level !== null ? ` / Nv. ${card.level}` : ""}`,
    apHpText: `${card.ap ?? "—"} AP / ${card.hp ?? "—"} HP`,
    altArtCount: Number(card.altArtCount || 0),
    isSpoiler: Boolean(card.isSpoiler),
    badgeText: card.isSpoiler ? "SPOILER DA SEMANA" : "CARTA DA SEMANA",
    cardUrl: String(card.cardUrl || (codeUpper ? `anaheimhub.com/cards/${codeUpper}` : "anaheimhub.com")),
    accent,
    imageUrl: safeImg,
    cardBackUrl: readOfficialCardBackDataUri(),
  }).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${REEL_WIDTH}px; height: ${REEL_HEIGHT}px; overflow: hidden; background: #020617; }
  canvas { width: ${REEL_WIDTH}px; height: ${REEL_HEIGHT}px; display: block; }
</style>
</head>
<body>
<canvas id="reel-canvas" width="${REEL_WIDTH}" height="${REEL_HEIGHT}"></canvas>
<script>
  const CARD = ${payload};
  const W = ${REEL_WIDTH};
  const H = ${REEL_HEIGHT};
  const DURATION_MS = ${REEL_DURATION_MS};
  const canvas = document.getElementById("reel-canvas");
  const ctx = canvas.getContext("2d");

  let loadedImg = null;
  let loadedBackImg = null;
  const frontReady = new Promise((resolve) => {
    if (!CARD.imageUrl) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 8000);
    img.onload = () => { clearTimeout(timer); loadedImg = img; resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = CARD.imageUrl;
  });
  const backReady = new Promise((resolve) => {
    if (!CARD.cardBackUrl) { resolve(null); return; }
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 3000);
    img.onload = () => { clearTimeout(timer); loadedBackImg = img; resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = CARD.cardBackUrl;
  });
  const imgReady = Promise.all([frontReady, backReady]);

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function wrapLines(c, text, maxWidth, maxLines) {
    const words = String(text || "").split(/\\s+/);
    const lines = [];
    let current = "";
    for (const w of words) {
      const probe = current ? current + " " + w : w;
      if (c.measureText(probe).width > maxWidth && current) {
        lines.push(current);
        current = w;
        if (lines.length >= maxLines) break;
      } else {
        current = probe;
      }
    }
    if (current && lines.length < maxLines) lines.push(current);
    return lines;
  }

  window.__drawReelFrame = function(p) {
    const progress = Math.max(0, Math.min(1, Number(p) || 0));
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // 1. Fundo radial escuro + grade tática animada
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.32, 80, W * 0.5, H * 0.45, H * 0.75);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#020617");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(56, 189, 248, 0.06)";
    ctx.lineWidth = 1;
    const gridOffset = (progress * 120) % 48;
    for (let x = 0; x <= W; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = gridOffset; y <= H; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // 2. Cabeçalho ANAHEIM HUB
    ctx.fillStyle = "#38bdf8";
    ctx.font = "900 36px 'Segoe UI', Roboto, Arial, sans-serif";
    ctx.fillText("ANAHEIM HUB", 64, 108);

    roundRect(ctx, W - 384, 66, 320, 54, 8);
    ctx.fillStyle = "rgba(56, 189, 248, 0.14)";
    ctx.fill();
    ctx.strokeStyle = CARD.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = CARD.accent;
    ctx.font = "800 22px 'Segoe UI', Roboto, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(CARD.badgeText, W - 224, 101);
    ctx.textAlign = "left";

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.moveTo(64, 146); ctx.lineTo(W - 64, 146); ctx.stroke();

    // 3. Título de chamada no topo
    ctx.textAlign = "center";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "800 24px monospace";
    ctx.fillText(
      progress < 0.26
        ? (CARD.isSpoiler ? "[ REVELANDO O SPOILER DA SEMANA... ]" : "[ REVELANDO A CARTA DA SEMANA... ]")
        : CARD.code + " • " + CARD.typeLabel + " • " + CARD.rarity,
      W / 2,
      208,
    );

    // 4. Moldura da Carta com Verso Oficial + Giro 3D
    const cardW = 580;
    const cardH = 810;
    const cardY = 250;
    const flipAngle = progress < 0.22 ? 0 : Math.min(1, (progress - 0.22) / 0.16);
    const scaleX = progress < 0.22 ? 1 : Math.abs(Math.cos(flipAngle * Math.PI));
    const isRevealed = progress >= 0.30;
    const floatY = progress > 0.38 ? Math.sin((progress - 0.38) * Math.PI * 4) * 8 : 0;

    ctx.save();
    ctx.translate(W / 2, cardY + cardH / 2 + floatY);
    ctx.scale(Math.max(0.06, scaleX), 1);

    // Brilho externo da carta
    ctx.shadowColor = CARD.accent;
    ctx.shadowBlur = isRevealed ? 48 : 28;
    roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 26);
    ctx.fillStyle = "#0b1329";
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.save();
    roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 26);
    ctx.clip();

    if (!isRevealed) {
      // Verso oficial do Gundam Card Game antes do giro 3D + feixe de scan energético
      if (loadedBackImg) {
        ctx.drawImage(loadedBackImg, -cardW / 2, -cardH / 2, cardW, cardH);
      } else {
        const backGrad = ctx.createLinearGradient(-cardW / 2, -cardH / 2, cardW / 2, cardH / 2);
        backGrad.addColorStop(0, "#0f172a");
        backGrad.addColorStop(0.5, "#1e293b");
        backGrad.addColorStop(1, "#020617");
        ctx.fillStyle = backGrad;
        ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
      }

      const scanY = -cardH / 2 + ((progress / 0.28) % 1) * cardH;
      const scanGrad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
      scanGrad.addColorStop(0, "rgba(56, 189, 248, 0)");
      scanGrad.addColorStop(0.5, CARD.accent);
      scanGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = scanGrad;
      ctx.fillRect(-cardW / 2, scanY - 40, cardW, 80);
      ctx.restore();
    } else if (loadedImg) {
      ctx.drawImage(loadedImg, -cardW / 2, -cardH / 2, cardW, cardH);
    } else {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
      ctx.fillStyle = CARD.accent;
      ctx.font = "900 54px monospace";
      ctx.fillText(CARD.code, 0, -20);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "800 34px 'Segoe UI', Roboto, Arial, sans-serif";
      ctx.fillText(CARD.name.slice(0, 22), 0, 44);
    }
    ctx.restore();

    roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 26);
    ctx.strokeStyle = isRevealed ? CARD.accent : "rgba(255,255,255,0.28)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // Flash de energia no instante da virada
    if (progress >= 0.26 && progress <= 0.36) {
      const flashAlpha = (1 - Math.abs(progress - 0.31) / 0.05) * 0.45;
      ctx.fillStyle = "rgba(255, 255, 255, " + Math.max(0, flashAlpha).toFixed(3) + ")";
      ctx.fillRect(0, 0, W, H);
    }

    // 5. Nome da carta + Atributos (aparecem após a revelação)
    if (progress >= 0.32) {
      const infoAlpha = Math.min(1, (progress - 0.32) / 0.12);
      ctx.save();
      ctx.globalAlpha = infoAlpha;
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 52px 'Segoe UI', Roboto, Arial, sans-serif";
      const nameLines = wrapLines(ctx, CARD.name.toUpperCase(), W - 140, 2);
      nameLines.forEach((line, idx) => {
        ctx.fillText(line, W / 2, 1130 + idx * 58);
      });

      const statsY = nameLines.length > 1 ? 1265 : 1215;
      const boxW = 446;
      const boxH = 112;
      // Caixa Custo/Nível
      roundRect(ctx, 64, statsY, boxW, boxH, 12);
      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.fillStyle = "#94a3b8";
      ctx.font = "700 20px 'Segoe UI', Roboto, Arial, sans-serif";
      ctx.fillText("CUSTO / NÍVEL", 92, statsY + 40);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "900 36px 'Segoe UI', Roboto, Arial, sans-serif";
      ctx.fillText(CARD.costText, 92, statsY + 88);

      // Caixa AP / HP
      roundRect(ctx, W - 64 - boxW, statsY, boxW, boxH, 12);
      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "700 20px 'Segoe UI', Roboto, Arial, sans-serif";
      ctx.fillText("PODER DE COMBATE", W - 64 - boxW + 28, statsY + 40);
      ctx.fillStyle = CARD.accent;
      ctx.font = "900 36px 'Segoe UI', Roboto, Arial, sans-serif";
      ctx.fillText(CARD.apHpText, W - 64 - boxW + 28, statsY + 88);
      ctx.restore();
    }

    // 6. Chamada para o Post do Feed (4.0s até 6.5s)
    if (progress >= 0.52) {
      const ctaAlpha = Math.min(1, (progress - 0.52) / 0.14);
      const slideUp = (1 - ctaAlpha) * 40;
      const ctaY = 1430 + slideUp;

      ctx.save();
      ctx.globalAlpha = ctaAlpha;
      roundRect(ctx, 64, ctaY, W - 128, 250, 18);
      ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
      ctx.fill();
      ctx.strokeStyle = CARD.accent;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "#facc15";
      ctx.font = "900 28px 'Segoe UI', Roboto, Arial, sans-serif";
      ctx.fillText("📖 ANÁLISE COMPLETA NO POST DO FEED!", W / 2, ctaY + 60);

      ctx.fillStyle = "#f8fafc";
      ctx.font = "700 28px 'Segoe UI', Roboto, Arial, sans-serif";
      ctx.fillText("Veja o efeito em português, sinergias", W / 2, ctaY + 116);
      ctx.fillText(
        CARD.altArtCount > 0
          ? "e as " + CARD.altArtCount + " arte(s) alternativa(s) no perfil 👉 @anaheimhub"
          : "e onde jogar essa carta no perfil 👉 @anaheimhub",
        W / 2,
        ctaY + 158,
      );

      ctx.fillStyle = CARD.accent;
      ctx.font = "800 24px monospace";
      ctx.fillText(CARD.cardUrl, W / 2, ctaY + 214);
      ctx.restore();
    }

    // 7. Rodapé fixo
    ctx.textAlign = "left";
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath(); ctx.moveTo(64, H - 150); ctx.lineTo(W - 64, H - 150); ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 18px 'Segoe UI', Roboto, Arial, sans-serif";
    ctx.fillText("Projeto de fãs, sem vínculo com a Bandai. Gundam Card Game © Bandai / Sotsu · Sunrise.", 64, H - 96);

    ctx.restore();
  };

  window.__recordReelVideo = async function() {
    await imgReady;
    const mimes = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=h264",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    const mimeType = typeof MediaRecorder !== "undefined" ? mimes.find((m) => MediaRecorder.isTypeSupported(m)) : null;
    if (!mimeType) throw new Error("MediaRecorder não suportado neste navegador.");

    const stream = canvas.captureStream(30);
    let audioCtx = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        audioCtx = new AC();
        const dest = audioCtx.createMediaStreamDestination();
        const now = audioCtx.currentTime;
        // Acorde sci-fi sutil de revelação (garante trilha de áudio AAC válida para o Reel)
        [220, 277.18, 329.63, 440].forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = i % 2 === 0 ? "sine" : "triangle";
          osc.frequency.setValueAtTime(freq * 0.5, now);
          osc.frequency.exponentialRampToValueAtTime(freq, now + 1.8);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.025, now + 1.5);
          gain.gain.exponentialRampToValueAtTime(0.001, now + DURATION_MS / 1000);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(now);
          osc.stop(now + DURATION_MS / 1000);
        });
        const track = dest.stream.getAudioTracks()[0];
        if (track) stream.addTrack(track);
      }
    } catch {}

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_500_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    recorder.start(200);

    const totalFrames = Math.round((DURATION_MS / 1000) * 30);
    for (let f = 0; f <= totalFrames; f += 1) {
      window.__drawReelFrame(f / totalFrames);
      await new Promise((r) => setTimeout(r, 33));
    }

    recorder.stop();
    await new Promise((r) => { recorder.onstop = r; });
    if (audioCtx) audioCtx.close().catch(() => {});

    const blob = new Blob(chunks, { type: mimeType });
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    }
    return { base64: btoa(binary), mimeType };
  };

  imgReady.then(() => window.__drawReelFrame(0.85));
</script>
</body>
</html>`;
}

/**
 * Documento HTML 1080x1920 (9:16) mais enxuto para o Story do Instagram:
 * apenas o giro 3D da carta (verso oficial em HD → frente) e no centro-baixo o destaque "CARTA DA SEMANA"
 * (ou "SPOILER DA SEMANA") com o link/chamada para ver a postagem completa, sem caixas de texto/atributos abaixo.
 */
export function buildCardStoryHtml(card: ReelCardInput): string {
  const accent = accentFor(card.color);
  const safeImg = safeImageUrl(card.imageUrl);
  const codeUpper = String(card.code || "").toUpperCase();
  const defaultTitle = card.isSpoiler ? "SPOILER DA SEMANA" : "CARTA DA SEMANA";
  const payload = JSON.stringify({
    code: codeUpper,
    name: String(card.name || ""),
    storyTitle: String(card.storyTitle || defaultTitle).toUpperCase(),
    cardUrl: String(card.cardUrl || (codeUpper ? `anaheimhub.com/cards/${codeUpper}` : "anaheimhub.com")),
    accent,
    imageUrl: safeImg,
    cardBackUrl: readOfficialCardBackDataUri(),
  }).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${REEL_WIDTH}px; height: ${REEL_HEIGHT}px; overflow: hidden; background: #020617; }
  canvas { width: ${REEL_WIDTH}px; height: ${REEL_HEIGHT}px; display: block; }
</style>
</head>
<body>
<canvas id="reel-canvas" width="${REEL_WIDTH}" height="${REEL_HEIGHT}"></canvas>
<script>
  const CARD = ${payload};
  const W = ${REEL_WIDTH};
  const H = ${REEL_HEIGHT};
  const DURATION_MS = ${STORY_DURATION_MS};
  const canvas = document.getElementById("reel-canvas");
  const ctx = canvas.getContext("2d");

  let loadedImg = null;
  let loadedBackImg = null;
  const frontReady = new Promise((resolve) => {
    if (!CARD.imageUrl) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 8000);
    img.onload = () => { clearTimeout(timer); loadedImg = img; resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = CARD.imageUrl;
  });
  const backReady = new Promise((resolve) => {
    if (!CARD.cardBackUrl) { resolve(null); return; }
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 3000);
    img.onload = () => { clearTimeout(timer); loadedBackImg = img; resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = CARD.cardBackUrl;
  });
  const imgReady = Promise.all([frontReady, backReady]);

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  window.__drawReelFrame = function(p) {
    const progress = Math.max(0, Math.min(1, Number(p) || 0));
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // 1. Fundo radial escuro + grade tática animada
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.38, 90, W * 0.5, H * 0.5, H * 0.8);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#020617");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(56, 189, 248, 0.06)";
    ctx.lineWidth = 1;
    const gridOffset = (progress * 100) % 48;
    for (let x = 0; x <= W; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = gridOffset; y <= H; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // 2. Marca discreta no topo (abaixo da barra de Story do Instagram)
    ctx.textAlign = "center";
    ctx.fillStyle = "#38bdf8";
    ctx.font = "900 32px 'Segoe UI', Roboto, Arial, sans-serif";
    ctx.fillText("ANAHEIM HUB", W / 2, 175);

    // 3. Carta grande sendo virada no centro
    const cardW = 650;
    const cardH = 908;
    const cardY = 230;
    const flipAngle = progress < 0.20 ? 0 : Math.min(1, (progress - 0.20) / 0.18);
    const scaleX = progress < 0.20 ? 1 : Math.abs(Math.cos(flipAngle * Math.PI));
    const isRevealed = progress >= 0.29;
    const floatY = progress > 0.38 ? Math.sin((progress - 0.38) * Math.PI * 3.5) * 10 : 0;

    ctx.save();
    ctx.translate(W / 2, cardY + cardH / 2 + floatY);
    ctx.scale(Math.max(0.06, scaleX), 1);

    ctx.shadowColor = CARD.accent;
    ctx.shadowBlur = isRevealed ? 56 : 32;
    roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 28);
    ctx.fillStyle = "#0b1329";
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.save();
    roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 28);
    ctx.clip();

    if (!isRevealed) {
      if (loadedBackImg) {
        ctx.drawImage(loadedBackImg, -cardW / 2, -cardH / 2, cardW, cardH);
      } else {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
      }
      const scanY = -cardH / 2 + ((progress / 0.28) % 1) * cardH;
      const scanGrad = ctx.createLinearGradient(0, scanY - 45, 0, scanY + 45);
      scanGrad.addColorStop(0, "rgba(56, 189, 248, 0)");
      scanGrad.addColorStop(0.5, CARD.accent);
      scanGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = scanGrad;
      ctx.fillRect(-cardW / 2, scanY - 45, cardW, 90);
      ctx.restore();
    } else if (loadedImg) {
      ctx.drawImage(loadedImg, -cardW / 2, -cardH / 2, cardW, cardH);
    } else {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
      ctx.fillStyle = CARD.accent;
      ctx.font = "900 58px monospace";
      ctx.fillText(CARD.code, 0, -20);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "800 36px 'Segoe UI', Roboto, Arial, sans-serif";
      ctx.fillText(CARD.name.slice(0, 22), 0, 44);
    }
    ctx.restore();

    roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 28);
    ctx.strokeStyle = isRevealed ? CARD.accent : "rgba(255,255,255,0.28)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // Flash de energia no giro
    if (progress >= 0.24 && progress <= 0.34) {
      const flashAlpha = (1 - Math.abs(progress - 0.29) / 0.05) * 0.45;
      ctx.fillStyle = "rgba(255, 255, 255, " + Math.max(0, flashAlpha).toFixed(3) + ")";
      ctx.fillRect(0, 0, W, H);
    }

    // 4. Centro-baixo: "CARTA DA SEMANA" + link/chamada para ver a postagem
    const bannerAlpha = progress < 0.25 ? 0.85 : Math.min(1, 0.85 + (progress - 0.25) * 0.5);
    ctx.save();
    ctx.globalAlpha = bannerAlpha;
    ctx.textAlign = "center";

    // Selo principal grande "CARTA DA SEMANA"
    const bannerY = 1230;
    roundRect(ctx, 84, bannerY, W - 168, 128, 18);
    ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
    ctx.fill();
    ctx.strokeStyle = CARD.accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 56px 'Segoe UI', Roboto, Arial, sans-serif";
    ctx.fillText(CARD.storyTitle, W / 2, bannerY + 84);

    if (isRevealed) {
      const revealTextAlpha = Math.min(1, (progress - 0.29) / 0.14);
      ctx.globalAlpha = revealTextAlpha;
      ctx.fillStyle = CARD.accent;
      ctx.font = "800 32px 'Segoe UI', Roboto, Arial, sans-serif";
      ctx.fillText(CARD.name.toUpperCase() + " (" + CARD.code + ")", W / 2, bannerY + 186);

      // Chamada + link abaixo para ver a postagem
      const linkBoxY = bannerY + 230;
      roundRect(ctx, 110, linkBoxY, W - 220, 178, 16);
      ctx.fillStyle = "rgba(2, 6, 23, 0.92)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#facc15";
      ctx.font = "800 28px 'Segoe UI', Roboto, Arial, sans-serif";
      ctx.fillText("CONFIRA A POSTAGEM COMPLETA NO PERFIL @ANAHEIMHUB", W / 2, linkBoxY + 64);

      roundRect(ctx, 190, linkBoxY + 92, W - 380, 60, 30);
      ctx.fillStyle = CARD.accent;
      ctx.fill();
      ctx.fillStyle = "#020617";
      ctx.font = "900 26px monospace";
      ctx.fillText("🔗 " + CARD.cardUrl, W / 2, linkBoxY + 131);
    }
    ctx.restore();

    ctx.restore();
  };

  window.__recordReelVideo = async function() {
    await imgReady;
    const mimes = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=h264",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    const mimeType = typeof MediaRecorder !== "undefined" ? mimes.find((m) => MediaRecorder.isTypeSupported(m)) : null;
    if (!mimeType) throw new Error("MediaRecorder não suportado neste navegador.");

    const stream = canvas.captureStream(30);
    let audioCtx = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        audioCtx = new AC();
        const dest = audioCtx.createMediaStreamDestination();
        const now = audioCtx.currentTime;
        [220, 277.18, 329.63, 440].forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = i % 2 === 0 ? "sine" : "triangle";
          osc.frequency.setValueAtTime(freq * 0.5, now);
          osc.frequency.exponentialRampToValueAtTime(freq, now + 1.4);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.025, now + 1.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + DURATION_MS / 1000);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(now);
          osc.stop(now + DURATION_MS / 1000);
        });
        const track = dest.stream.getAudioTracks()[0];
        if (track) stream.addTrack(track);
      }
    } catch {}

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_500_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    recorder.start(200);

    const totalFrames = Math.round((DURATION_MS / 1000) * 30);
    for (let f = 0; f <= totalFrames; f += 1) {
      window.__drawReelFrame(f / totalFrames);
      await new Promise((r) => setTimeout(r, 33));
    }

    recorder.stop();
    await new Promise((r) => { recorder.onstop = r; });
    if (audioCtx) audioCtx.close().catch(() => {});

    const blob = new Blob(chunks, { type: mimeType });
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    }
    return { base64: btoa(binary), mimeType };
  };

  imgReady.then(() => window.__drawReelFrame(0.85));
</script>
</body>
</html>`;
}

export type ArticleStoryInput = {
  title: string;
  kind: string;
  coverUrl?: string | null;
  articleUrl: string;
};

/**
 * Constrói o HTML Canvas 9:16 (1080x1920) para o Story de notificação de um novo artigo publicado no portal.
 * Exibe animação visual com a capa do artigo, badge temático, título em destaque e sticker com o link do portal.
 */
export function buildArticleStoryHtml(article: ArticleStoryInput): string {
  const accent = "#38bdf8";
  const safeImg = safeImageUrl(article.coverUrl);
  const payload = JSON.stringify({
    title: String(article.title || ""),
    kind: String(article.kind || "ARTIGO").toUpperCase(),
    articleUrl: String(article.articleUrl || "anaheimhub.com"),
    accent,
    imageUrl: safeImg,
  }).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${REEL_WIDTH}px; height: ${REEL_HEIGHT}px; overflow: hidden; background: #020617; }
  canvas { width: ${REEL_WIDTH}px; height: ${REEL_HEIGHT}px; display: block; }
</style>
</head>
<body>
<canvas id="reel-canvas" width="${REEL_WIDTH}" height="${REEL_HEIGHT}"></canvas>
<script>
  const ARTICLE = ${payload};
  const W = ${REEL_WIDTH};
  const H = ${REEL_HEIGHT};
  const DURATION_MS = ${STORY_DURATION_MS};
  const canvas = document.getElementById("reel-canvas");
  const ctx = canvas.getContext("2d");

  let loadedImg = null;
  const imgReady = new Promise((resolve) => {
    if (!ARTICLE.imageUrl) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 8000);
    img.onload = () => { clearTimeout(timer); loadedImg = img; resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = ARTICLE.imageUrl;
  });

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  window.__drawReelFrame = function(p) {
    const progress = Math.max(0, Math.min(1, Number(p) || 0));
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // 1. Fundo cockpit espacial escuro
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.4, 100, W * 0.5, H * 0.5, H * 0.85);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#020617");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(56, 189, 248, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    const gridY = (progress * 60) % 48;
    for (let y = gridY; y <= H; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // 2. Marca superior
    ctx.textAlign = "center";
    ctx.fillStyle = "#38bdf8";
    ctx.font = "900 32px 'Segoe UI', Roboto, Arial, sans-serif";
    ctx.fillText("ANAHEIM HUB", W / 2, 175);

    // 3. Selo badge do tipo
    const badgeText = ${JSON.stringify("NOVO " + String(article.kind || "ARTIGO").toUpperCase() + " NO SITE")};
    ctx.font = "800 24px 'Segoe UI', Roboto, Arial, sans-serif";
    const badgeW = ctx.measureText(badgeText).width + 48;
    ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
    roundRect(ctx, (W - badgeW) / 2, 220, badgeW, 44, 22);
    ctx.fill();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    roundRect(ctx, (W - badgeW) / 2, 220, badgeW, 44, 22);
    ctx.stroke();
    ctx.fillStyle = "#e0f2fe";
    ctx.fillText(badgeText, W / 2, 250);

    // 4. Imagem de capa do artigo com moldura tech e leve zoom
    const boxW = 860;
    const boxH = 500;
    const boxX = (W - boxW) / 2;
    const boxY = 320;
    const revealZoom = 1 + (1 - progress) * 0.03;

    ctx.save();
    roundRect(ctx, boxX, boxY, boxW, boxH, 20);
    ctx.clip();
    if (loadedImg) {
      ctx.drawImage(loadedImg, boxX - (boxW * (revealZoom - 1)) / 2, boxY - (boxH * (revealZoom - 1)) / 2, boxW * revealZoom, boxH * revealZoom);
    } else {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.fillStyle = "#64748b";
      ctx.font = "700 28px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(ARTICLE.kind, W / 2, boxY + boxH / 2);
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 3;
    roundRect(ctx, boxX, boxY, boxW, boxH, 20);
    ctx.stroke();

    // 5. Título do Artigo em destaque
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 50px 'Segoe UI', Roboto, Arial, sans-serif";
    ctx.textAlign = "center";
    const words = ARTICLE.title.split(" ");
    let line = "";
    let lineY = boxY + boxH + 85;
    for (let i = 0; i < words.length; i++) {
      const testLine = line + (line ? " " : "") + words[i];
      if (ctx.measureText(testLine).width > 860 && i > 0) {
        ctx.fillText(line, W / 2, lineY);
        line = words[i];
        lineY += 64;
        if (lineY > boxY + boxH + 280) {
          line += "...";
          break;
        }
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, W / 2, lineY);

    // 6. Botão / Sticker CTA inferior
    const ctaY = H - 290;
    const ctaW = 840;
    const ctaH = 120;
    const ctaX = (W - ctaW) / 2;
    const pulse = Math.sin(progress * Math.PI * 4) * 0.03;
    ctx.save();
    ctx.translate(W / 2, ctaY + ctaH / 2);
    ctx.scale(1 + pulse, 1 + pulse);
    ctx.fillStyle = "#0284c7";
    roundRect(ctx, -ctaW / 2, -ctaH / 2, ctaW, ctaH, 22);
    ctx.fill();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;
    roundRect(ctx, -ctaW / 2, -ctaH / 2, ctaW, ctaH, 22);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 32px 'Segoe UI', Roboto, Arial, sans-serif";
    ctx.fillText("🔗 LER ARTIGO NO SITE", 0, -6);
    ctx.fillStyle = "#bae6fd";
    ctx.font = "700 22px 'Consolas', monospace";
    ctx.fillText(ARTICLE.articleUrl, 0, 32);
    ctx.restore();

    ctx.restore();
  };

  window.__recordReelVideo = async function() {
    await imgReady;
    const mimes = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=h264",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    const mimeType = typeof MediaRecorder !== "undefined" ? mimes.find((m) => MediaRecorder.isTypeSupported(m)) : null;
    if (!mimeType) throw new Error("MediaRecorder não suportado.");

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_500_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    recorder.start(200);

    const totalFrames = Math.round((DURATION_MS / 1000) * 30);
    for (let f = 0; f <= totalFrames; f += 1) {
      window.__drawReelFrame(f / totalFrames);
      await new Promise((r) => setTimeout(r, 33));
    }

    recorder.stop();
    await new Promise((r) => { recorder.onstop = r; });

    const blob = new Blob(chunks, { type: mimeType });
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    }
    return { base64: btoa(binary), mimeType };
  };

  imgReady.then(() => window.__drawReelFrame(0.85));
</script>
</body>
</html>`;
}

/** Caminho do ffmpeg se instalado no servidor (otimiza MP4 com faststart e converte WebM no Linux). */
export function resolveFfmpegExecutable(): string | null {
  const custom = (process.env.SOCIAL_FFMPEG_PATH || "").trim();
  if (custom && fs.existsSync(custom)) return custom;
  const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore", timeout: 4000 });
  return probe.status === 0 ? "ffmpeg" : null;
}

async function renderHtmlVideo(
  htmlContent: string,
  outputMp4Path: string,
  outputCoverJpgPath?: string,
): Promise<{ videoOk: boolean; coverOk: boolean }> {
  fs.mkdirSync(path.dirname(outputMp4Path), { recursive: true });
  if (outputCoverJpgPath) fs.mkdirSync(path.dirname(outputCoverJpgPath), { recursive: true });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.SOCIAL_CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
  });

  let videoOk = false;
  let coverOk = false;
  try {
    const page = await browser.newPage({ viewport: { width: REEL_WIDTH, height: REEL_HEIGHT } });
    await page.setContent(htmlContent, { waitUntil: "load", timeout: 25000 });

    if (outputCoverJpgPath) {
      try {
        await page.evaluate(() => (globalThis as unknown as { __drawReelFrame: (p: number) => void }).__drawReelFrame(0.85));
        await page.screenshot({ path: outputCoverJpgPath, type: "jpeg", quality: 90 });
        coverOk = fs.existsSync(outputCoverJpgPath);
      } catch (err) {
        console.warn("[socialSlides] capa do vídeo não renderizou:", err instanceof Error ? err.message : err);
      }
    }

    const recorded = (await page.evaluate(() =>
      (globalThis as unknown as { __recordReelVideo: () => Promise<{ base64: string; mimeType: string }> }).__recordReelVideo(),
    )) as { base64: string; mimeType: string };
    const rawBuffer = Buffer.from(recorded.base64, "base64");
    const ffmpeg = resolveFfmpegExecutable();

    if (ffmpeg) {
      const tmpInput = `${outputMp4Path}.raw`;
      fs.writeFileSync(tmpInput, rawBuffer);
      try {
        const res = spawnSync(
          ffmpeg,
          [
            "-y",
            "-i",
            tmpInput,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-pix_fmt",
            "yuv420p",
            "-profile:v",
            "high",
            "-level:v",
            "4.0",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            outputMp4Path,
          ],
          { stdio: "ignore", timeout: 45000 },
        );
        if (res.status === 0 && fs.existsSync(outputMp4Path)) {
          videoOk = true;
        }
      } finally {
        fs.rmSync(tmpInput, { force: true });
      }
    }

    if (!videoOk && recorded.mimeType.includes("mp4") && rawBuffer.length > 0) {
      fs.writeFileSync(outputMp4Path, rawBuffer);
      videoOk = fs.existsSync(outputMp4Path);
    }
  } catch (err) {
    console.warn("[socialSlides] Vídeo não renderizou:", err instanceof Error ? err.message : err);
  } finally {
    await browser.close();
  }
  return { videoOk, coverOk };
}

/**
 * Renderiza a animação de revelação da Carta da Semana em MP4 (1080x1920) e opcionalmente salva um frame JPEG de capa.
 */
export async function renderCardRevealReel(
  card: ReelCardInput,
  outputMp4Path: string,
  outputCoverJpgPath?: string,
): Promise<{ videoOk: boolean; coverOk: boolean }> {
  return renderHtmlVideo(buildCardRevealReelHtml(card), outputMp4Path, outputCoverJpgPath);
}

/**
 * Renderiza a animação curta (5s) do Story da Carta/Spoiler da Semana em MP4 (1080x1920).
 */
export async function renderCardStory(
  card: ReelCardInput,
  outputMp4Path: string,
): Promise<{ videoOk: boolean }> {
  const { videoOk } = await renderHtmlVideo(buildCardStoryHtml(card), outputMp4Path);
  return { videoOk };
}

/**
 * Renderiza a animação curta (5s) do Story de divulgação de Artigo em MP4 (1080x1920).
 */
export async function renderArticleStory(
  article: ArticleStoryInput,
  outputMp4Path: string,
): Promise<{ videoOk: boolean }> {
  const { videoOk } = await renderHtmlVideo(buildArticleStoryHtml(article), outputMp4Path);
  return { videoOk };
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
