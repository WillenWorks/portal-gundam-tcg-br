/* Servidor do Discord do Anaheim Hub visto pelo bot: canais e cargos achados PELO NOME, para o admin não ter que
 * copiar IDs. O servidor é o do canal de aprovação (DISCORD_CHANNEL_ID); DISCORD_GUILD_ID e os
 * DISCORD_*_CHANNEL_ID abaixo só servem para fixar um ID quando o nome mudar.
 *
 * Canais procurados (nome sem acento e sem emoji): "spoilers", "anuncios", "torneios".
 * Cargos: os nomes das patentes e das tags (src/lib/supporters.ts) — "Comandante 👑" casa com "Comandante".
 * Tudo pela API REST com o token do bot; nada de gateway (o bot não fica "online"). */

const DISCORD_API = "https://discord.com/api/v10";
const SNOWFLAKE = /^\d{5,25}$/;
/** canal de texto comum e canal de anúncios (o de anúncios aceita "publicar" para quem segue) */
const TEXT_CHANNEL = 0;
const ANNOUNCEMENT_CHANNEL = 5;
const CACHE_MS = 10 * 60_000;

export type DiscordChannelKind = "spoilers" | "announcements" | "tournaments";

const CHANNEL_NAMES: Record<DiscordChannelKind, string[]> = {
  spoilers: ["spoilers"],
  announcements: ["anuncios", "avisos", "novidades"],
  tournaments: ["torneios", "eventos"],
};

const CHANNEL_ENV: Record<DiscordChannelKind, string> = {
  spoilers: "DISCORD_SPOILERS_CHANNEL_ID",
  announcements: "DISCORD_ANNOUNCEMENTS_CHANNEL_ID",
  tournaments: "DISCORD_TOURNAMENTS_CHANNEL_ID",
};

export type DiscordGuildConfig = {
  botToken: string;
  /** canal de aprovação: é dele que sai o servidor quando DISCORD_GUILD_ID não está no .env */
  staffChannelId: string;
  guildId?: string;
  channelOverrides: Partial<Record<DiscordChannelKind, string>>;
};

export function readDiscordGuildConfig(env: NodeJS.ProcessEnv = process.env): DiscordGuildConfig | null {
  const botToken = (env.DISCORD_BOT_TOKEN || "").trim();
  const staffChannelId = (env.DISCORD_CHANNEL_ID || "").trim();
  const guildId = (env.DISCORD_GUILD_ID || "").trim();
  if (!botToken || (!SNOWFLAKE.test(staffChannelId) && !SNOWFLAKE.test(guildId))) return null;
  const channelOverrides: Partial<Record<DiscordChannelKind, string>> = {};
  for (const kind of Object.keys(CHANNEL_ENV) as DiscordChannelKind[]) {
    const id = (env[CHANNEL_ENV[kind]] || "").trim();
    if (SNOWFLAKE.test(id)) channelOverrides[kind] = id;
  }
  return { botToken, staffChannelId, guildId: SNOWFLAKE.test(guildId) ? guildId : undefined, channelOverrides };
}

/** "📢・Anúncios" → "anuncios"; "Criador de Conteúdo" → "criador de conteudo"; "Ás ⭐" → "as". */
export function normalizeDiscordName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type GuildChannel = { id: string; name: string; type: number };
export type GuildRole = { id: string; name: string; position: number; managed?: boolean };

type FetchFn = typeof fetch;

export class DiscordApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Acha o canal de cada tipo pelo nome; com mais de um, o de anúncios (publicável) e depois o primeiro. */
export function pickChannel(channels: GuildChannel[], kind: DiscordChannelKind): GuildChannel | null {
  const wanted = CHANNEL_NAMES[kind];
  const matches = channels.filter((c) => (c.type === TEXT_CHANNEL || c.type === ANNOUNCEMENT_CHANNEL) && wanted.includes(normalizeDiscordName(c.name)));
  return matches.find((c) => c.type === ANNOUNCEMENT_CHANNEL) ?? matches[0] ?? null;
}

