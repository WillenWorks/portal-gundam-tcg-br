/* Comando /carta do Discord: `/carta nome:Gelgoog` responde com a imagem, o efeito em português e o link da carta.
 * O campo tem autocomplete (o Discord pergunta a cada letra digitada) e o valor escolhido é o código da carta.
 * Registrado só no servidor do Anaheim Hub (registerDiscordCommands, na subida da API). */
import type { Prisma, PrismaClient } from "@prisma/client";
import { resolveGameColorHex, resolveGameColorLabelPt } from "../../src/lib/gundam-catalog.ts";
import { absoluteHttpsUrl } from "./discordGuild.ts";

export const CARD_COMMAND_NAME = "carta";

export const CARD_COMMAND = {
  name: CARD_COMMAND_NAME,
  type: 1,
  description: "Mostra uma carta do Gundam Card Game com o efeito em português",
  description_localizations: { "en-US": "Shows a Gundam Card Game card", "en-GB": "Shows a Gundam Card Game card" },
  options: [{ type: 3, name: "nome", description: "Nome ou código da carta (ex.: Gelgoog ou GD01-001)", required: true, autocomplete: true, max_length: 80 }],
};

const CARD_TYPE_PT: Record<string, string> = {
  UNIT: "Unidade",
  PILOT: "Piloto",
  COMMAND: "Comando",
  COMMAND_PILOT: "Comando · Piloto",
  BASE: "Base",
  RESOURCE: "Recurso",
  EX_BASE: "EX Base",
  EX_RESOURCE: "EX Recurso",
  UNIT_TOKEN: "Token de unidade",
};

const CODE = /^[A-Z]{1,4}\d{0,2}-?\d{2,4}[A-Z]?$/;

export type CardSearchRow = { code: string; nameEn: string; namePt: string | null };

/** Ordem: código exato, nome que começa com o texto, nome que contém. Só cartas ativas (prévias aprovadas incluídas). */
export function rankCardMatches(rows: CardSearchRow[], query: string, limit = 25): CardSearchRow[] {
  const q = query.trim().toLowerCase();
  const score = (r: CardSearchRow) => {
    const names = [r.namePt, r.nameEn].filter(Boolean).map((n) => n!.toLowerCase());
    if (r.code.toLowerCase() === q) return 0;
    if (names.some((n) => n === q)) return 1;
    if (names.some((n) => n.startsWith(q))) return 2;
    if (r.code.toLowerCase().startsWith(q)) return 3;
    return 4;
  };
  return [...rows].sort((a, b) => score(a) - score(b) || a.code.localeCompare(b.code)).slice(0, limit);
}

export async function searchCards(prisma: PrismaClient, query: string, limit = 25): Promise<CardSearchRow[]> {
  const q = query.trim().slice(0, 80);
  if (!q) return [];
  const where: Prisma.CardModelWhereInput = {
    isActive: true,
    deletedAt: null,
    OR: [{ code: { contains: q, mode: "insensitive" } }, { nameEn: { contains: q, mode: "insensitive" } }, { namePt: { contains: q, mode: "insensitive" } }],
  };
  const rows = await prisma.cardModel.findMany({ where, select: { code: true, nameEn: true, namePt: true }, take: 60, orderBy: { code: "asc" } });
  return rankCardMatches(rows, q, limit);
}

/** Opção do autocomplete: até 100 caracteres no nome, valor = código. */
export function autocompleteChoices(rows: CardSearchRow[]) {
  return rows.map((r) => {
    const name = r.namePt && r.namePt !== r.nameEn ? `${r.namePt} / ${r.nameEn}` : r.nameEn;
    const label = `${name} (${r.code})`;
    return { name: label.length > 100 ? `${label.slice(0, 99)}…` : label, value: r.code };
  });
}

type CardForEmbed = {
  code: string;
  nameEn: string;
  namePt: string | null;
  cardType: string;
  color: string | null;
  level: number | null;
  cost: number | null;
  ap: number | null;
  hp: number | null;
  traits: string[];
  trait: string | null;
  linkText: string | null;
  effectPt: string | null;
  effectEn: string | null;
  legalityStatus: string | null;
  image?: string | null;
};

