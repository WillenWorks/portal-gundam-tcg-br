// Rotas /api/veda/* (leitura dos resultados de torneio, contrato em src/lib/veda/types.ts) e /api/admin/dados/*
// (disparar e acompanhar o workflow "Dados do site" do Actions pelo Postman ou por URL).
// Os dados são carregados uma vez e ficam em memória por CACHE_TTL_MS: as importações rodam em outro processo
// (workflow), então o site passa a mostrar torneios novos em até 5 minutos.
import { timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import { deriveStateFromCity } from "./services/regionalMetaService.ts";
import {
  archetypeDetail,
  archetypeRows,
  cardUsage,
  decklist,
  exportLists,
  filters,
  filterTournaments,
  paginate,
  player,
  summary,
  tournamentCard,
  tournamentDetail,
  VedaIndex,
  type RawCard,
  type TournamentFilter,
  type VedaData,
} from "./vedaCore.ts";
import type { VedaTier } from "../src/lib/veda/types.ts";

const CACHE_TTL_MS = 5 * 60_000;
const WORKFLOW_FILE = "dados-site.yml";
const TAREFAS = ["auditoria", "impressoes", "faq", "relacoes", "torneios", "digilab-br", "tudo"] as const;

let cache: { at: number; index: VedaIndex } | null = null;
let loading: Promise<VedaIndex> | null = null;

export async function loadVedaData(prisma: PrismaClient): Promise<VedaData> {
  const [seasons, tournaments, entries] = await Promise.all([
    prisma.season.findMany({ orderBy: { startDate: "asc" }, select: { code: true, name: true, isCurrent: true } }),
    prisma.tournament.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        id: true, name: true, organizer: true, country: true, city: true, season: true, tier: true, sourceUrl: true,
        participantCount: true, roundCount: true, dateStart: true, updatedAt: true, seasonRef: { select: { code: true } },
      },
    }),
    prisma.tournamentEntry.findMany({
      where: { tournament: { isActive: true, deletedAt: null } },
      select: { id: true, tournamentId: true, playerName: true, placement: true, wins: true, losses: true, draws: true, archetype: true, deckSnapshotId: true },
    }),
  ]);
  const snapshotIds = [...new Set(entries.map((e) => e.deckSnapshotId).filter((id): id is string => !!id))];
  const items = snapshotIds.length
    ? await prisma.deckSnapshotItem.findMany({
        where: { deckSnapshotId: { in: snapshotIds }, section: "main" },
        select: { deckSnapshotId: true, cardId: true, quantity: true },
      })
    : [];
  const cardIds = [...new Set(items.map((i) => i.cardId))];
  const cardRows = cardIds.length
    ? await prisma.card.findMany({
        where: { id: { in: cardIds } },
        select: { id: true, cardModelId: true, code: true, nameEn: true, namePt: true, cardType: true, color: true, level: true, cost: true, imageUrl: true, imageMediumUrl: true },
      })
    : [];
  const snapshots = new Map<string, Array<{ cardId: string; quantity: number }>>();
  for (const i of items) {
    const list = snapshots.get(i.deckSnapshotId) ?? [];
    list.push({ cardId: i.cardId, quantity: i.quantity });
    snapshots.set(i.deckSnapshotId, list);
  }
  const cards = new Map<string, RawCard>(
    cardRows.map((c) => [c.id, { cardModelId: c.cardModelId, code: c.code, nameEn: c.nameEn, namePt: c.namePt, cardType: String(c.cardType), color: c.color, level: c.level, cost: c.cost, imageUrl: c.imageMediumUrl ?? c.imageUrl }]),
  );
  return {
    seasons,
    tournaments: tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      organizer: t.organizer,
      country: t.country,
      city: t.city,
      uf: t.city ? deriveStateFromCity(t.city, t.country).uf : null,
      season: t.seasonRef?.code ?? t.season,
      tier: t.tier as VedaTier,
      sourceUrl: t.sourceUrl,
      participantCount: t.participantCount,
      roundCount: t.roundCount,
      date: t.dateStart?.toISOString() ?? null,
      updatedAt: t.updatedAt.toISOString(),
    })),
    entries,
    snapshots,
    cards,
  };
}

