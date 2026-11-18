import { describe, expect, it, vi } from "vitest";
import { desiredKeys, managedRoles, planRoleChanges, syncMemberRoles } from "./discordRoles";
import type { DiscordGuild, GuildRole } from "./discordGuild";

// cargos como estão no servidor (print do Willen), mais um de integração e os que o site não administra
const roles: GuildRole[] = [
  { id: "bot", name: "AnaheimHub", position: 20, managed: true },
  { id: "mod", name: "Moderador", position: 19 },
  { id: "cmd", name: "Comandante 👑", position: 18 },
  { id: "as", name: "Ás ⭐", position: 17 },
  { id: "pil", name: "Piloto 🏷️", position: 16 },
  { id: "rec", name: "Recruta 🎖️", position: 15 },
  { id: "juiz", name: "Juiz", position: 14 },
  { id: "org", name: "Organizador", position: 13 },
  { id: "cri", name: "Criador de Conteúdo", position: 12 },
  { id: "voz", name: "Voz da Comunidade", position: 11 },
  { id: "sud", name: "Sudeste", position: 5 },
];

describe("cargos administrados", () => {
  it("casa patentes e tags pelo nome, sem emoji nem acento; o resto fica de fora", () => {
    const managed = managedRoles(roles);
    expect(Object.fromEntries([...managed].map(([k, r]) => [k, r.id]))).toEqual({
      "tier:COMANDANTE": "cmd",
      "tier:AS": "as",
      "tier:PILOTO": "pil",
      "tier:RECRUTA": "rec",
      "tag:JUIZ": "juiz",
      "tag:ORGANIZADOR": "org",
      "tag:CRIADOR": "cri",
    });
  });

  it("patente só vale para apoiador ativo", () => {
    expect([...desiredKeys({ isSupporter: true, supporterTier: "AS", tags: [{ tag: "JUIZ" }] })]).toEqual(["tier:AS", "tag:JUIZ"]);
    expect([...desiredKeys({ isSupporter: false, supporterTier: "AS", tags: [] })]).toEqual([]);
  });

  it("troca de patente: entra a nova, sai a antiga; Moderador e região não são tocados", () => {
    const managed = managedRoles(roles);
    const plan = planRoleChanges(["mod", "rec", "sud"], managed, desiredKeys({ isSupporter: true, supporterTier: "PILOTO", tags: [] }));
    expect(plan.add.map((r) => r.id)).toEqual(["pil"]);
    expect(plan.remove.map((r) => r.id)).toEqual(["rec"]);
  });
});

function fakeGuild(memberRoles: string[] | null) {
  const addRole = vi.fn(async () => {});
  const removeRole = vi.fn(async () => {});
  const guild = { roles: async () => roles, memberRoles: async () => memberRoles, addRole, removeRole } as unknown as DiscordGuild;
  return { guild, addRole, removeRole };
}

describe("syncMemberRoles", () => {
  it("dá os cargos que faltam", async () => {
    const { guild, addRole, removeRole } = fakeGuild(["sud"]);
    const result = await syncMemberRoles(guild, "123456", { isSupporter: true, supporterTier: "COMANDANTE", tags: [{ tag: "ORGANIZADOR" }] });
    expect(result).toEqual({ status: "ok", added: ["Comandante 👑", "Organizador"], removed: [] });
    expect(addRole).toHaveBeenCalledWith("123456", "cmd");
    expect(removeRole).not.toHaveBeenCalled();
  });

  it("desconectar (user null) tira só os cargos administrados", async () => {
    const { guild, removeRole } = fakeGuild(["mod", "as", "juiz", "sud"]);
    const result = await syncMemberRoles(guild, "123456", null);
    expect(result.removed).toEqual(["Ás ⭐", "Juiz"]);
    expect(removeRole).toHaveBeenCalledTimes(2);
  });

  it("quem ainda não entrou no servidor fica para a próxima rodada", async () => {
    const { guild, addRole } = fakeGuild(null);
    expect((await syncMemberRoles(guild, "123456", { isSupporter: true, supporterTier: "AS", tags: [] })).status).toBe("not-in-guild");
    expect(addRole).not.toHaveBeenCalled();
  });
});