export function createDiscordGuild(config: DiscordGuildConfig, fetchFn: FetchFn = fetch, now: () => number = Date.now) {
  let guildId: string | null = config.guildId ?? null;
  let channelsCache: { at: number; list: GuildChannel[] } | null = null;
  let rolesCache: { at: number; list: GuildRole[] } | null = null;

  async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetchFn(`${DISCORD_API}${path}`, {
      method,
      headers: { Authorization: `Bot ${config.botToken}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }), "X-Audit-Log-Reason": "Anaheim Hub" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new DiscordApiError(`Discord respondeu ${res.status} em ${method} ${path.replace(/\d{5,25}/g, ":id")}`, res.status);
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  async function getGuildId(): Promise<string> {
    if (guildId) return guildId;
    const channel = await api<{ guild_id?: string }>("GET", `/channels/${config.staffChannelId}`);
    if (!channel.guild_id) throw new DiscordApiError("O canal de aprovação não está num servidor.", 400);
    guildId = channel.guild_id;
    return guildId;
  }

  async function channels(): Promise<GuildChannel[]> {
    if (channelsCache && now() - channelsCache.at < CACHE_MS) return channelsCache.list;
    const list = await api<GuildChannel[]>("GET", `/guilds/${await getGuildId()}/channels`);
    channelsCache = { at: now(), list };
    return list;
  }

  async function roles(): Promise<GuildRole[]> {
    if (rolesCache && now() - rolesCache.at < CACHE_MS) return rolesCache.list;
    const list = await api<GuildRole[]>("GET", `/guilds/${await getGuildId()}/roles`);
    rolesCache = { at: now(), list };
    return list;
  }

  async function channelFor(kind: DiscordChannelKind): Promise<GuildChannel | null> {
    const override = config.channelOverrides[kind];
    const list = await channels();
    if (override) return list.find((c) => c.id === override) ?? { id: override, name: kind, type: TEXT_CHANNEL };
    return pickChannel(list, kind);
  }

  /** Posta no canal do tipo; em canal de anúncios também publica para os servidores que seguem. `null` = canal não existe. */
  async function post(kind: DiscordChannelKind, payload: object): Promise<{ channelId: string; messageId: string } | null> {
    const channel = await channelFor(kind);
    if (!channel) return null;
    const message = await api<{ id: string }>("POST", `/channels/${channel.id}/messages`, { allowed_mentions: { parse: [] }, ...payload });
    if (channel.type === ANNOUNCEMENT_CHANNEL) {
      await api("POST", `/channels/${channel.id}/messages/${message.id}/crosspost`).catch((err) =>
        console.warn("[discord] não deu para publicar o anúncio para quem segue:", err instanceof Error ? err.message : err),
      );
    }
    return { channelId: channel.id, messageId: message.id };
  }

  /** Cargos do membro; `null` se a pessoa não está no servidor. */
  async function memberRoles(userId: string): Promise<string[] | null> {
    try {
      const member = await api<{ roles: string[] }>("GET", `/guilds/${await getGuildId()}/members/${userId}`);
      return member.roles;
    } catch (err) {
      if (err instanceof DiscordApiError && err.status === 404) return null;
      throw err;
    }
  }

  async function addRole(userId: string, roleId: string) {
    await api("PUT", `/guilds/${await getGuildId()}/members/${userId}/roles/${roleId}`);
  }

  async function removeRole(userId: string, roleId: string) {
    await api("DELETE", `/guilds/${await getGuildId()}/members/${userId}/roles/${roleId}`);
  }

  /** Comandos de barra só deste servidor (aparecem na hora; os globais demoram até 1 h). */
  async function registerCommands(appId: string, commands: object[]) {
    await api("PUT", `/applications/${appId}/guilds/${await getGuildId()}/commands`, commands);
  }

  async function botMember(appId: string): Promise<string[] | null> {
    return memberRoles(appId);
  }

  return { getGuildId, channels, roles, channelFor, post, memberRoles, addRole, removeRole, registerCommands, botMember };
}

export type DiscordGuild = ReturnType<typeof createDiscordGuild>;

let shared: { key: string; guild: DiscordGuild } | null = null;

/** Instância única (com o cache de canais/cargos) para a configuração atual do .env; `null` sem bot. */
export function sharedDiscordGuild(env: NodeJS.ProcessEnv = process.env): DiscordGuild | null {
  const config = readDiscordGuildConfig(env);
  if (!config) return null;
  const key = JSON.stringify(config);
  if (!shared || shared.key !== key) shared = { key, guild: createDiscordGuild(config) };
  return shared.guild;
}

/** Domínio público para os links (o PUBLIC_APP_URL local da VPS não serve a ninguém de fora). */
export function discordPublicUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = (env.PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  return url && /^https:\/\//.test(url) && !/localhost|127\.0\.0\.1/.test(url) ? url : "https://anaheimhub.com";
}

/** Caminho do próprio site → endereço completo; externo https fica como está; o resto some. */
export function absoluteHttpsUrl(url: string | null | undefined, base: string): string | undefined {
  const value = (url || "").trim();
  if (/^https:\/\/[^\s"'<>]+$/.test(value)) return value;
  if (/^\/(?!\/)[^\s"'<>]*$/.test(value)) return `${base}${value}`;
  return undefined;
}
