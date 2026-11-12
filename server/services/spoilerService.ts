/* Spoilers do Discord → catálogo (prévia) + artigo do dia + carrossel e stories, com um clique de aprovação.
 *
 * Fluxo (liga com SPOILER_CAPTURE_ENABLED=true):
 *  1. O canal de spoilers de outro servidor é SEGUIDO (botão "Seguir" do Discord) para um canal do servidor do Anaheim
 *     Hub (SPOILER_DISCORD_CHANNEL_ID). O bot do Anaheim Hub lê esse canal pela API a cada 2 minutos — não usa conta
 *     pessoal (self-bot é proibido pelo Discord) e não precisa estar no servidor de origem.
 *  2. Cada imagem nova é copiada para /uploads/spoilers (o link do Discord expira) e a IA lê a carta
 *     (spoilerExtract.ts). Com código, a carta entra no catálogo como PRÉVIA e INATIVA (ninguém vê ainda).
 *  3. Passados SPOILER_QUIET_MINUTES (padrão 20) sem spoiler novo, junta os do dia num resumo: artigo (rascunho em
 *     revisão) com a análise de spoilerAnalysis.ts, carrossel e um story por carta. Aviso no Discord com ✅/❌.
 *  4. ✅ publica tudo: ativa as cartas prévia, publica o artigo e posta carrossel + stories. ❌ descarta o post e
 *     deixa artigo e cartas como rascunho (dá para revisar e publicar pelo painel).
 * Nada vai ao ar sem o clique.
 *
 * Configuração (uma vez):
 *  a. no canal de spoilers, botão "Seguir" → escolher um canal do servidor do Anaheim Hub (ex.: #spoilers-entrada);
 *  b. o bot dos botões de aprovação (DISCORD_BOT_TOKEN) precisa de "Ver canal" e "Ler histórico" nesse canal;
 *  c. discord.com/developers/applications → o app → Bot → ligar "Message Content Intent" (sem isso as mensagens
 *     chegam sem texto nem anexos);
 *  d. .env: SPOILER_CAPTURE_ENABLED="true" e SPOILER_DISCORD_CHANNEL_ID="<id do canal>" (opcionais em .env.example);
 *  e. reiniciar a API: o log mostra "[spoilers] vigiando o canal ...".
 * Conferir: GET /api/admin/spoilers. Forçar um ciclo (sem esperar o silêncio): POST /api/admin/spoilers/run.
 * Quando a lista oficial sai, prisma/import-official-set.mjs troca a prévia pela carta oficial. */
import fs from "node:fs";
import path from "node:path";
import { PostStatus, PostType, SocialPostType, UserRole, type PrismaClient, type SocialMediaPost } from "@prisma/client";
import { sniffImageType, IMAGE_EXTENSION_BY_TYPE } from "../imageSniff.ts";
import { parseCardEffects } from "../../src/lib/gundam-card-effects.ts";
import { extractSpoilerCard, normalizeSpoilerCard, type SpoilerCardData } from "./spoilerExtract.ts";
import { analyzeSpoiler, loadSpoilerAnalysisContext, type SpoilerAnalysis, type SpoilerAnalysisContext } from "./spoilerAnalysis.ts";

const DISCORD_API = "https://discord.com/api/v10";
const SNOWFLAKE = /^\d{5,25}$/;
const POLL_MS = 2 * 60_000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
/** o Instagram aceita até 10 itens no carrossel: capa + 9 cartas */
export const DIGEST_MAX_SLIDE_CARDS = 9;
export const DIGEST_MAX_STORIES = 10;
/** só baixa imagem do CDN do Discord (anexo e cópia do embed): link de embed pode apontar para qualquer lugar */
const DISCORD_CDN_HOSTS = new Set(["cdn.discordapp.com", "media.discordapp.net"]);

const CARD_TYPE_PT: Record<string, string> = { UNIT: "Unidade", PILOT: "Piloto", COMMAND: "Comando", BASE: "Base", RESOURCE: "Recurso" };
const COLOR_PT: Record<string, string> = { blue: "Azul", green: "Verde", red: "Vermelho", white: "Branco", purple: "Roxo", yellow: "Amarelo" };
const colorPt = (c: string | null | undefined) => (c ? COLOR_PT[c.toLowerCase()] ?? c : "—");