async function getIndex(prisma: PrismaClient): Promise<VedaIndex> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.index;
  loading ??= loadVedaData(prisma)
    .then((data) => {
      const index = new VedaIndex(data);
      cache = { at: Date.now(), index };
      return index;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function filterFrom(req: Request): TournamentFilter {
  const q = req.query;
  return { season: str(q.season), tier: str(q.tier), source: str(q.source), country: str(q.country), uf: str(q.uf), city: str(q.city), store: str(q.store), q: str(q.q), from: str(q.from), to: str(q.to) };
}

function publicCache(res: Response) {
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
}

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

function tokenMatches(given: string | undefined): boolean {
  const expected = process.env.DADOS_TOKEN;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** token do workflow (cabeçalho X-Dados-Token ou ?token=) ou, sem ele, admin logado */
function dadosGuard(adminGuard: RequestHandler[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const given = (req.header("x-dados-token") ?? str(req.query.token)) || undefined;
    if (tokenMatches(given)) return next();
    let i = 0;
    const step = (err?: unknown) => {
      if (err) return next(err);
      const guard = adminGuard[i++];
      if (!guard) return next();
      guard(req, res, step);
    };
    step();
  };
}

async function github(path: string, init: RequestInit = {}) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO ?? "WillenWorks/portal-gundam-tcg-br";
  if (!token) return { ok: false, status: 503, body: { error: "GITHUB_DISPATCH_TOKEN não configurado no servidor." } };
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : null };
}

export function registerVedaRoutes(app: Express, prisma: PrismaClient, adminGuard: RequestHandler[]) {
  app.get("/api/veda/summary", wrap(async (_req, res) => {
    publicCache(res);
    res.json(summary(await getIndex(prisma)));
  }));

  app.get("/api/veda/filters", wrap(async (_req, res) => {
    publicCache(res);
    res.json(filters(await getIndex(prisma)));
  }));

  app.get("/api/veda/tournaments", wrap(async (req, res) => {
    publicCache(res);
    const ix = await getIndex(prisma);
    const page = paginate(filterTournaments(ix, filterFrom(req)), Number(req.query.offset ?? 0), Number(req.query.limit ?? 0));
    res.json({ ...page, items: page.items.map((t) => tournamentCard(ix, t)) });
  }));

  app.get("/api/veda/tournaments/:id", wrap(async (req, res) => {
    publicCache(res);
    const detail = tournamentDetail(await getIndex(prisma), String(req.params.id));
    if (!detail) return res.status(404).json({ error: "Torneio não encontrado." });
    res.json(detail);
  }));

  app.get("/api/veda/decklists/:entryId", wrap(async (req, res) => {
    publicCache(res);
    const list = decklist(await getIndex(prisma), String(req.params.entryId));
    if (!list) return res.status(404).json({ error: "Lista não encontrada ou não informada." });
    res.json(list);
  }));

  app.get("/api/veda/players/:slug", wrap(async (req, res) => {
    publicCache(res);
    const p = player(await getIndex(prisma), String(req.params.slug), str(req.query.season));
    if (!p) return res.status(404).json({ error: "Jogador não encontrado." });
    res.json(p);
  }));

  app.get("/api/veda/archetypes", wrap(async (req, res) => {
    publicCache(res);
    res.json(archetypeRows(await getIndex(prisma), filterFrom(req)));
  }));

  app.get("/api/veda/archetypes/:slug", wrap(async (req, res) => {
    publicCache(res);
    const detail = archetypeDetail(await getIndex(prisma), String(req.params.slug), filterFrom(req));
    if (!detail) return res.status(404).json({ error: "Arquétipo não encontrado." });
    res.json(detail);
  }));

  app.get("/api/veda/cards/:cardModelId", wrap(async (req, res) => {
    publicCache(res);
    const usage = cardUsage(await getIndex(prisma), String(req.params.cardModelId), filterFrom(req));
    if (!usage) return res.status(404).json({ error: "Carta sem uso em torneios." });
    res.json(usage);
  }));

  const guard = dadosGuard(adminGuard);

  app.get("/api/veda/export/lists", guard, wrap(async (req, res) => {
    const f = filterFrom(req);
    const lists = exportLists(await getIndex(prisma), { ...f, season: str(req.query.format) ?? f.season, since: str(req.query.since) });
    res.json({ date: new Date().toISOString().slice(0, 10), source: "anaheimhub", lists });
  }));

  const disparar = wrap(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const tarefa = str(body.tarefa) ?? str(req.query.tarefa) ?? "auditoria";
    const aplicar = String(body.aplicar ?? req.query.aplicar ?? "false") === "true";
    if (!(TAREFAS as readonly string[]).includes(tarefa)) return res.status(400).json({ error: `tarefa inválida; use ${TAREFAS.join(", ")}` });
    const r = await github(`/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref: "main", inputs: { tarefa, aplicar: String(aplicar) } }),
    });
    if (!r.ok) return res.status(r.status === 503 ? 503 : 502).json({ error: "GitHub recusou o disparo.", detalhe: r.body });
    cache = null;
    res.status(202).json({ ok: true, tarefa, aplicar, acompanhar: "/api/admin/dados/execucoes" });
  });
  app.post("/api/admin/dados/disparar", guard, disparar);
  app.get("/api/admin/dados/disparar", guard, disparar);

  app.get("/api/admin/dados/execucoes", guard, wrap(async (_req, res) => {
    const r = await github(`/actions/workflows/${WORKFLOW_FILE}/runs?per_page=10`);
    if (!r.ok) return res.status(r.status === 503 ? 503 : 502).json({ error: "Não foi possível consultar o GitHub.", detalhe: r.body });
    const runs = (r.body?.workflow_runs ?? []) as Array<Record<string, unknown>>;
    res.json(runs.map((run) => ({ id: run.id, evento: run.event, status: run.status, resultado: run.conclusion, inicio: run.run_started_at, link: run.html_url })));
  }));

  app.post("/api/admin/dados/cache/limpar", guard, (_req, res) => {
    cache = null;
    res.json({ ok: true });
  });
}