const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export function cardEmbed(card: CardForEmbed, publicUrl: string) {
  const name = card.namePt || card.nameEn;
  const stats = [
    card.level !== null ? `Nível ${card.level}` : "",
    card.cost !== null ? `Custo ${card.cost}` : "",
    card.ap !== null ? `AP ${card.ap}` : "",
    card.hp !== null ? `HP ${card.hp}` : "",
  ].filter(Boolean);
  const traits = card.traits.length ? card.traits.join(", ") : card.trait || "";
  const effect = (card.effectPt || card.effectEn || "").trim();
  const fields = [
    { name: "Tipo", value: CARD_TYPE_PT[card.cardType] ?? card.cardType, inline: true },
    card.color ? { name: "Cor", value: resolveGameColorLabelPt(card.color) || card.color, inline: true } : null,
    stats.length ? { name: "Atributos", value: stats.join(" · "), inline: true } : null,
    traits ? { name: "Traits", value: cut(traits, 200), inline: false } : null,
    card.linkText ? { name: "Link", value: cut(card.linkText, 200), inline: false } : null,
  ].filter(Boolean);
  const image = absoluteHttpsUrl(card.image, publicUrl);
  return {
    title: cut(`${name} · ${card.code}`, 250),
    url: `${publicUrl}/cards/${encodeURIComponent(card.code)}`,
    description: effect ? cut(effect, 1500) : "Sem efeito.",
    color: parseInt(resolveGameColorHex(card.color, "#22d3ee").slice(1), 16),
    fields,
    ...(image ? { image: { url: image } } : {}),
    footer: { text: card.legalityStatus === "preview" ? "Prévia (spoiler) · anaheimhub.com" : card.namePt && card.namePt !== card.nameEn ? `${card.nameEn} · anaheimhub.com` : "anaheimhub.com" },
  };
}

/** Carta pelo código escolhido no autocomplete; se a pessoa digitou e não escolheu, a melhor correspondência. */
export async function findCardForCommand(prisma: PrismaClient, value: string) {
  const raw = value.trim();
  if (!raw) return null;
  const code = raw.toUpperCase();
  const select = {
    code: true, nameEn: true, namePt: true, cardType: true, color: true, level: true, cost: true, ap: true, hp: true, traits: true, trait: true,
    linkText: true, effectPt: true, effectEn: true, legalityStatus: true,
    prints: { where: { isActive: true }, orderBy: [{ isPrimaryPrint: "desc" as const }, { createdAt: "asc" as const }], take: 1, select: { imageLargeUrl: true, imageMediumUrl: true, imageUrl: true } },
  } satisfies Prisma.CardModelSelect;
  let model = CODE.test(code) ? await prisma.cardModel.findFirst({ where: { code, isActive: true, deletedAt: null }, select }) : null;
  if (!model) {
    const [best] = await searchCards(prisma, raw, 1);
    if (best) model = await prisma.cardModel.findFirst({ where: { code: best.code, isActive: true, deletedAt: null }, select });
  }
  if (!model) return null;
  const print = model.prints[0];
  return { ...model, image: print?.imageLargeUrl || print?.imageMediumUrl || print?.imageUrl || null };
}

type CommandInteraction = {
  type: number;
  data?: { name?: string; options?: { name: string; value?: unknown; focused?: boolean }[] };
};

const APPLICATION_COMMAND = 2;
const AUTOCOMPLETE = 4;
const REPLY = 4;
const AUTOCOMPLETE_RESULT = 8;
const EPHEMERAL = 64;

/** Resposta do Discord para o /carta (comando ou autocomplete); `null` = não é este comando. */
export async function handleCardCommand(prisma: PrismaClient, interaction: CommandInteraction, publicUrl: string): Promise<object | null> {
  if (interaction.data?.name !== CARD_COMMAND_NAME) return null;
  const option = interaction.data.options?.find((o) => o.name === "nome");
  const value = typeof option?.value === "string" ? option.value : "";
  if (interaction.type === AUTOCOMPLETE) {
    return { type: AUTOCOMPLETE_RESULT, data: { choices: autocompleteChoices(await searchCards(prisma, value)) } };
  }
  if (interaction.type !== APPLICATION_COMMAND) return null;
  const card = await findCardForCommand(prisma, value);
  if (!card) {
    return { type: REPLY, data: { flags: EPHEMERAL, content: `Não achei nenhuma carta com "${value.slice(0, 80)}". Procure no catálogo: ${publicUrl}/database?q=${encodeURIComponent(value.slice(0, 80))}` } };
  }
  return { type: REPLY, data: { embeds: [cardEmbed(card, publicUrl)], allowed_mentions: { parse: [] } } };
}