// ---------------------------------------------------------------------------------------------------------
// Configuração

export type SpoilerConfig = { botToken: string; channelId: string; quietMinutes: number; backfillHours: number };

export function readSpoilerConfig(env: NodeJS.ProcessEnv = process.env): SpoilerConfig | null {
  if (env.SPOILER_CAPTURE_ENABLED !== "true") return null;
  const botToken = (env.DISCORD_BOT_TOKEN || "").trim();
  const channelId = (env.SPOILER_DISCORD_CHANNEL_ID || "").trim();
  if (!botToken || !SNOWFLAKE.test(channelId)) return null;
  const num = (v: string | undefined, def: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? n : def;
  };
  return {
    botToken,
    channelId,
    quietMinutes: num(env.SPOILER_QUIET_MINUTES, 20, 1, 24 * 60),
    backfillHours: num(env.SPOILER_BACKFILL_HOURS, 12, 0, 72),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Mensagens do Discord (puro)

export type DiscordAttachment = { id: string; url: string; proxy_url?: string; filename?: string; content_type?: string; size?: number };
export type DiscordEmbed = { type?: string; image?: { url?: string; proxy_url?: string }; thumbnail?: { url?: string; proxy_url?: string } };
export type DiscordMessage = {
  id: string;
  channel_id: string;
  content?: string;
  timestamp: string;
  attachments?: DiscordAttachment[];
  embeds?: DiscordEmbed[];
  message_reference?: { guild_id?: string; channel_id?: string; message_id?: string };
};

export type SpoilerImageRef = { sourceKey: string; url: string };

const isDiscordCdn = (url: string | undefined): url is string => {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && DISCORD_CDN_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
};

/** Imagens de uma mensagem: anexos de imagem e, se não houver anexo, imagens dos embeds (pela cópia no CDN do Discord). */
export function spoilerImagesOf(msg: DiscordMessage): SpoilerImageRef[] {
  const out: SpoilerImageRef[] = [];
  const seen = new Set<string>();
  const push = (key: string, url: string | undefined) => {
    if (!isDiscordCdn(url)) return;
    const bare = url.split("?")[0];
    if (seen.has(bare)) return;
    seen.add(bare);
    out.push({ sourceKey: `${msg.id}:${key}`, url });
  };
  for (const a of msg.attachments ?? []) {
    const isImage = (a.content_type || "").startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(a.filename || "");
    if (isImage && (a.size ?? 0) <= MAX_IMAGE_BYTES) push(`a${a.id}`, a.url);
  }
  if (!out.length) {
    (msg.embeds ?? []).forEach((e, i) => {
      push(`e${i}`, e.image?.proxy_url || e.image?.url);
      push(`t${i}`, e.thumbnail?.proxy_url || e.thumbnail?.url);
    });
  }
  return out;
}

/** Link da mensagem original (a do servidor seguido), quando o Discord informa. */
export function sourceUrlOf(msg: DiscordMessage): string | null {
  const ref = msg.message_reference;
  if (ref?.guild_id && ref.channel_id && ref.message_id && [ref.guild_id, ref.channel_id, ref.message_id].every((x) => SNOWFLAKE.test(x))) {
    return `https://discord.com/channels/${ref.guild_id}/${ref.channel_id}/${ref.message_id}`;
  }
  return null;
}

/** Código da coleção a partir do código da carta ("GD07-012" → "GD07"). */
export const setCodeOf = (code: string | null | undefined) => (code ? /^([A-Z]{1,4}\d{0,3})-/i.exec(code)?.[1]?.toUpperCase() ?? null : null);

// ---------------------------------------------------------------------------------------------------------
// Discord e arquivos (I/O)

type FetchFn = typeof fetch;

/** Mensagens depois de `afterId`, da mais antiga para a mais nova (até 5 páginas de 50). */
export async function fetchMessagesAfter(config: SpoilerConfig, afterId: string | null, fetchFn: FetchFn = fetch): Promise<DiscordMessage[]> {
  const all: DiscordMessage[] = [];
  let cursor = afterId;
  for (let page = 0; page < 5; page += 1) {
    const qs = cursor ? `after=${cursor}&limit=50` : "limit=50";
    const res = await fetchFn(`${DISCORD_API}/channels/${config.channelId}/messages?${qs}`, { headers: { Authorization: `Bot ${config.botToken}` } });
    if (!res.ok) throw new Error(`Discord respondeu ${res.status} ao ler o canal de spoilers (o bot tem acesso ao canal?)`);
    const batch = ((await res.json()) as DiscordMessage[]).sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
    all.push(...batch);
    if (!cursor || batch.length < 50) break; // sem cursor: só a última página (primeira execução)
    cursor = batch[batch.length - 1].id;
  }
  return all;
}

const uploadRoot = () => path.resolve(process.cwd(), process.env.LOCAL_UPLOAD_DIR || "public/uploads");

/** Baixa a imagem do CDN do Discord e grava em /uploads/spoilers. */
export async function saveSpoilerImage(url: string, stem: string, fetchFn: FetchFn = fetch): Promise<{ buffer: Buffer; mimeType: string; localUrl: string }> {
  if (!isDiscordCdn(url)) throw new Error("Imagem fora do CDN do Discord.");
  const res = await fetchFn(url, { redirect: "error" });
  if (!res.ok) throw new Error(`Download da imagem falhou (${res.status}).`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Imagem grande demais.");
  const type = sniffImageType(buffer);
  if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type)) throw new Error("Arquivo não é JPEG, PNG nem WebP.");
  const name = `${stem.replace(/[^A-Za-z0-9-]/g, "").slice(0, 60) || "spoiler"}${IMAGE_EXTENSION_BY_TYPE[type]}`;
  const dir = path.join(uploadRoot(), "spoilers");
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, name), buffer);
  return { buffer, mimeType: type, localUrl: `/uploads/spoilers/${name}` };
}

