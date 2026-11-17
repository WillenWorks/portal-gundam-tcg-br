/* Conteúdo de cada página já no HTML entregue pelo servidor, dentro do <main> do index.html.
 *
 * Por quê: o index.html do build traz um texto genérico de apresentação do site. Ele ia igual para TODAS
 * as páginas — só título e descrição mudavam (server/htmlMeta.ts). Quem lê o HTML sem rodar JavaScript
 * (o robô do AdSense, a primeira leitura do Google) via centenas de endereços com o mesmo texto e sem o
 * conteúdo prometido no título: a página de regras sem regras, a de coleção sem cartas, a de torneio sem
 * classificação. O AdSense recusou o site por "conteúdo de baixo valor".
 *
 * Aqui só a montagem do HTML (funções puras, testadas em htmlContent.test.ts); as consultas ficam em
 * server/routes/htmlPages.ts. O React monta a página interativa por cima (createRoot troca o #root). */

import type { AboutSection } from "../src/lib/aboutContent.ts";
import type { SupportChannel } from "../src/lib/supportContent.ts";

export const esc = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const href = (path: string) => esc(encodeURI(path));
const link = (path: string, text: unknown) => `<a href="${href(path)}" style="color:#38bdf8">${esc(text)}</a>`;

/** Texto de várias linhas → parágrafos escapados. */
export function paragraphs(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${esc(block).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

const inlineMd = (text: string) =>
  esc(text)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // imagem: o React mostra
    .replace(/\[\[([^\]]+)\]\]/g, "$1") // [[GD01-001]]: cartão de carta no React; aqui fica o texto
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) =>
      /^(https?:\/\/|\/)/.test(url) ? `<a href="${url}" style="color:#38bdf8">${label}</a>` : label)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

/** Markdown dos artigos (contentMd) → HTML simples: títulos, listas, citações e parágrafos. Tudo escapado
 *  antes; HTML cru do texto nunca passa. */
export function markdownToHtml(md: string | null | undefined): string {
  if (!md) return "";
  const out: string[] = [];
  let list: string[] | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${inlineMd(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<ul>${list.map((item) => `<li>${inlineMd(item)}</li>`).join("")}</ul>`);
    list = null;
  };
  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line || /^```/.test(line) || /^<[^>]+>$/.test(line)) {
      flushPara();
      flushList();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      const level = Math.min(Math.max(heading[1].length, 2), 4); // h1 é o título da página
      out.push(`<h${level}>${inlineMd(heading[2])}</h${level}>`);
      continue;
    }
    const item = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      flushPara();
      (list ??= []).push(item[1]);
      continue;
    }
    flushList();
    para.push(line.replace(/^>\s?/, ""));
  }
  flushPara();
  flushList();
  return out.join("\n");
}

