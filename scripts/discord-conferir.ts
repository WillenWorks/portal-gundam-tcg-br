/* Confere o Discord do Anaheim Hub do jeito que o bot enxerga (tarefa "discord-conferir" da Manutenção da VPS).
 * Só leitura e só nomes, tipos e sim/não: nunca token, segredo ou mensagem.
 *   npx tsx scripts/discord-conferir.ts */
import "dotenv/config";
import { createDiscordGuild, normalizeDiscordName, readDiscordGuildConfig, type DiscordChannelKind } from "../server/services/discordGuild.ts";
import { managedRoles } from "../server/services/discordRoles.ts";
import { readDiscordOAuthConfig } from "../server/routes/discordLinkRoutes.ts";

const yes = (v: unknown) => (v ? "sim" : "NÃO");

async function main() {
  const config = readDiscordGuildConfig();
  console.log(`bot (DISCORD_BOT_TOKEN + canal de aprovação): ${yes(config)}`);
  const oauth = readDiscordOAuthConfig();
  console.log(`conectar conta (DISCORD_APP_ID + DISCORD_CLIENT_SECRET): ${yes(oauth)}`);
  if (oauth) console.log(`  endereço de volta que precisa estar em OAuth2 → Redirects: ${oauth.redirectUri}`);
  console.log(`anúncios automáticos: ${process.env.DISCORD_ANNOUNCE_ENABLED === "false" ? "desligados (DISCORD_ANNOUNCE_ENABLED=false)" : "ligados"}`);
  if (!config) return;

  const guild = createDiscordGuild(config);
  await guild.getGuildId();
  console.log("servidor: encontrado");

  const kinds: [DiscordChannelKind, string][] = [
    ["spoilers", "#spoilers (spoilers aprovados)"],
    ["announcements", "#anúncios (artigos)"],
    ["tournaments", "#torneios (torneios)"],
  ];
  for (const [kind, label] of kinds) {
    const channel = await guild.channelFor(kind);
    console.log(`${label}: ${channel ? `#${channel.name}${channel.type === 5 ? " (canal de anúncios: publica para quem segue)" : ""}` : "NÃO ENCONTRADO — crie o canal com esse nome"}`);
  }

  const roles = await guild.roles();
  const managed = managedRoles(roles);
  const appId = (process.env.DISCORD_APP_ID || "").trim();
  const botRoleIds = new Set((await guild.botMember(appId).catch(() => null)) ?? []);
  const botTop = Math.max(-1, ...roles.filter((r) => botRoleIds.has(r.id)).map((r) => r.position));
  console.log(`cargos que o site administra (${managed.size}):`);
  for (const [key, role] of managed) {
    console.log(`  ${key.padEnd(18)} → ${role.name}${role.position < botTop ? "" : "  ⚠️ fica ACIMA do cargo do bot: suba o cargo do bot na lista"}`);
  }
  const unmatched = ["comandante", "as", "piloto", "recruta"].filter((n) => ![...managed.values()].some((r) => normalizeDiscordName(r.name) === n));
  if (unmatched.length) console.log(`  patentes sem cargo no servidor: ${unmatched.join(", ")}`);
}

main().catch((err) => {
  console.error("falhou:", err instanceof Error ? err.message : err);
  process.exit(1);
});