// ---------------------------------------------------------------------------------------------------------
// Carta prévia no catálogo

/**
 * Grava a carta como prévia INATIVA (aparece só depois do ✅). Carta já lançada (ativa e não prévia) não é tocada:
 * o spoiler só aponta para ela. Sem código impresso não há como entrar no catálogo.
 */
export async function upsertPreviewCard(prisma: PrismaClient, card: SpoilerCardData, imageUrl: string): Promise<{ cardModelId: string; code: string; official: boolean } | null> {
  if (!card.code) return null;
  const code = card.code;
  const existing = await prisma.cardModel.findUnique({ where: { code }, select: { id: true, isActive: true, legalityStatus: true } });
  if (existing && existing.isActive && existing.legalityStatus !== "preview") return { cardModelId: existing.id, code, official: true };

  const parsed = parseCardEffects(card.effectEn || "", "");
  const sections = card.effectEn || card.effectPt ? [{ kind: "effect", label: "Effect", textPt: card.effectPt || "", textEn: card.effectEn || "" }] : [];
  const fields = {
    nameEn: card.nameEn,
    cardType: card.cardType,
    color: card.color,
    level: card.level,
    cost: card.cost,
    ap: card.ap,
    hp: card.hp,
    traits: card.traits,
    trait: card.traits.join(" | ") || null,
    linkText: card.linkText,
    effectEn: card.effectEn,
    effectPt: card.effectPt,
    triggerKeywords: parsed.triggerKeywords,
    effectKeywords: parsed.effectKeywords,
    keywordTags: parsed.keywordTags,
    hasBurst: parsed.hasBurst,
    hasMain: parsed.hasMain,
    hasAction: parsed.hasAction,
    oncePerTurn: parsed.oncePerTurn,
    textSectionsJson: sections,
    legalityStatus: "preview",
  };
  const model = existing
    ? await prisma.cardModel.update({ where: { id: existing.id }, data: fields })
    : await prisma.cardModel.create({ data: { code, ...fields, isActive: false } });

  const setCode = setCodeOf(code);
  let setId: string | null = null;
  if (setCode) {
    const set =
      (await prisma.cardSet.findUnique({ where: { code: setCode }, select: { id: true } })) ??
      (await prisma.cardSet.create({ data: { code: setCode, nameEn: setCode, isActive: false, metadataJson: { autoCreatedBy: "spoilers" } }, select: { id: true } }));
    setId = set.id;
  }
  const print = await prisma.card.findFirst({ where: { cardModelId: model.id, isPrimaryPrint: true }, select: { id: true } });
  const printData = { ...fields, code, cardModelId: model.id, setId, rarity: card.rarity, imageUrl, imageLargeUrl: imageUrl, isPrimaryPrint: true };
  if (print) await prisma.card.update({ where: { id: print.id }, data: printData });
  else await prisma.card.create({ data: { ...printData, isActive: model.isActive } });
  return { cardModelId: model.id, code, official: false };
}

