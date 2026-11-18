/* Cargos do Discord a partir da conta do site: quem conecta o Discord no perfil recebe o cargo da patente de apoiador
 * (Comandante, Ás, Piloto, Recruta) e das tags que tiverem cargo com o mesmo nome (Juiz, Organizador, Criador de
 * conteúdo…). Para contas conectadas o site manda: revogar o apoio ou trocar a patente tira o cargo antigo.
 * Quem não conectou não é tocado, e cargos fora desse catálogo (Moderador, regiões) nunca são mexidos.
 *
 * Sincroniza ao conectar, quando o admin muda patente/tags, e de hora em hora (pega quem conectou antes de entrar
 * no servidor). O cargo do bot precisa ficar ACIMA desses cargos na lista do servidor. */
import type { PrismaClient } from "@prisma/client";
import { SUPPORTER_TIERS, USER_TAGS } from "../../src/lib/supporters.ts";
import { DiscordApiError, normalizeDiscordName, sharedDiscordGuild, type DiscordGuild, type GuildRole } from "./discordGuild.ts";

const SYNC_INTERVAL_MS = 60 * 60_000;
/** pausa entre contas na sincronização completa (folga no limite da API do Discord) */
const SYNC_PAUSE_MS = 400;

/** Nome do cargo → chave do catálogo. "Criador de conteúdo" também casa com "Criador". */
function catalogNames(): Map<string, string> {
  const names = new Map<string, string>();
  for (const t of SUPPORTER_TIERS) names.set(normalizeDiscordName(t.label), `tier:${t.key}`);
  for (const t of USER_TAGS) {
    names.set(normalizeDiscordName(t.label), `tag:${t.key}`);
    names.set(normalizeDiscordName(t.label.split(" ")[0]), `tag:${t.key}`);
  }
  return names;
}

/** Cargos do servidor que o site administra (por chave do catálogo). Cargo de integração (de outro bot) fica de fora. */
export function managedRoles(roles: GuildRole[]): Map<string, GuildRole> {
  const names = catalogNames();
  const byKey = new Map<string, GuildRole>();
  for (const role of roles) {
    if (role.managed) continue;
    const key = names.get(normalizeDiscordName(role.name));
    if (key && !byKey.has(key)) byKey.set(key, role);
  }
  return byKey;
}

export type RoleSource = { isSupporter: boolean; supporterTier: string | null; tags: { tag: string }[] };

export function desiredKeys(user: RoleSource | null): Set<string> {
  const keys = new Set<string>();
  if (!user) return keys;
  if (user.isSupporter && user.supporterTier) keys.add(`tier:${user.supporterTier}`);
  for (const t of user.tags) keys.add(`tag:${t.tag}`);
  return keys;
}

/** O que mudar nos cargos do membro: entra o que falta, sai o administrado que não vale mais. */
export function planRoleChanges(current: string[], managed: Map<string, GuildRole>, wanted: Set<string>) {
  const have = new Set(current);
  const add: GuildRole[] = [];
  const remove: GuildRole[] = [];
  for (const [key, role] of managed) {
    if (wanted.has(key) && !have.has(role.id)) add.push(role);
    if (!wanted.has(key) && have.has(role.id)) remove.push(role);
  }
  return { add, remove };
}

export type RoleSyncResult = { status: "ok" | "not-in-guild" | "off"; added: string[]; removed: string[] };

/** Acerta os cargos de um membro. `user` null = conta desconectada: tira todos os cargos administrados. */
export async function syncMemberRoles(guild: DiscordGuild, discordId: string, user: RoleSource | null): Promise<RoleSyncResult> {
  const current = await guild.memberRoles(discordId);
  if (!current) return { status: "not-in-guild", added: [], removed: [] };
  const { add, remove } = planRoleChanges(current, managedRoles(await guild.roles()), desiredKeys(user));
  for (const role of add) await guild.addRole(discordId, role.id);
  for (const role of remove) await guild.removeRole(discordId, role.id);
  return { status: "ok", added: add.map((r) => r.name), removed: remove.map((r) => r.name) };
}

const ROLE_SELECT = { discordId: true, isSupporter: true, supporterTier: true, tags: { select: { tag: true } } } as const;

/** Sincroniza a conta do site (se tiver Discord conectado). Erro do Discord vira log; nunca derruba a ação do admin. */
export async function syncUserDiscordRoles(prisma: PrismaClient, userId: string, guild: DiscordGuild | null = sharedDiscordGuild()): Promise<RoleSyncResult> {
  if (!guild) return { status: "off", added: [], removed: [] };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: ROLE_SELECT });
  if (!user?.discordId) return { status: "off", added: [], removed: [] };
  return syncMemberRoles(guild, user.discordId, user);
}

export function queueUserDiscordRoleSync(prisma: PrismaClient, userId: string) {
  void syncUserDiscordRoles(prisma, userId).catch((err) => console.warn("[discord] cargos não sincronizados:", describeRoleError(err)));
}

export function describeRoleError(err: unknown): string {
  if (err instanceof DiscordApiError && err.status === 403) return "o bot não pode mexer nesses cargos (o cargo dele precisa ficar acima de Comandante/Ás/Piloto/Recruta)";
  return err instanceof Error ? err.message : String(err);
}

/** Todas as contas conectadas, uma de cada vez. */
export async function syncAllDiscordRoles(prisma: PrismaClient, guild: DiscordGuild | null = sharedDiscordGuild(), pauseMs = SYNC_PAUSE_MS) {
  if (!guild) return { checked: 0, changed: 0, notInGuild: 0, failed: 0 };
  const users = await prisma.user.findMany({ where: { discordId: { not: null }, isActive: true }, select: ROLE_SELECT });
  const summary = { checked: 0, changed: 0, notInGuild: 0, failed: 0 };
  for (const user of users) {
    summary.checked += 1;
    try {
      const result = await syncMemberRoles(guild, user.discordId!, user);
      if (result.status === "not-in-guild") summary.notInGuild += 1;
      if (result.added.length || result.removed.length) summary.changed += 1;
    } catch (err) {
      summary.failed += 1;
      console.warn("[discord] cargos de uma conta não sincronizados:", describeRoleError(err));
    }
    if (pauseMs) await new Promise((resolve) => setTimeout(resolve, pauseMs));
  }
  return summary;
}

/** Na subida da API: registra o /carta no servidor e agenda a sincronização de cargos de hora em hora. */
export function startDiscordServerTasks(prisma: PrismaClient, env: NodeJS.ProcessEnv = process.env) {
  const guild = sharedDiscordGuild(env);
  const appId = (env.DISCORD_APP_ID || "").trim();
  if (!guild || !/^\d{5,25}$/.test(appId)) return;
  if (env.DISCORD_COMMANDS_ENABLED !== "false") {
    void import("./discordCardCommand.ts")
      .then(({ CARD_COMMAND }) => guild.registerCommands(appId, [CARD_COMMAND]))
      .then(() => console.log("[discord] comando /carta registrado no servidor"))
      .catch((err) => console.warn("[discord] não deu para registrar o /carta:", err instanceof Error ? err.message : err));
  }
  const run = () =>
    void syncAllDiscordRoles(prisma, guild)
      .then((s) => s.changed && console.log(`[discord] cargos: ${s.changed} conta(s) acertada(s) de ${s.checked}`))
      .catch((err) => console.warn("[discord] sincronização de cargos falhou:", describeRoleError(err)));
  setTimeout(run, 60_000).unref();
  setInterval(run, SYNC_INTERVAL_MS).unref();
}
