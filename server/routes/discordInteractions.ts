/* POST /api/discord/interactions — cliques nos botões do rascunho do Instagram (✅ Aprovar / ❌ Descartar).
 * O Discord assina cada chamada (Ed25519); sem assinatura válida nada executa. Só quem está em DISCORD_APPROVER_IDS
 * aprova. O Discord exige resposta em 3 s e publicar demora mais: responde "adiado" (type 6) e edita a mensagem depois. */
import type { Request, Response } from "express";
import { editInteractionMessage, parseSocialCustomId, verifyDiscordSignature, type DiscordBotConfig } from "../services/discordBot.ts";
import { buildDiscordSocialPayload, type DiscordNoticeKind } from "../services/socialPublisherService.ts";

type PostLike = Parameters<typeof buildDiscordSocialPayload>[0] & { status: string; instagramPermalink?: string | null; publishError?: string | null };

export type DiscordInteractionDeps = {
  config: () => DiscordBotConfig | null;
  approve: (postId: string) => Promise<{ ok: boolean; post: PostLike }>;
  reject: (postId: string, reason: string) => Promise<PostLike | null>;
  publicUrl: () => string;
  editMessage?: typeof editInteractionMessage;
  now?: () => Date;
};

type Interaction = {
  type: number;
  token?: string;
  data?: { custom_id?: string };
  member?: { user?: { id?: string; username?: string; global_name?: string } };
};

const PING = 1;
const COMPONENT_CLICK = 3;
const PONG = 1;
const REPLY = 4;
const DEFERRED_UPDATE = 6;
const EPHEMERAL = 64;

const onlyForYou = (content: string) => ({ type: REPLY, data: { content, flags: EPHEMERAL } });

function kindAfterApproval(post: PostLike): DiscordNoticeKind {
  if (post.status === "PUBLISHED") return "published";
  if (post.status === "FAILED") return "failed";
  return "approved";
}

export function createDiscordInteractionHandler(deps: DiscordInteractionDeps) {
  const editMessage = deps.editMessage ?? editInteractionMessage;

  return async function handleDiscordInteraction(req: Request, res: Response): Promise<void> {
    const config = deps.config();
    if (!config) {
      res.status(404).json({ error: "Bot do Discord não configurado." });
      return;
    }
    const raw = Buffer.isBuffer(req.body) ? req.body : null;
    const signature = req.get("x-signature-ed25519") || "";
    const timestamp = req.get("x-signature-timestamp") || "";
    if (!raw || !verifyDiscordSignature(config.publicKey, signature, timestamp, raw, deps.now?.())) {
      res.status(401).json({ error: "Assinatura inválida." });
      return;
    }

    let interaction: Interaction;
    try {
      interaction = JSON.parse(raw.toString("utf8")) as Interaction;
    } catch {
      res.status(400).json({ error: "Corpo inválido." });
      return;
    }

    if (interaction.type === PING) {
      res.json({ type: PONG });
      return;
    }
    if (interaction.type !== COMPONENT_CLICK || !interaction.token) {
      res.json(onlyForYou("Ação não suportada."));
      return;
    }

    // clique em DM não traz `member`: fica de fora junto com quem não está na lista
    const user = interaction.member?.user;
    if (!user?.id || !config.approverIds.has(user.id)) {
      res.json(onlyForYou("Você não pode aprovar posts."));
      return;
    }
    const action = parseSocialCustomId(interaction.data?.custom_id || "");
    if (!action) {
      res.json(onlyForYou("Ação desconhecida."));
      return;
    }

    res.json({ type: DEFERRED_UPDATE });

    const who = user.global_name || user.username || user.id;
    const publicUrl = deps.publicUrl();
    try {
      if (action.action === "approve") {
        const { post } = await deps.approve(action.postId);
        const kind = kindAfterApproval(post);
        const extra = kind === "published" && post.instagramPermalink ? `🔗 ${post.instagramPermalink}` : kind === "failed" ? post.publishError || undefined : undefined;
        const payload = buildDiscordSocialPayload(post, publicUrl, kind, [`por ${who}`, extra].filter(Boolean).join(" · "));
        await editMessage(config, interaction.token, { ...payload, components: [] });
      } else {
        const post = await deps.reject(action.postId, `Descartado pelo Discord por ${who}`);
        const payload = post ? buildDiscordSocialPayload(post, publicUrl, "rejected", `por ${who}`) : { content: "🗑️ Rascunho descartado", embeds: [] };
        await editMessage(config, interaction.token, { ...payload, components: [] });
      }
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Erro inesperado.";
      console.warn("[discordInteractions] ação do botão falhou:", message);
      // a mensagem mantém a prévia; só troca o cabeçalho pelo motivo e tira os botões (resolver pelo painel)
      await editMessage(config, interaction.token, { content: `⚠️ Não deu para concluir: ${message}\nResolva pelo painel: ${publicUrl}/admin#social`, components: [] });
    }
  };
}