// ---------------------------------------------------------------------------------------------------------
// Captura

export type CaptureDeps = { fetchFn?: FetchFn; extract?: typeof extractSpoilerCard; now?: () => Date };

let lastSeenMessageId: string | null = null;

/** Lê o canal e grava cada imagem nova (com a carta lida pela IA). Devolve quantas entraram e quantas falharam. */
export async function captureNewSpoilers(prisma: PrismaClient, config: SpoilerConfig, deps: CaptureDeps = {}): Promise<{ captured: number; failed: number }> {
  const now = (deps.now ?? (() => new Date()))();
  const fetchFn = deps.fetchFn ?? fetch;
  const extract = deps.extract ?? extractSpoilerCard;
  if (!lastSeenMessageId) {
    const last = await prisma.spoilerCapture.findFirst({ where: { channelId: config.channelId }, orderBy: { postedAt: "desc" }, select: { discordMessageId: true } });
    lastSeenMessageId = last?.discordMessageId ?? null;
  }
  const firstRun = !lastSeenMessageId;
  const messages = await fetchMessagesAfter(config, lastSeenMessageId, fetchFn);
  let captured = 0;
  let failed = 0;
  for (const msg of messages) {
    const postedAt = new Date(msg.timestamp);
    // primeira execução: não volta no histórico inteiro do canal, só nas últimas horas
    const tooOld = firstRun && now.getTime() - postedAt.getTime() > config.backfillHours * 3600_000;
    if (!tooOld) {
      for (const ref of spoilerImagesOf(msg)) {
        if (await prisma.spoilerCapture.findUnique({ where: { sourceKey: ref.sourceKey }, select: { id: true } })) continue;
        const base = { sourceKey: ref.sourceKey, discordMessageId: msg.id, channelId: msg.channel_id, sourceUrl: sourceUrlOf(msg), messageText: msg.content?.slice(0, 4000) || null, postedAt };
        try {
          const image = await saveSpoilerImage(ref.url, `${msg.id}-${ref.sourceKey.split(":")[1]}`, fetchFn);
          const result = await extract({ data: image.buffer, mimeType: image.mimeType }, msg.content);
          if (!result.card) {
            await prisma.spoilerCapture.create({ data: { ...base, imageUrl: image.localUrl, status: "FAILED", error: result.error ?? "Carta não lida." } });
            failed += 1;
            continue;
          }
          const linked = await upsertPreviewCard(prisma, result.card, image.localUrl);
          await prisma.spoilerCapture.create({
            data: { ...base, imageUrl: image.localUrl, status: "CAPTURED", extracted: { ...result.card, provider: result.provider, model: result.model }, cardCode: result.card.code, cardModelId: linked?.cardModelId ?? null },
          });
          captured += 1;
        } catch (err) {
          const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
          console.warn("[spoilers] imagem não capturada:", message);
          await prisma.spoilerCapture.create({ data: { ...base, imageUrl: "", status: "FAILED", error: message } }).catch(() => {});
          failed += 1;
        }
      }
    }
    lastSeenMessageId = msg.id;
  }
  return { captured, failed };
}

/** Só para testes. */
export function resetSpoilerCursor(): void {
  lastSeenMessageId = null;
}

// ---------------------------------------------------------------------------------------------------------
// Artigo do dia (puro)

export type DigestCard = { data: SpoilerCardData; imageUrl: string; inCatalog: boolean; analysis: SpoilerAnalysis; take?: string | null };

const cardRef = (code: string, name: string) => `[[${code}]] ${name}`;
const usageNote = (decks: number) => (decks ? ` — em ${decks} ${decks === 1 ? "lista" : "listas"} recentes` : "");

export function digestTitle(setCode: string | null, count: number, dayLabel: string): string {
  return `Spoilers${setCode ? ` de ${setCode}` : ""}: ${count} ${count === 1 ? "carta revelada" : "cartas reveladas"} em ${dayLabel}`;
}

