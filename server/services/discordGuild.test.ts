import { describe, expect, it, vi } from "vitest";
import { absoluteHttpsUrl, createDiscordGuild, discordPublicUrl, normalizeDiscordName, pickChannel, readDiscordGuildConfig } from "./discordGuild";

const env = { DISCORD_BOT_TOKEN: "tok", DISCORD_CHANNEL_ID: "1563339185967075389" };

/** fetch falso: responde por "MÉTODO caminho" e guarda as chamadas. */
function fakeFetch(routes: Record<string, unknown>) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.replace("https://discord.com/api/v10", "");
    const method = init.method ?? "GET";
    calls.push({ method, path, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const key = `${method} ${path}`;
    if (!(key in routes)) return new Response("{}", { status: 404 });
    const value = routes[key];
    return value === null ? new Response(null, { status: 204 }) : new Response(JSON.stringify(value), { status: 200 });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

describe("nomes de canal e cargo", () => {
  it("ignora acento, emoji e separadores", () => {
    expect(normalizeDiscordName("📢・Anúncios")).toBe("anuncios");
    expect(normalizeDiscordName("Comandante 👑")).toBe("comandante");
    expect(normalizeDiscordName("Ás ⭐")).toBe("as");
    expect(normalizeDiscordName("Criador de Conteúdo")).toBe("criador de conteudo");
  });

  it("acha o canal pelo nome, preferindo o de anúncios (publicável) e ignorando voz/categoria", () => {
    const channels = [
      { id: "1", name: "anuncios", type: 2 },
      { id: "2", name: "📢-anúncios", type: 0 },
      { id: "3", name: "Anúncios", type: 5 },
      { id: "4", name: "torneios", type: 0 },
    ];
    expect(pickChannel(channels, "announcements")?.id).toBe("3");
    expect(pickChannel(channels, "tournaments")?.id).toBe("4");
    expect(pickChannel(channels, "spoilers")).toBeNull();
  });
});

describe("readDiscordGuildConfig", () => {
  it("precisa do token e do canal de aprovação (ou do ID do servidor); IDs de canal só valem se forem IDs", () => {
    expect(readDiscordGuildConfig({})).toBeNull();
    expect(readDiscordGuildConfig({ DISCORD_BOT_TOKEN: "tok" })).toBeNull();
    const config = readDiscordGuildConfig({ ...env, DISCORD_SPOILERS_CHANNEL_ID: "1571201546434121738", DISCORD_TOURNAMENTS_CHANNEL_ID: "lixo" });
    expect(config?.channelOverrides).toEqual({ spoilers: "1571201546434121738" });
  });
});

describe("createDiscordGuild", () => {
  const routes = {
    "GET /channels/1563339185967075389": { guild_id: "999999999999" },
    "GET /guilds/999999999999/channels": [
      { id: "111111", name: "spoilers", type: 0 },
      { id: "222222", name: "anúncios", type: 5 },
    ],
    "POST /channels/111111/messages": { id: "m1" },
    "POST /channels/222222/messages": { id: "m2" },
    "POST /channels/222222/messages/m2/crosspost": { id: "m2" },
  };

  it("descobre o servidor pelo canal de aprovação e posta sem mencionar ninguém", async () => {
    const { fn, calls } = fakeFetch(routes);
    const guild = createDiscordGuild(readDiscordGuildConfig(env)!, fn);
    expect(await guild.post("spoilers", { content: "oi" })).toEqual({ channelId: "111111", messageId: "m1" });
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ allowed_mentions: { parse: [] }, content: "oi" });
    expect(calls.some((c) => c.path.endsWith("/crosspost"))).toBe(false);
  });

  it("em canal de anúncios também publica para quem segue", async () => {
    const { fn, calls } = fakeFetch(routes);
    const guild = createDiscordGuild(readDiscordGuildConfig(env)!, fn);
    await guild.post("announcements", { content: "matéria" });
    expect(calls.some((c) => c.method === "POST" && c.path === "/channels/222222/messages/m2/crosspost")).toBe(true);
  });

  it("canal inexistente → null, sem postar", async () => {
    const { fn, calls } = fakeFetch(routes);
    const guild = createDiscordGuild(readDiscordGuildConfig(env)!, fn);
    expect(await guild.post("tournaments", { content: "x" })).toBeNull();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("guarda canais em cache por 10 minutos", async () => {
    const { fn, calls } = fakeFetch(routes);
    let clock = 0;
    const guild = createDiscordGuild(readDiscordGuildConfig(env)!, fn, () => clock);
    await guild.channels();
    await guild.channels();
    clock = 11 * 60_000;
    await guild.channels();
    expect(calls.filter((c) => c.path === "/guilds/999999999999/channels")).toHaveLength(2);
  });

  it("membro fora do servidor → null; outro erro sobe", async () => {
    const { fn } = fakeFetch({ ...routes, "GET /guilds/999999999999/members/555555": { roles: ["r1"] } });
    const guild = createDiscordGuild(readDiscordGuildConfig(env)!, fn);
    expect(await guild.memberRoles("555555")).toEqual(["r1"]);
    expect(await guild.memberRoles("666666")).toBeNull();
  });
});

describe("endereços", () => {
  it("caminho do site vira endereço completo; http, javascript: e // somem", () => {
    expect(absoluteHttpsUrl("/uploads/spoilers/a.webp", "https://anaheimhub.com")).toBe("https://anaheimhub.com/uploads/spoilers/a.webp");
    expect(absoluteHttpsUrl("https://cdn.example.com/a.png", "https://anaheimhub.com")).toBe("https://cdn.example.com/a.png");
    expect(absoluteHttpsUrl("http://x.com/a.png", "https://anaheimhub.com")).toBeUndefined();
    expect(absoluteHttpsUrl("//evil.com/a.png", "https://anaheimhub.com")).toBeUndefined();
    expect(absoluteHttpsUrl("javascript:alert(1)", "https://anaheimhub.com")).toBeUndefined();
  });

  it("PUBLIC_APP_URL local não serve para link público", () => {
    expect(discordPublicUrl({ PUBLIC_APP_URL: "http://localhost:8787" })).toBe("https://anaheimhub.com");
    expect(discordPublicUrl({ PUBLIC_APP_URL: "https://anaheimhub.com/" })).toBe("https://anaheimhub.com");
  });
});
