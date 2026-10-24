/* Bot do Discord para aprovar os posts do Instagram por botão (✅ Aprovar / ❌ Descartar).
 * Webhook comum só envia mensagem; botão exige um app do Discord: o bot posta o rascunho com os botões e o Discord
 * chama POST /api/discord/interactions a cada clique, assinado com Ed25519 (chave pública do app). */
import { createPublicKey, verify } from "node:crypto";

const DISCORD_API = "https://discord.com/api/v10";
// prefixo DER (SPKI) de uma chave Ed25519: o portal do Discord dá só os 32 bytes da chave em hex
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
// clique assinado há mais tempo que isso é recusado (reenvio de uma requisição capturada)
const MAX_SIGNATURE_AGE_S = 300;
const SNOWFLAKE = /^\d{5,25}$/;
const CUSTOM_ID = /^social:(approve|reject):([A-Za-z0-9_-]{1,64})$/;

export type DiscordBotConfig = {
  appId: string;
  publicKey: string;
  botToken: string;
  channelId: string;
  approverIds: Set<string>;
};

/** Configuração do bot; `null` se faltar qualquer peça — aí os avisos seguem pelo webhook, sem botões. */
export function readDiscordBotConfig(env: NodeJS.ProcessEnv = process.env): DiscordBotConfig | null {
  const appId = (env.DISCORD_APP_ID || "").trim();
  const publicKey = (env.DISCORD_APP_PUBLIC_KEY || "").trim().toLowerCase();
  const botToken = (env.DISCORD_BOT_TOKEN || "").trim();
  const channelId = (env.DISCORD_CHANNEL_ID || "").trim();
  const approverIds = new Set((env.DISCORD_APPROVER_IDS || "").split(",").map((id) => id.trim()).filter((id) => SNOWFLAKE.test(id)));
  if (!SNOWFLAKE.test(appId) || !/^[0-9a-f]{64}$/.test(publicKey) || !botToken || !SNOWFLAKE.test(channelId) || approverIds.size === 0) return null;
  return { appId, publicKey, botToken, channelId, approverIds };
}

/** O clique veio mesmo do Discord? Assinatura Ed25519 sobre `timestamp + corpo cru`. */
export function verifyDiscordSignature(publicKeyHex: string, signatureHex: string, timestamp: string, rawBody: Buffer, now = new Date()): boolean {
  if (!/^[0-9a-f]{128}$/i.test(signatureHex) || !/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(now.getTime() / 1000 - Number(timestamp)) > MAX_SIGNATURE_AGE_S) return false;
  try {
    const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, "hex")]), format: "der", type: "spki" });
    return verify(null, Buffer.concat([Buffer.from(timestamp), rawBody]), key, Buffer.from(signatureHex, "hex"));
  } catch {
    return false;
  }
}

export function parseSocialCustomId(customId: string): { action: "approve" | "reject"; postId: string } | null {
  const match = CUSTOM_ID.exec(customId);
  return match ? { action: match[1] as "approve" | "reject", postId: match[2] } : null;
}

/** Linha de botões do rascunho (estilo 3 = verde, 4 = vermelho). */
export function socialButtons(postId: string) {
  return [
    {
      type: 1,
      components: [
        { type: 2, style: 3, label: "Aprovar", emoji: { name: "✅" }, custom_id: `social:approve:${postId}` },
        { type: 2, style: 4, label: "Descartar", emoji: { name: "❌" }, custom_id: `social:reject:${postId}` },
      ],
    },
  ];
}

type FetchFn = typeof fetch;

/** Posta no canal do bot. `false` se o Discord recusar (ex.: bot sem acesso ao canal privado) — quem chama cai no webhook. */
export async function postBotMessage(config: DiscordBotConfig, payload: object, fetchFn: FetchFn = fetch): Promise<boolean> {
  try {
    const res = await fetchFn(`${DISCORD_API}/channels/${config.channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${config.botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return true;
    console.warn("[discordBot] Discord recusou a mensagem do bot:", res.status);
  } catch (err) {
    console.warn("[discordBot] Falha ao postar pelo bot:", err instanceof Error ? err.message : err);
  }
  return false;
}

/** Troca a mensagem do clique (o token da interação vale 15 min e dispensa o token do bot). */
export async function editInteractionMessage(config: DiscordBotConfig, interactionToken: string, payload: object, fetchFn: FetchFn = fetch): Promise<void> {
  try {
    const res = await fetchFn(`${DISCORD_API}/webhooks/${config.appId}/${encodeURIComponent(interactionToken)}/messages/@original`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.warn("[discordBot] Discord recusou a edição da mensagem:", res.status);
  } catch (err) {
    console.warn("[discordBot] Falha ao editar a mensagem do clique:", err instanceof Error ? err.message : err);
  }
}