/** Corpo do artigo em Markdown. As análises vêm só de dado do site; `take` (IA) é o único trecho opinativo. */
export function buildDigestMarkdown(opts: { cards: DigestCard[]; setCode: string | null; intro?: string | null; windowLabel: string; sourceUrls: string[] }): string {
  const { cards, setCode, windowLabel } = opts;
  const lines: string[] = [];
  lines.push(
    opts.intro?.trim() ||
      `A Bandai revelou ${cards.length} ${cards.length === 1 ? "carta nova" : "cartas novas"}${setCode ? ` de ${setCode}` : ""}. Abaixo, cada uma com o texto em português e o que o catálogo e os torneios dizem sobre ela: cartas com os mesmos traits, sinergias, arquétipos em que pode entrar e cartas parecidas que já existem.`,
    "",
  );
  for (const c of cards) {
    const d = c.data;
    const title = d.code ? `${d.nameEn} (${d.code})` : d.nameEn;
    lines.push(`## ${title}`, "");
    if (c.imageUrl) lines.push(`![${d.nameEn}](${c.imageUrl})`, "");
    const stats = [
      `**Tipo:** ${CARD_TYPE_PT[d.cardType] ?? d.cardType}`,
      `**Cor:** ${colorPt(d.color)}`,
      d.level != null || d.cost != null ? `**Nível / custo:** ${d.level ?? "—"} / ${d.cost ?? "—"}` : null,
      d.ap != null || d.hp != null ? `**AP / HP:** ${d.ap ?? "—"} / ${d.hp ?? "—"}` : null,
      d.rarity ? `**Raridade:** ${d.rarity}` : null,
    ].filter(Boolean);
    lines.push(`- ${stats.join(" · ")}`);
    if (d.traits.length) lines.push(`- **Traits:** ${d.traits.join(", ")}`);
    if (d.linkText) lines.push(`- **Link:** ${d.linkText}`);
    lines.push("");
    if (d.effectPt || d.effectEn) {
      lines.push(`**Efeito:** ${(d.effectPt || d.effectEn || "").replace(/\n+/g, " ")}`, "");
      if (d.effectPt && d.effectEn) lines.push(`> ${d.effectEn.replace(/\n+/g, " ")}`, "");
    }
    if (d.translated) lines.push(`*Texto traduzido do japonês pela equipe; pode mudar na versão oficial em inglês.*`, "");
    if (c.take?.trim()) lines.push(`### Primeira leitura`, "", c.take.trim(), "");
    const a = c.analysis;
    if (a.sameTraits.length) {
      lines.push(`### Cartas com os mesmos traits`, "");
      for (const r of a.sameTraits) lines.push(`- ${cardRef(r.card.code, r.card.name)} — ${r.reason}${usageNote(r.decks)}`);
      lines.push("");
    }
    if (a.synergies.length) {
      lines.push(`### Sinergias no catálogo`, "");
      for (const r of a.synergies) lines.push(`- ${cardRef(r.card.code, r.card.name)} — ${r.reason}${usageNote(r.decks)}`);
      lines.push("");
    }
    if (a.archetypes.length) {
      lines.push(`### Arquétipos em que pode entrar`, "");
      for (const f of a.archetypes) {
        const core = f.sharedCoreCards.length ? ` Núcleo com trait em comum: ${f.sharedCoreCards.map((x) => cardRef(x.code, x.name)).join(", ")}.` : "";
        lines.push(`- **${f.archetype.name}** (${f.archetype.colors.map(colorPt).join("/")}) — ${Math.round(f.archetype.share * 100)}% das listas nos ${windowLabel}; ${f.reason}.${core}`);
      }
      lines.push("");
    }
    if (a.similar.length) {
      lines.push(`### Cartas parecidas já lançadas`, "", `Mesmo tipo, cor e custo:`, "");
      for (const s of a.similar) lines.push(`- ${cardRef(s.card.code, s.card.name)} — ${s.diff}${usageNote(s.decks)}`);
      lines.push("");
    }
    if (!a.sameTraits.length && !a.synergies.length && !a.archetypes.length && !a.similar.length) {
      lines.push(`*Ainda não há carta lançada com trait, sinergia ou números parecidos com esta no catálogo.*`, "");
    }
  }
  lines.push(`---`, "");
  lines.push(
    `As cartas foram reveladas pela Bandai nas apresentações oficiais e chegaram até nós pelos canais de spoilers da comunidade${opts.sourceUrls.length ? ` ([fonte](${opts.sourceUrls[0]}))` : ""}. Elas entram no catálogo do Anaheim Hub como **prévia**: os textos podem mudar até a lista oficial em inglês, e nós atualizamos quando ela sair. Números de torneio: ${windowLabel}.`,
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------------------------------------
// Resumo do dia (artigo + post)

const brDay = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(d);
const brIsoDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

async function uniqueSlug(prisma: PrismaClient, base: string): Promise<string> {
  for (let i = 0; i < 50; i += 1) {
    const slug = i ? `${base}-${i + 1}` : base;
    if (!(await prisma.post.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return `${base}-${Date.now()}`;
}

/** "Primeira leitura" de cada carta e a abertura do artigo, pela IA, presa aos dados. `null` se nenhuma IA responder. */
async function writeTakes(cards: DigestCard[], setCode: string | null): Promise<{ intro: string | null; takes: Map<string, string> } | null> {
  const facts = cards.map((c) => ({
    ref: c.data.code || c.data.nameEn,
    nome: c.data.nameEn,
    tipo: CARD_TYPE_PT[c.data.cardType],
    cor: colorPt(c.data.color),
    nivel: c.data.level,
    custo: c.data.cost,
    ap: c.data.ap,
    hp: c.data.hp,
    traits: c.data.traits,
    link: c.data.linkText,
    efeito: c.data.effectPt || c.data.effectEn,
    mesmosTraits: c.analysis.sameTraits.map((r) => r.card.name),
    sinergias: c.analysis.synergies.map((r) => `${r.card.name}: ${r.reason}`),
    arquetipos: c.analysis.archetypes.map((f) => `${f.archetype.name} (${Math.round(f.archetype.share * 100)}% das listas)`),
    parecidas: c.analysis.similar.map((s) => `${s.card.name}: ${s.diff}`),
  }));
  const prompt = `Você escreve para o Anaheim Hub, portal brasileiro de fãs do Gundam Card Game (não oficial).
Saíram spoilers${setCode ? ` de ${setCode}` : ""}. Com SOMENTE os dados abaixo, escreva:
- "intro": 2 a 3 frases abrindo o artigo do dia (quantas cartas, destaques).
- "takes": para cada carta, 2 a 4 frases de primeira leitura: o que o efeito faz na prática, com quais cartas e arquétipos listados ela conversa e em que situação brilha.
Regras: português do Brasil; não traduza nomes de cartas, personagens nem palavras-chave (Blocker, Breach, Deploy...); não invente números, cartas, resultados nem previsão de metagame; não fale em nome da Bandai.
Dados: ${JSON.stringify(facts)}
Responda APENAS com JSON: {"intro": "...", "takes": [{"ref": "<ref da carta>", "text": "..."}]}`;
  try {
    const { generateJsonWithAi } = await import("./spoilerAi.ts");
    const json = (await generateJsonWithAi(prompt)) as { intro?: unknown; takes?: Array<{ ref?: unknown; text?: unknown }> } | null;
    if (!json) return null;
    const takes = new Map<string, string>();
    for (const t of json.takes ?? []) if (typeof t.ref === "string" && typeof t.text === "string" && t.text.trim()) takes.set(t.ref, t.text.trim().slice(0, 900));
    return { intro: typeof json.intro === "string" ? json.intro.trim().slice(0, 600) : null, takes };
  } catch (err) {
    console.warn("[spoilers] texto da IA falhou, artigo sai só com os dados:", err instanceof Error ? err.message : err);
    return null;
  }
}

export type DigestDeps = { now?: () => Date; context?: SpoilerAnalysisContext; createPost?: (prisma: PrismaClient, digestId: string) => Promise<{ id: string }>; writeTakes?: typeof writeTakes };

/**
 * Junta os spoilers capturados num resumo, quando o canal ficou `quietMinutes` sem novidade. Cria o artigo
 * (rascunho em revisão) e o post do Instagram (aguardando aprovação). `null` = nada a fazer agora.
 */
export async function buildSpoilerDigest(prisma: PrismaClient, quietMinutes: number, deps: DigestDeps = {}) {
  const now = (deps.now ?? (() => new Date()))();
  const pending = await prisma.spoilerCapture.findMany({ where: { status: "CAPTURED", digestId: null }, orderBy: { postedAt: "asc" } });
  if (!pending.length) return null;
  const newest = pending[pending.length - 1].postedAt;
  if (now.getTime() - newest.getTime() < quietMinutes * 60_000) return null;

  const context = deps.context ?? (await loadSpoilerAnalysisContext(prisma, now));
  const seen = new Set<string>();
  const cards: DigestCard[] = [];
  for (const capture of pending) {
    const data = normalizeSpoilerCard({ isCard: true, ...(capture.extracted as Record<string, unknown>) });
    if (!data) continue;
    const key = data.code || data.nameEn.toLowerCase();
    if (seen.has(key)) continue; // mesma carta postada duas vezes
    seen.add(key);
    cards.push({ data, imageUrl: capture.imageUrl, inCatalog: Boolean(capture.cardModelId), analysis: analyzeSpoiler(data, context) });
  }
  const setCodes = [...new Set(cards.map((c) => setCodeOf(c.data.code)).filter(Boolean))] as string[];
  const setCode = setCodes.length === 1 ? setCodes[0] : null;
  const ai = cards.length ? await (deps.writeTakes ?? writeTakes)(cards, setCode) : null;
  for (const c of cards) c.take = ai?.takes.get(c.data.code || c.data.nameEn) ?? null;

  const author =
    (process.env.SPOILER_AUTHOR_USERNAME
      ? await prisma.user.findFirst({ where: { username: process.env.SPOILER_AUTHOR_USERNAME, role: { in: [UserRole.ADMIN, UserRole.EDITOR] } }, select: { id: true } })
      : null) ??
    (await prisma.user.findFirst({ where: { role: UserRole.ADMIN }, orderBy: { createdAt: "asc" }, select: { id: true } }));
  if (!author) throw new Error("Nenhum usuário ADMIN para assinar o artigo de spoilers.");

  const title = digestTitle(setCode, cards.length, brDay(newest));
  const slug = await uniqueSlug(prisma, `spoilers-${(setCode || "gcg").toLowerCase()}-${brIsoDay(newest)}`);
  const sourceUrls = [...new Set(pending.map((p) => p.sourceUrl).filter((u): u is string => !!u))];
  const contentMd = cards.length ? buildDigestMarkdown({ cards, setCode, intro: ai?.intro, windowLabel: context.windowLabel, sourceUrls }) : "";

  return prisma.$transaction(async (tx) => {
    const digest = await tx.spoilerDigest.create({ data: { setCode } });
    let articleId: string | null = null;
    if (cards.length) {
      const article = await tx.post.create({
        data: {
          authorId: author.id,
          title,
          slug,
          excerpt: `${cards.length} ${cards.length === 1 ? "carta nova" : "cartas novas"}${setCode ? ` de ${setCode}` : ""} com texto em português, sinergias, arquétipos e cartas parecidas.`,
          contentMd,
          coverImage: cards[0]?.imageUrl || null,
          tags: ["spoiler", ...(setCode ? [setCode.toLowerCase()] : [])],
          postType: PostType.PREVIEW,
          status: PostStatus.REVIEW,
        },
      });
      articleId = article.id;
    }
    await tx.spoilerCapture.updateMany({ where: { id: { in: pending.map((p) => p.id) } }, data: { status: "DIGESTED", digestId: digest.id } });
    return tx.spoilerDigest.update({ where: { id: digest.id }, data: { articleId } });
  }).then(async (digest) => {
    if (!digest.articleId) return digest;
    const post = await (deps.createPost ?? ((p, id) => import("./socialPublisherService.ts").then((m) => m.createSocialPostDraft(p, { type: SocialPostType.SPOILER_DIGEST, spoilerDigestId: id }))))(prisma, digest.id);
    return prisma.spoilerDigest.update({ where: { id: digest.id }, data: { socialPostId: post.id } });
  });
}

// ---------------------------------------------------------------------------------------------------------
// Aprovação

/** ✅ no post do resumo: ativa as cartas prévia (e a coleção criada por elas) e publica o artigo. Idempotente. */
export async function publishSpoilerDigestSite(prisma: PrismaClient, post: Pick<SocialMediaPost, "id" | "metadata">): Promise<void> {
  const digestId = spoilerDigestIdOf(post);
  if (!digestId) return;
  const digest = await prisma.spoilerDigest.findUnique({ where: { id: digestId }, include: { captures: { select: { cardModelId: true } } } });
  if (!digest || digest.status === "PUBLISHED") return;
  const modelIds = [...new Set(digest.captures.map((c) => c.cardModelId).filter((id): id is string => !!id))];
  const previewModels = await prisma.cardModel.findMany({ where: { id: { in: modelIds }, legalityStatus: "preview" }, select: { id: true } });
  const ids = previewModels.map((m) => m.id);
  const now = new Date();
  await prisma.$transaction([
    prisma.cardModel.updateMany({ where: { id: { in: ids } }, data: { isActive: true, deletedAt: null } }),
    prisma.card.updateMany({ where: { cardModelId: { in: ids } }, data: { isActive: true, deletedAt: null } }),
    ...(digest.articleId ? [prisma.post.updateMany({ where: { id: digest.articleId, status: { not: PostStatus.PUBLISHED } }, data: { status: PostStatus.PUBLISHED, publishedAt: now } })] : []),
    prisma.spoilerDigest.update({ where: { id: digest.id }, data: { status: "PUBLISHED", publishedAt: now } }),
  ]);
  // coleção criada automaticamente pelos spoilers aparece junto com as cartas
  const sets = await prisma.card.findMany({ where: { cardModelId: { in: ids }, setId: { not: null } }, select: { setId: true }, distinct: ["setId"] });
  for (const { setId } of sets) {
    const set = await prisma.cardSet.findUnique({ where: { id: setId! }, select: { isActive: true, metadataJson: true } });
    const auto = (set?.metadataJson as { autoCreatedBy?: string } | null)?.autoCreatedBy === "spoilers";
    if (set && !set.isActive && auto) await prisma.cardSet.update({ where: { id: setId! }, data: { isActive: true } });
  }
}

/** ❌ no post do resumo: marca o resumo como descartado (artigo e cartas ficam como rascunho). */
export async function rejectSpoilerDigest(prisma: PrismaClient, post: Pick<SocialMediaPost, "metadata">): Promise<void> {
  const digestId = spoilerDigestIdOf(post);
  if (digestId) await prisma.spoilerDigest.updateMany({ where: { id: digestId, status: "PENDING_APPROVAL" }, data: { status: "REJECTED" } });
}

export function spoilerDigestIdOf(post: Pick<SocialMediaPost, "metadata">): string | null {
  try {
    const id = (JSON.parse(post.metadata || "{}") as { spoilerDigestId?: unknown }).spoilerDigestId;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Vigia

let watching = false;
let ticking = false;

/** Um ciclo: captura e, se o canal ficou quieto, monta o resumo. */
export async function runSpoilerTick(prisma: PrismaClient, config: SpoilerConfig, deps: CaptureDeps & DigestDeps = {}) {
  if (ticking) return null;
  ticking = true;
  try {
    const capture = await captureNewSpoilers(prisma, config, deps);
    if (capture.captured || capture.failed) console.log(`[spoilers] ${capture.captured} spoiler(s) capturado(s), ${capture.failed} com falha`);
    const digest = await buildSpoilerDigest(prisma, config.quietMinutes, deps);
    if (digest) console.log(`[spoilers] resumo ${digest.id} criado (artigo ${digest.articleId ?? "—"})`);
    return { capture, digest };
  } finally {
    ticking = false;
  }
}

export function startSpoilerWatcher(prisma: PrismaClient): boolean {
  const config = readSpoilerConfig();
  if (!config || watching) return false;
  watching = true;
  const tick = () => void runSpoilerTick(prisma, config).catch((err) => console.error("[spoilers] ciclo falhou:", err instanceof Error ? err.message : err));
  tick();
  setInterval(tick, POLL_MS).unref();
  console.log(`[spoilers] vigiando o canal ${config.channelId} a cada ${POLL_MS / 60_000} min`);
  return true;
}