const table = (head: string[], rows: string[][]) =>
  `<table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr>${head
    .map((h) => `<th style="text-align:left;border-bottom:1px solid rgba(255,255,255,.15);padding:4px 6px">${esc(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td style="border-bottom:1px solid rgba(255,255,255,.06);padding:4px 6px">${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;

const dl = (pairs: Array<[string, unknown]>) => {
  const items = pairs.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!items.length) return "";
  return `<dl style="display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;font-size:14px">${items
    .map(([k, v]) => `<dt style="color:#94a3b8">${esc(k)}</dt><dd style="margin:0">${esc(v)}</dd>`)
    .join("")}</dl>`;
};

/** Moldura comum: trilha, título, conteúdo. */
export function pageShell(opts: { title: string; lead?: string; crumbs?: Array<{ name: string; path: string }>; sections: string[] }): string {
  const crumbs = opts.crumbs?.length
    ? `<nav aria-label="Trilha" style="font-size:12px;color:#94a3b8;margin-bottom:12px">${[{ name: "Início", path: "/" }, ...opts.crumbs]
        .map((c) => link(c.path, c.name))
        .join(" › ")}</nav>`
    : "";
  return [
    `<article style="background:rgba(15,23,42,.85);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:28px;line-height:1.65">`,
    crumbs,
    `<h1 style="font-size:28px;margin:0 0 12px 0;color:#fff">${esc(opts.title)}</h1>`,
    opts.lead ? `<p style="color:#cbd5e1;font-size:15px">${esc(opts.lead)}</p>` : "",
    ...opts.sections.filter(Boolean),
    `</article>`,
  ].filter(Boolean).join("\n");
}

const section = (title: string, body: string) => (body ? `<section style="margin-top:24px"><h2 style="font-size:19px;color:#38bdf8">${esc(title)}</h2>\n${body}\n</section>` : "");

// ---------------------------------------------------------------------------------------------------------
// Páginas de detalhe

export type CardContent = {
  name: string;
  nameEn?: string | null;
  code: string;
  typeLabel: string;
  colorLabel?: string;
  level?: number | null;
  cost?: number | null;
  ap?: number | null;
  hp?: number | null;
  traits?: string[];
  series?: string | null;
  zone?: string | null;
  link?: string | null;
  effectPt?: string | null;
  effectEn?: string | null;
  prints: Array<{ code: string; label?: string | null; rarity?: string | null; set?: { code: string; name: string } | null }>;
  rulings: Array<{ title: string; question?: string | null; answer?: string | null }>;
  related?: Array<{ id: string; code: string; name: string }>;
  /** carta revelada em spoiler, ainda sem lista oficial */
  preview?: boolean;
};

export function cardBody(c: CardContent): string {
  const stats = dl([
    ["Código", c.code],
    ["Tipo", c.typeLabel],
    ["Cor", c.colorLabel],
    ["Nível", c.level],
    ["Custo", c.cost],
    ["AP", c.ap],
    ["HP", c.hp],
    ["Traços", c.traits?.join(", ")],
    ["Série", c.series],
    ["Zona", c.zone],
    ["Link", c.link],
    ["Nome original", c.nameEn && c.nameEn !== c.name ? c.nameEn : null],
  ]);
  const effect = c.effectPt || c.effectEn;
  const prints = c.prints.length
    ? table(
        ["Impressão", "Coleção", "Raridade"],
        c.prints.map((p) => [esc(p.label ? `${p.code} · ${p.label}` : p.code), p.set ? link(`/sets/${p.set.code}`, `${p.set.name} (${p.set.code})`) : "—", esc(p.rarity || "—")]),
      )
    : "";
  const rulings = c.rulings.length
    ? c.rulings
        .map((r) => `<div style="margin:12px 0"><h3 style="font-size:15px;margin:0 0 4px 0">${esc(r.title)}</h3>${r.question ? `<p><strong>Pergunta:</strong> ${esc(r.question)}</p>` : ""}${r.answer ? `<p><strong>Resposta:</strong> ${esc(r.answer)}</p>` : ""}</div>`)
        .join("\n")
    : "";
  const related = c.related?.length ? `<ul>${c.related.map((r) => `<li>${link(`/cards/${r.id}`, `${r.name} (${r.code})`)}</li>`).join("")}</ul>` : "";
  return pageShell({
    title: `${c.name} (${c.code})`,
    lead: `${c.typeLabel}${c.colorLabel ? ` ${c.colorLabel.toLowerCase()}` : ""} de Gundam Card Game.${c.preview ? " Prévia: carta revelada em spoiler, o texto pode mudar até a lista oficial." : ""}`,
    crumbs: [{ name: "Cartas", path: "/cards" }],
    sections: [
      section("Dados da carta", stats),
      section("Efeito", paragraphs(effect)),
      c.effectPt && c.effectEn ? section("Texto original (inglês)", paragraphs(c.effectEn)) : "",
      section("Regras e esclarecimentos", rulings),
      section("Impressões", prints),
      section("Cartas relacionadas", related),
    ],
  });
}

export type CardRow = { id: string; code: string; name: string; typeLabel: string; colorLabel?: string; level?: number | null; cost?: number | null; rarity?: string | null };

const cardTable = (cards: CardRow[]) =>
  table(
    ["Código", "Nome", "Tipo", "Cor", "Nível", "Custo"],
    cards.map((c) => [esc(c.code), link(`/cards/${c.id}`, c.name), esc(c.typeLabel), esc(c.colorLabel || "—"), esc(c.level ?? "—"), esc(c.cost ?? "—")]),
  );

export function setBody(s: { code: string; name: string; releaseDate?: string; typeLabel?: string; description?: string | null; notes?: string | null; season?: string | null; cards: CardRow[] }): string {
  return pageShell({
    title: `${s.name} (${s.code})`,
    lead: `Coleção de Gundam Card Game${s.releaseDate ? ` lançada em ${s.releaseDate}` : ""}, com ${s.cards.length} cartas.`,
    crumbs: [{ name: "Coleções", path: "/sets" }],
    sections: [
      section("Sobre a coleção", [dl([["Código", s.code], ["Tipo de produto", s.typeLabel], ["Lançamento", s.releaseDate], ["Temporada", s.season]]), paragraphs(s.description), paragraphs(s.notes)].join("\n")),
      section("Cartas da coleção", s.cards.length ? cardTable(s.cards) : ""),
    ],
  });
}

export function seriesBody(s: { name: string; description?: string | null; officialUrl?: string | null; cards: CardRow[] }): string {
  return pageShell({
    title: s.name,
    lead: `Cartas de Gundam Card Game da série ${s.name}: ${s.cards.length} cartas no catálogo.`,
    crumbs: [{ name: "Séries", path: "/series" }],
    sections: [section("Sobre a série", paragraphs(s.description)), section("Cartas da série", s.cards.length ? cardTable(s.cards) : "")],
  });
}

export function articleBody(a: { title: string; excerpt?: string | null; contentMd: string; author?: string | null; publishedAt?: string; tags?: string[] }): string {
  const meta = [a.author ? `Por ${esc(a.author)}` : "", a.publishedAt ? `publicado em ${esc(a.publishedAt)}` : ""].filter(Boolean).join(", ");
  return pageShell({
    title: a.title,
    lead: a.excerpt || undefined,
    crumbs: [{ name: "Artigos", path: "/articles" }],
    sections: [meta ? `<p style="color:#94a3b8;font-size:13px">${meta}</p>` : "", `<div>${markdownToHtml(a.contentMd)}</div>`, a.tags?.length ? `<p style="font-size:13px;color:#94a3b8">${a.tags.map((t) => `#${esc(t)}`).join(" ")}</p>` : ""],
  });
}

export type TournamentContent = {
  id: string;
  name: string;
  date?: string;
  place?: string;
  organizer?: string | null;
  format?: string | null;
  participantCount?: number | null;
  roundCount?: number | null;
  sourceUrl?: string | null;
  entries: Array<{ id: string; placement?: number | null; playerName: string; wins?: number | null; losses?: number | null; draws?: number | null; archetype?: string | null; hasList: boolean }>;
};

export function tournamentBody(t: TournamentContent): string {
  const record = (e: TournamentContent["entries"][number]) => (e.wins == null && e.losses == null ? "—" : `${e.wins ?? 0}-${e.losses ?? 0}${e.draws ? `-${e.draws}` : ""}`);
  const archetypes = new Map<string, number>();
  for (const e of t.entries) if (e.archetype) archetypes.set(e.archetype, (archetypes.get(e.archetype) ?? 0) + 1);
  const meta = [...archetypes.entries()].sort((a, b) => b[1] - a[1]);
  const winner = t.entries.find((e) => e.placement === 1);
  const summary = [
    winner ? `${winner.playerName} venceu${winner.archetype ? ` com ${winner.archetype}` : ""}.` : "",
    meta.length ? `Arquétipo mais jogado: ${meta[0][0]} (${meta[0][1]} de ${t.entries.length} jogadores).` : "",
  ].filter(Boolean).join(" ");
  return pageShell({
    title: t.name,
    lead: summary || undefined,
    crumbs: [{ name: "Torneios", path: "/torneios" }],
    sections: [
      section("Sobre o evento", dl([["Data", t.date], ["Local", t.place], ["Organização", t.organizer], ["Formato", t.format], ["Jogadores", t.participantCount ?? (t.entries.length || null)], ["Rodadas", t.roundCount]])),
      section(
        "Classificação",
        t.entries.length
          ? table(
              ["#", "Jogador", "Campanha", "Arquétipo", "Lista"],
              t.entries.map((e) => [esc(e.placement ?? "—"), esc(e.playerName), esc(record(e)), esc(e.archetype || "—"), e.hasList ? link(`/torneios/${t.id}/lista/${e.id}`, "ver lista") : "—"]),
            )
          : "",
      ),
      section("Arquétipos no evento", meta.length ? table(["Arquétipo", "Jogadores", "Presença"], meta.map(([name, n]) => [esc(name), esc(n), esc(`${Math.round((n / t.entries.length) * 100)}%`)])) : ""),
    ],
  });
}

export function deckBody(d: { name: string; author?: string | null; description?: string | null; items: Array<{ quantity: number; section: string; card: { id: string; code: string; name: string; typeLabel: string } }> }): string {
  const bySection = (sec: string) => d.items.filter((i) => i.section === sec);
  const listing = (items: typeof d.items) => (items.length ? `<ul>${items.map((i) => `<li>${i.quantity}× ${link(`/cards/${i.card.id}`, `${i.card.name} (${i.card.code})`)} — ${esc(i.card.typeLabel)}</li>`).join("")}</ul>` : "");
  const main = bySection("main");
  const total = main.reduce((s, i) => s + i.quantity, 0);
  return pageShell({
    title: d.name,
    lead: `Deck de Gundam Card Game${d.author ? ` montado por ${d.author}` : ""}${total ? `, com ${total} cartas no deck principal` : ""}.`,
    crumbs: [{ name: "Decks", path: "/decks" }],
    sections: [section("Descrição", paragraphs(d.description)), section("Deck principal", listing(main)), section("Deck de recursos", listing(bySection("resource")))],
  });
}

export type DecklistCard = { quantity: number; section: string; card: { id: string; code: string; name: string; typeLabel: string } };

/** Lista usada por um jogador num torneio (/torneios/:id/lista/:entryId). */
export function decklistBody(d: {
  tournament: { id: string; name: string; date?: string };
  playerName: string; placement?: number | null; wins?: number | null; losses?: number | null; draws?: number | null; archetype?: string | null;
  totalPlayers?: number | null; items: DecklistCard[];
}): string {
  const record = d.wins == null && d.losses == null ? null : `${d.wins ?? 0}-${d.losses ?? 0}${d.draws ? `-${d.draws}` : ""}`;
  const list = (sec: string) => {
    const items = d.items.filter((i) => i.section === sec);
    return items.length ? `<ul>${items.map((i) => `<li>${i.quantity}× ${link(`/cards/${i.card.id}`, `${i.card.name} (${i.card.code})`)} — ${esc(i.card.typeLabel)}</li>`).join("")}</ul>` : "";
  };
  const main = d.items.filter((i) => i.section === "main").reduce((sum, i) => sum + i.quantity, 0);
  const lead = [
    `Lista de ${d.playerName} no torneio ${d.tournament.name}${d.tournament.date ? ` (${d.tournament.date})` : ""}.`,
    d.placement ? `Terminou em ${d.placement}º lugar${d.totalPlayers ? ` entre ${d.totalPlayers} jogadores` : ""}${record ? `, com campanha ${record}` : ""}.` : record ? `Campanha: ${record}.` : "",
    d.archetype ? `Arquétipo: ${d.archetype}.` : "",
  ].filter(Boolean).join(" ");
  return pageShell({
    title: `${d.playerName} — ${d.tournament.name}`,
    lead,
    crumbs: [{ name: "Torneios", path: "/torneios" }, { name: d.tournament.name, path: `/torneios/${d.tournament.id}` }],
    sections: [
      section(`Deck principal${main ? ` (${main} cartas)` : ""}`, list("main")),
      section("Deck de recursos", list("resource")),
      `<p>${link(`/torneios/${d.tournament.id}`, "Ver a classificação completa do torneio")}</p>`,
    ],
  });
}

const pctPt = (value: number | null | undefined) => (value == null ? "—" : `${String(value).replace(".", ",")}%`);

export type MetaCardStat = { id: string; code: string; name: string; colorLabel: string; presenceRate: number | null; avgCopies?: number | null; winRate?: number | null };
export type MetaShare = { label: string; decks: number; presenceRate: number | null };

/** /stats — o metagame competitivo da temporada, a partir das listas reais de torneio. */
export function metagameStatsBody(m: {
  seasonName?: string | null; totalDecks: number; totalTournaments: number; period?: string;
  topCards: MetaCardStat[]; colors: MetaShare[]; combos: MetaShare[]; traits: MetaShare[];
  rising: Array<MetaCardStat & { delta: number }>; tournaments: Array<{ id: string; name: string; date?: string; decks: number }>;
}): string {
  const scope = m.seasonName ? `na temporada ${m.seasonName}` : "em todas as temporadas";
  const lead = m.totalDecks
    ? `Estatísticas de Gundam Card Game ${scope}, calculadas a partir de ${m.totalDecks} listas usadas em ${m.totalTournaments} torneios${m.period ? ` (${m.period})` : ""}. Só entram decks de resultado real de torneio, nunca decks montados no site.`
    : `Ainda não há listas de torneio cadastradas ${scope}. Assim que os resultados chegarem, esta página mostra as cartas mais jogadas, as cores e as combinações que dominam o metagame.`;
  const cardLink = (c: MetaCardStat) => link(`/cards/${c.id}`, `${c.name} (${c.code})`);
  const shares = (rows: MetaShare[], label: string) => (rows.length ? table([label, "Decks", "Presença"], rows.map((r) => [esc(r.label), esc(r.decks), esc(pctPt(r.presenceRate))])) : "");
  return pageShell({
    title: "Estatísticas do metagame",
    lead,
    sections: [
      section("Cartas mais jogadas", m.topCards.length ? table(["Carta", "Cor", "Presença", "Cópias por deck", "Vitórias"], m.topCards.map((c) => [cardLink(c), esc(c.colorLabel || "—"), esc(pctPt(c.presenceRate)), esc(c.avgCopies == null ? "—" : String(c.avgCopies).replace(".", ",")), esc(pctPt(c.winRate))])) : ""),
      section("Cores", shares(m.colors, "Cor")),
      section("Combinações de cores", shares(m.combos, "Combinação")),
      section("Traços mais presentes", shares(m.traits, "Traço")),
      section("Cartas em alta", m.rising.length ? `<ul>${m.rising.map((c) => `<li>${cardLink(c)}: presença subiu ${esc(String(c.delta).replace(".", ","))} pontos nas semanas mais recentes</li>`).join("")}</ul>` : ""),
      section("Torneios da amostra", m.tournaments.length ? `<ul>${m.tournaments.map((t) => `<li>${link(`/torneios/${t.id}`, t.name)}${t.date ? ` — ${esc(t.date)}` : ""} (${esc(t.decks)} listas)</li>`).join("")}</ul>` : ""),
      `<p>Veja também os ${link("/arquetipos", "arquétipos do metagame")} e o ${link("/metagame/regional", "metagame por região do Brasil")}.</p>`,
    ],
  });
}

export type RegionStat = { label: string; totalDecks: number; winRate: number | null; colors: MetaShare[]; topCards: MetaCardStat[] };

/** /metagame/regional — o metagame por estado, cidade e loja. */
export function regionalMetaBody(r: {
  seasonName?: string | null; totalDecks: number; national: RegionStat; states: RegionStat[]; cities: RegionStat[];
  anomalies: Array<{ scope: string; label: string; regionRate: number; nationalRate: number; deltaPp: number }>;
}): string {
  const scope = r.seasonName ? `na temporada ${r.seasonName}` : "em todas as temporadas";
  const cardList = (cards: MetaCardStat[]) => cards.map((c) => `${link(`/cards/${c.id}`, c.name)} (${esc(pctPt(c.presenceRate))})`).join(", ");
  const colorList = (colors: MetaShare[]) => colors.slice(0, 3).map((c) => `${esc(c.label)} ${esc(pctPt(c.presenceRate))}`).join(", ");
  const regionTable = (rows: RegionStat[], label: string) =>
    rows.length ? table([label, "Listas", "Vitórias", "Cores principais", "Cartas mais jogadas"], rows.map((g) => [esc(g.label), esc(g.totalDecks), esc(pctPt(g.winRate)), colorList(g.colors) || "—", cardList(g.topCards.slice(0, 3)) || "—"])) : "";
  return pageShell({
    title: "Metagame regional",
    lead: r.totalDecks
      ? `Como o Gundam Card Game é jogado em cada região do Brasil ${scope}: ${r.totalDecks} listas de torneio separadas por estado e cidade, com as cores, as cartas mais jogadas e o que cada região joga diferente da média nacional.`
      : `Ainda não há listas de torneio com local cadastrado ${scope}. Quando os resultados chegarem, esta página compara o metagame de cada estado e cidade com a média nacional.`,
    sections: [
      section("Brasil", r.national.totalDecks ? `<p>${esc(r.national.totalDecks)} listas. Cores: ${colorList(r.national.colors) || "—"}. Cartas mais jogadas: ${cardList(r.national.topCards.slice(0, 5)) || "—"}.</p>` : ""),
      section("Por estado", regionTable(r.states, "Estado")),
      section("Por cidade", regionTable(r.cities.slice(0, 20), "Cidade")),
      section("O que cada região joga diferente", r.anomalies.length ? `<ul>${r.anomalies.slice(0, 10).map((a) => `<li>${esc(a.scope)}: ${esc(a.label)} aparece em ${esc(pctPt(a.regionRate))} das listas, contra ${esc(pctPt(a.nationalRate))} no país (${a.deltaPp > 0 ? "+" : ""}${esc(String(a.deltaPp).replace(".", ","))} pontos)</li>`).join("")}</ul>` : ""),
      `<p>Veja também as ${link("/stats", "estatísticas gerais do metagame")} e os ${link("/torneios", "resultados de torneio")}.</p>`,
    ],
  });
}

export function aboutBody(a: { title: string; lead: string; updated: string; contact: string; sections: AboutSection[] }): string {
  return pageShell({
    title: a.title,
    lead: a.lead,
    sections: [
      `<p style="color:#94a3b8;font-size:12px">Última atualização: ${esc(a.updated)}</p>`,
      ...a.sections.map((s) =>
        section(s.title, [
          s.items?.length ? `<ul>${s.items.map((i) => `<li>${i.label ? `<strong>${i.href ? link(i.href, i.label) : esc(i.label)}</strong>: ` : ""}${esc(i.text)}</li>`).join("")}</ul>` : "",
          ...(s.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`),
        ].join("\n")),
      ),
      section("Contato", `<p>Dúvidas, correções e parcerias: <a href="mailto:${esc(a.contact)}" style="color:#38bdf8">${esc(a.contact)}</a></p>`),
    ],
  });
}

export function supportBody(s: {
  title: string; lead: string; why: string[]; channels: SupportChannel[];
  tiers?: Array<{ icon: string; label: string; minMonthly: number; perks: string[] }>;
  supporters?: Array<{ name: string; tierLabel?: string }>;
}): string {
  return pageShell({
    title: s.title,
    lead: s.lead,
    sections: [
      `<ul>${s.why.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>`,
      s.tiers?.length
        ? section("Patentes de apoiador", s.tiers.map((t) => `<div style="margin:12px 0"><h3 style="font-size:16px;margin:0 0 4px 0">${esc(t.icon)} ${esc(t.label)} — R$ ${esc(t.minMonthly)}/mês</h3><ul>${t.perks.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>`).join("\n"))
        : "",
      s.supporters?.length
        ? section("Mural de apoiadores", `<ul>${s.supporters.map((p) => `<li>${esc(p.name)}${p.tierLabel ? ` — ${esc(p.tierLabel)}` : ""}</li>`).join("")}</ul>`)
        : "",
      section(
        "Como ajudar",
        s.channels
          .map((c) => `<div style="margin:14px 0"><h3 style="font-size:16px;margin:0 0 4px 0">${esc(c.title)}</h3><p style="margin:2px 0">${esc(c.text)}</p>${c.copy ? `<p style="margin:2px 0"><code>${esc(c.copy)}</code></p>` : ""}${c.href ? `<p style="margin:2px 0"><a href="${esc(c.href)}" rel="noopener" style="color:#38bdf8">${esc(c.cta ?? "Abrir")}</a></p>` : ""}</div>`)
          .join("\n"),
      ),
    ],
  });
}

// ---------------------------------------------------------------------------------------------------------
// Páginas de lista

export function setsIndexBody(title: string, lead: string, sets: Array<{ code: string; name: string; releaseDate?: string; cardCount: number; typeLabel?: string }>): string {
  return pageShell({
    title,
    lead,
    sections: [section("Coleções", table(["Código", "Coleção", "Tipo", "Lançamento", "Cartas"], sets.map((s) => [esc(s.code), link(`/sets/${s.code}`, s.name), esc(s.typeLabel || "—"), esc(s.releaseDate || "—"), esc(s.cardCount)])))],
  });
}

export function seriesIndexBody(series: Array<{ slug: string; name: string; description?: string | null }>): string {
  return pageShell({
    title: "Séries de Gundam no Gundam Card Game",
    lead: "As obras da franquia Gundam representadas nas cartas, cada uma com a lista de cartas que vieram dela.",
    sections: [`<ul>${series.map((s) => `<li>${link(`/series/${s.slug}`, s.name)}${s.description ? ` — ${esc(s.description.slice(0, 180))}` : ""}</li>`).join("")}</ul>`],
  });
}

export function articlesIndexBody(posts: Array<{ slug: string; title: string; excerpt?: string | null; publishedAt?: string }>): string {
  return pageShell({
    title: "Artigos",
    lead: "Guias, análises de metagame e novidades de Gundam Card Game escritos pela comunidade do Anaheim Hub.",
    sections: [posts.length ? posts.map((p) => `<div style="margin:14px 0"><h2 style="font-size:17px;margin:0">${link(`/articles/${p.slug}`, p.title)}</h2>${p.publishedAt ? `<p style="font-size:12px;color:#94a3b8;margin:2px 0">${esc(p.publishedAt)}</p>` : ""}${p.excerpt ? `<p style="margin:4px 0">${esc(p.excerpt)}</p>` : ""}</div>`).join("\n") : ""],
  });
}

export function tournamentsIndexBody(items: Array<{ id: string; name: string; date?: string; place?: string; players: number; winner?: string | null; winnerArchetype?: string | null }>): string {
  return pageShell({
    title: "Torneios de Gundam Card Game",
    lead: "Resultados de torneios com classificação, campanha de cada jogador, arquétipos e listas de deck.",
    sections: [
      section(
        "Eventos mais recentes",
        table(["Data", "Evento", "Local", "Jogadores", "Campeão"], items.map((t) => [esc(t.date || "—"), link(`/torneios/${t.id}`, t.name), esc(t.place || "—"), esc(t.players || "—"), esc(t.winner ? `${t.winner}${t.winnerArchetype ? ` (${t.winnerArchetype})` : ""}` : "—")])),
      ),
    ],
  });
}

export function decksIndexBody(decks: Array<{ shareId: string; name: string; author?: string | null }>): string {
  return pageShell({
    title: "Decks públicos de Gundam Card Game",
    lead: "Listas compartilhadas pelos jogadores, com as cartas, a curva de custo e as estatísticas de cada deck.",
    sections: [section("Decks recentes", `<ul>${decks.map((d) => `<li>${link(`/deck/${d.shareId}`, d.name)}${d.author ? ` — por ${esc(d.author)}` : ""}</li>`).join("")}</ul>`)],
  });
}

export function rulesBody(opts: {
  keywords: Array<{ name: string; raw: string; descriptionPt: string; examplePt?: string; rulesSection?: string; category: string }>;
  rulings: Array<{ id: string; title: string; question?: string | null; answer?: string | null; keyword?: string | null }>;
}): string {
  const CATEGORY: Record<string, string> = { effect_keyword: "Palavras-chave de efeito", trigger_keyword: "Gatilhos", mechanic: "Mecânicas", phase_or_step: "Fases e etapas" };
  const groups = new Map<string, typeof opts.keywords>();
  for (const k of opts.keywords) groups.set(k.category, [...(groups.get(k.category) ?? []), k]);
  const glossary = [...groups.entries()]
    .map(([cat, list]) => `<h3 style="font-size:16px">${esc(CATEGORY[cat] ?? cat)}</h3>\n${list
      .map((k) => `<div style="margin:10px 0"><h4 style="margin:0;font-size:15px">${esc(k.raw || k.name)}${k.rulesSection ? ` <span style="color:#94a3b8;font-size:12px">(${esc(k.rulesSection)})</span>` : ""}</h4><p style="margin:4px 0">${esc(k.descriptionPt)}</p>${k.examplePt ? `<p style="margin:4px 0;color:#cbd5e1"><em>Exemplo:</em> ${esc(k.examplePt)}</p>` : ""}</div>`)
      .join("\n")}`)
    .join("\n");
  const rulings = opts.rulings
    .map((r) => `<div style="margin:14px 0"><h3 style="font-size:15px;margin:0 0 4px 0">${link(`/rules/${r.id}`, r.title)}</h3>${r.question ? `<p style="margin:2px 0"><strong>Pergunta:</strong> ${esc(r.question)}</p>` : ""}${r.answer ? `<p style="margin:2px 0"><strong>Resposta:</strong> ${esc(r.answer)}</p>` : ""}</div>`)
    .join("\n");
  return pageShell({
    title: "Regras e rulings de Gundam Card Game",
    lead: "Palavras-chave, gatilhos e esclarecimentos de regras explicados em português, com a seção correspondente das Comprehensive Rules.",
    sections: [section("Glossário de palavras-chave", glossary), section("Esclarecimentos de regras", rulings)],
  });
}

export function rulingBody(r: { title: string; question?: string | null; answer?: string | null; example?: string | null; keyword?: string | null; card?: { id: string; code: string; name: string } | null; source?: string }): string {
  return pageShell({
    title: r.title,
    crumbs: [{ name: "Regras", path: "/rules" }],
    sections: [
      r.question ? section("Pergunta", paragraphs(r.question)) : "",
      r.answer ? section("Resposta", paragraphs(r.answer)) : "",
      r.example ? section("Exemplo de jogada", paragraphs(r.example)) : "",
      section("Referências", dl([["Palavra-chave", r.keyword], ["Fonte", r.source]]) + (r.card ? `<p>Carta: ${link(`/cards/${r.card.id}`, `${r.card.name} (${r.card.code})`)}</p>` : "")),
    ],
  });
}

// ---------------------------------------------------------------------------------------------------------
// Metagame: arquétipos e jogadores (dados do Zero System, server/vedaCore.ts)

const pct = (x: number) => `${Math.round(x * 100)}%`;
const COLOR_WORD: Record<string, string> = { blue: "Azul", green: "Verde", red: "Vermelho", white: "Branco", purple: "Roxo", yellow: "Amarelo" };
const colorsPt = (colors: string[]) => colors.map((c) => COLOR_WORD[c.toLowerCase()] ?? c).join("/");

export type ArchetypeRowContent = { name: string; slug: string; colors: string[]; lists: number; share: number; wins: number; top8Share: number };

export function archetypesIndexBody(rows: ArchetypeRowContent[], sample: { tournaments: number; lists: number }): string {
  return pageShell({
    title: "Arquétipos do metagame de Gundam Card Game",
    lead: `Os decks que mais aparecem nos torneios, com presença, títulos e taxa de top 8 — ${sample.lists} listas de ${sample.tournaments} torneios.`,
    sections: [
      section(
        "Arquétipos por presença",
        table(
          ["Arquétipo", "Cores", "Listas", "Presença", "Títulos", "Top 8"],
          rows.map((r) => [link(`/arquetipos/${r.slug}`, r.name), esc(colorsPt(r.colors) || "—"), esc(r.lists), esc(pct(r.share)), esc(r.wins), esc(pct(r.top8Share))]),
        ),
      ),
    ],
  });
}

export type ArchetypeContent = {
  name: string;
  colors: string[];
  lists: number;
  share: number;
  wins: number;
  top8Share: number;
  sample: { tournaments: number; from: string | null; to: string | null };
  cards: Array<{ cardModelId: string | null; code: string; name: string; inclusion: number; avgCopies: number; tier: string }>;
  results: Array<{ tournamentId: string; tournamentName: string; date: string | null; placementLabel: string; player: { name: string; slug: string } }>;
};

const TIER_PT: Record<string, string> = { core: "Núcleo", flex: "Flexível", tech: "Tech" };

export function archetypeBody(a: ArchetypeContent): string {
  const core = a.cards.filter((c) => c.tier === "core").slice(0, 4).map((c) => c.name);
  const period = a.sample.from && a.sample.to ? ` entre ${a.sample.from} e ${a.sample.to}` : "";
  return pageShell({
    title: `${a.name} — arquétipo de Gundam Card Game`,
    lead: `${a.name} (${colorsPt(a.colors) || "sem cor definida"}) apareceu em ${a.lists} listas de ${a.sample.tournaments} torneios${period}: ${pct(a.share)} do metagame, ${a.wins} ${a.wins === 1 ? "título" : "títulos"} e ${pct(a.top8Share)} das listas no top 8.${core.length ? ` Base do deck: ${core.join(", ")}.` : ""}`,
    crumbs: [{ name: "Arquétipos", path: "/arquetipos" }],
    sections: [
      section(
        "Cartas do arquétipo",
        a.cards.length
          ? table(
              ["Carta", "Código", "Em quantas listas", "Cópias (média)", "Papel"],
              a.cards.slice(0, 40).map((c) => [c.cardModelId ? link(`/cards/${c.cardModelId}`, c.name) : esc(c.name), esc(c.code), esc(pct(c.inclusion)), esc(c.avgCopies.toFixed(1).replace(".", ",")), esc(TIER_PT[c.tier] ?? c.tier)]),
            )
          : "",
      ),
      section(
        "Resultados recentes",
        a.results.length
          ? table(
              ["Data", "Torneio", "Colocação", "Jogador"],
              a.results.map((r) => [esc(r.date ?? "—"), link(`/torneios/${r.tournamentId}`, r.tournamentName), esc(r.placementLabel), link(`/jogadores/${r.player.slug}`, r.player.name)]),
            )
          : "",
      ),
    ],
  });
}

export type PlayerContent = {
  name: string;
  tournaments: number;
  wins: number;
  top8: number;
  archetypes: Array<{ name: string; slug: string; count: number }>;
  results: Array<{ tournamentId: string; tournamentName: string; date: string | null; placementLabel: string; record: string | null; archetype: { name: string; slug: string } | null }>;
};

export function playerBody(p: PlayerContent): string {
  const fav = p.archetypes[0];
  return pageShell({
    title: `${p.name} — resultados em torneios de Gundam Card Game`,
    lead: `${p.tournaments} ${p.tournaments === 1 ? "torneio" : "torneios"}, ${p.wins} ${p.wins === 1 ? "título" : "títulos"} e ${p.top8} top 8.${fav ? ` Arquétipo mais jogado: ${fav.name} (${fav.count}x).` : ""}`,
    crumbs: [{ name: "Torneios", path: "/torneios" }],
    sections: [
      section("Arquétipos jogados", p.archetypes.length ? `<ul>${p.archetypes.map((a) => `<li>${link(`/arquetipos/${a.slug}`, a.name)} — ${a.count}x</li>`).join("")}</ul>` : ""),
      section(
        "Resultados",
        table(
          ["Data", "Torneio", "Colocação", "Campanha", "Arquétipo"],
          p.results.map((r) => [esc(r.date ?? "—"), link(`/torneios/${r.tournamentId}`, r.tournamentName), esc(r.placementLabel), esc(r.record ?? "—"), r.archetype ? link(`/arquetipos/${r.archetype.slug}`, r.archetype.name) : "—"]),
        ),
      ),
      `<p style="font-size:12px;color:#94a3b8">Resultados agrupados pelo nome usado nos torneios; jogadores com o mesmo nome aparecem juntos.</p>`,
    ],
  });
}
