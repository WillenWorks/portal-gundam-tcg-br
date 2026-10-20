// E-mails de conta (confirmação de e-mail e recuperação de senha): tokens de uso único, envio por SMTP
// (Hostinger, remetente nao-responda@anaheimhub.com) e as rotas /api/auth/forgot-password, reset-password,
// verify-email e verify-email/resend.
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import type { AuthTokenType, PrismaClient } from "@prisma/client";
import type { Express, Request, RequestHandler, Response } from "express";

export const EMAIL_VERIFY_TTL_MS = 48 * 60 * 60_000;
export const PASSWORD_RESET_TTL_MS = 60 * 60_000;
export const MIN_PASSWORD_LENGTH = 8;

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  readonly configured: boolean;
  send(mail: Mail): Promise<boolean>;
}

/** SMTP pelas variáveis SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e MAIL_FROM. Sem elas, não envia (só registra). */
export function createMailer(env: NodeJS.ProcessEnv = process.env): Mailer {
  const host = env.SMTP_HOST;
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  const from = env.MAIL_FROM || (user ? `AnaheimHub <${user}>` : "");
  if (!host || !user || !pass) {
    return {
      configured: false,
      async send(mail) {
        console.warn(`[email] SMTP não configurado — não enviado: "${mail.subject}" para ${mail.to}`);
        return false;
      },
    };
  }
  const port = Number(env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  return {
    configured: true,
    async send(mail) {
      try {
        await transport.sendMail({ from, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
        return true;
      } catch (err) {
        console.error(`[email] falha ao enviar "${mail.subject}" para ${mail.to}:`, err instanceof Error ? err.message : err);
        return false;
      }
    },
  };
}

export const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

/** Gera um token novo (o anterior do mesmo tipo deixa de valer) e devolve o valor que vai no link. */
export async function issueToken(prisma: PrismaClient, userId: string, type: AuthTokenType, ttlMs: number, now = new Date()): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: now } }),
    prisma.authToken.create({ data: { userId, type, tokenHash: hashToken(raw), expiresAt: new Date(now.getTime() + ttlMs) } }),
  ]);
  return raw;
}

/** Valida e consome o token. Devolve o userId ou o motivo da recusa. */
export async function consumeToken(
  prisma: PrismaClient,
  raw: string,
  type: AuthTokenType,
  now = new Date(),
): Promise<{ userId: string } | { error: "invalido" | "expirado" | "usado" }> {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!row || row.type !== type) return { error: "invalido" };
  if (row.usedAt) return { error: "usado" };
  if (row.expiresAt <= now) return { error: "expirado" };
  const claimed = await prisma.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
  if (claimed.count === 0) return { error: "usado" };
  return { userId: row.userId };
}

// ---------- modelos de e-mail ----------

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

function layout(title: string, intro: string, buttonLabel: string, link: string, outro: string): { html: string; text: string } {
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#0b1220;font-family:Arial,Helvetica,sans-serif;color:#e5e7eb">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111a2e;border:1px solid #1f2a44;border-radius:8px">
<tr><td style="padding:28px 28px 8px;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#f59e0b;font-weight:bold">AnaheimHub</td></tr>
<tr><td style="padding:0 28px;font-size:22px;font-weight:bold;color:#ffffff">${escapeHtml(title)}</td></tr>
<tr><td style="padding:16px 28px;font-size:15px;line-height:1.6;color:#cbd5e1">${intro}</td></tr>
<tr><td style="padding:8px 28px 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#f59e0b;color:#111827;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:6px">${escapeHtml(buttonLabel)}</a></td></tr>
<tr><td style="padding:0 28px 8px;font-size:13px;line-height:1.6;color:#94a3b8">Se o botão não funcionar, copie e cole este endereço no navegador:<br><span style="word-break:break-all;color:#cbd5e1">${escapeHtml(link)}</span></td></tr>
<tr><td style="padding:16px 28px 28px;font-size:13px;line-height:1.6;color:#94a3b8">${outro}</td></tr>
</table>
<p style="font-size:12px;color:#64748b;margin-top:16px">Este é um e-mail automático. Não responda a esta mensagem.</p>
</td></tr></table></body></html>`;
  const text = `AnaheimHub — ${title}\n\n${intro.replace(/<[^>]+>/g, "")}\n\n${buttonLabel}: ${link}\n\n${outro.replace(/<[^>]+>/g, "")}\n\nEste é um e-mail automático. Não responda a esta mensagem.`;
  return { html, text };
}

export function verifyEmailMessage(to: string, name: string, link: string): Mail {
  const { html, text } = layout(
    "Confirme seu e-mail",
    `Olá, ${escapeHtml(name)}! Falta só um passo para ativar sua conta no AnaheimHub: confirme que este e-mail é seu.`,
    "Confirmar e-mail",
    link,
    "O link vale por 48 horas. Se você não criou uma conta no AnaheimHub, ignore este e-mail.",
  );
  return { to, subject: "Confirme seu e-mail no AnaheimHub", html, text };
}

export function resetPasswordMessage(to: string, name: string, link: string): Mail {
  const { html, text } = layout(
    "Redefinir sua senha",
    `Olá, ${escapeHtml(name)}! Recebemos um pedido para redefinir a senha da sua conta no AnaheimHub.`,
    "Criar nova senha",
    link,
    "O link vale por 1 hora e só pode ser usado uma vez. Se você não pediu, ignore este e-mail: sua senha continua a mesma.",
  );
  return { to, subject: "Redefinição de senha do AnaheimHub", html, text };
}

// ---------- rotas ----------

export interface AuthEmailDeps {
  prisma: PrismaClient;
  mailer: Mailer;
  publicUrl: string | ((req?: Request) => string);
  /** limita tentativas (true = bloqueado) */
  rateLimited: (req: Request, identifier?: string) => boolean;
  authRequired: RequestHandler;
}

export const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function validatePasswordRequirements(password: string): { valid: boolean; error?: string } {
  const p = password || "";
  if (p.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  }
  if (!/[A-Z]/.test(p)) {
    return { valid: false, error: "A senha precisa conter pelo menos uma letra maiúscula (A-Z)." };
  }
  if (!/[a-z]/.test(p)) {
    return { valid: false, error: "A senha precisa conter pelo menos uma letra minúscula (a-z)." };
  }
  if (!/[0-9]/.test(p)) {
    return { valid: false, error: "A senha precisa conter pelo menos um número (0-9)." };
  }
  if (!SPECIAL_CHARS_REGEX.test(p)) {
    return { valid: false, error: "A senha precisa conter pelo menos um caractere especial (!@#$%)." };
  }
  return { valid: true };
}

export const resolveBaseUrl = (publicUrl: string | ((req?: Request) => string), req?: Request): string => {
  const url = typeof publicUrl === "function" ? publicUrl(req) : publicUrl;
  return url.replace(/\/$/, "");
};

const appLink = (base: string, path: string, token: string) => `${base.replace(/\/$/, "")}${path}?token=${encodeURIComponent(token)}`;

export async function sendVerificationEmail(
  deps: Pick<AuthEmailDeps, "prisma" | "mailer" | "publicUrl">,
  user: { id: string; email: string; displayName: string },
  req?: Request,
) {
  const token = await issueToken(deps.prisma, user.id, "EMAIL_VERIFY", EMAIL_VERIFY_TTL_MS);
  const baseUrl = resolveBaseUrl(deps.publicUrl, req);
  return deps.mailer.send(verifyEmailMessage(user.email, user.displayName, appLink(baseUrl, "/confirmar-email", token)));
}

const TOKEN_ERRORS = {
  invalido: "Link inválido. Peça um novo.",
  expirado: "Este link expirou. Peça um novo.",
  usado: "Este link já foi usado. Peça um novo se precisar.",
} as const;

export function registerAuthEmailRoutes(app: Express, deps: AuthEmailDeps) {
  const { prisma, mailer, publicUrl } = deps;

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    const email = String((req.body as { email?: string })?.email ?? "").trim().toLowerCase();
    if (deps.rateLimited(req, email)) return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos." });
    if (!email) return res.status(400).json({ error: "Informe o e-mail." });
    // mesma resposta exista ou não a conta: não revela quem está cadastrado
    const ok = { ok: true, message: "Se houver uma conta com este e-mail, enviamos um link para redefinir a senha." };
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return res.json(ok);
    const token = await issueToken(prisma, user.id, "PASSWORD_RESET", PASSWORD_RESET_TTL_MS);
    const baseUrl = resolveBaseUrl(publicUrl, req);
    await mailer.send(resetPasswordMessage(user.email, user.displayName, appLink(baseUrl, "/redefinir-senha", token)));
    res.json(ok);
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    const { token, password } = (req.body ?? {}) as { token?: string; password?: string };
    if (deps.rateLimited(req)) return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos." });
    if (!token) return res.status(400).json({ error: TOKEN_ERRORS.invalido });
    const passCheck = validatePasswordRequirements(password || "");
    if (!passCheck.valid) return res.status(400).json({ error: passCheck.error });
    const result = await consumeToken(prisma, token, "PASSWORD_RESET");
    if ("error" in result) return res.status(400).json({ error: TOKEN_ERRORS[result.error] });
    const passwordHash = await bcrypt.hash(password!, 10);
    const user = await prisma.user.findUnique({ where: { id: result.userId } });
    // quem recebeu o link no e-mail também provou que o e-mail é dele
    // tokenVersion +1: sessões abertas antes da redefinição deixam de valer (ver server/sessionState.ts)
    await prisma.user.update({ where: { id: result.userId }, data: { passwordHash, emailVerifiedAt: user?.emailVerifiedAt ?? new Date(), tokenVersion: { increment: 1 } } });
    res.json({ ok: true, message: "Senha redefinida. Entre com a nova senha." });
  });

  app.post("/api/auth/verify-email", async (req: Request, res: Response) => {
    const token = String((req.body as { token?: string })?.token ?? "");
    if (deps.rateLimited(req)) return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos." });
    if (!token) return res.status(400).json({ error: TOKEN_ERRORS.invalido });
    const result = await consumeToken(prisma, token, "EMAIL_VERIFY");
    if ("error" in result) return res.status(400).json({ error: TOKEN_ERRORS[result.error] });
    await prisma.user.update({ where: { id: result.userId }, data: { emailVerifiedAt: new Date() } });
    res.json({ ok: true, message: "E-mail confirmado. Obrigado!" });
  });

  app.post("/api/auth/verify-email/resend", deps.authRequired, async (req: Request, res: Response) => {
    const userId = (req as Request & { user?: { userId: string } }).user?.userId;
    if (deps.rateLimited(req, userId)) return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos." });
    const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
    if (!user || !user.isActive) return res.status(403).json({ error: "Usuário sem acesso ativo." });
    if (user.emailVerifiedAt) return res.json({ ok: true, message: "Seu e-mail já está confirmado." });
    const sent = await sendVerificationEmail({ prisma, mailer, publicUrl }, user, req);
    if (!sent) return res.status(503).json({ error: "Não foi possível enviar o e-mail agora. Tente mais tarde." });
    res.json({ ok: true, message: `Enviamos um novo link para ${user.email}.` });
  });

  app.post("/api/auth/verify-email/request", async (req: Request, res: Response) => {
    const email = String((req.body as { email?: string })?.email ?? "").trim().toLowerCase();
    if (deps.rateLimited(req, email)) return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos." });
    if (!email) return res.status(400).json({ error: "Informe o e-mail." });
    const ok = { ok: true, message: "Se houver uma conta pendente de confirmação com este e-mail, enviamos um novo link." };
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || user.emailVerifiedAt) return res.json(ok);
    await sendVerificationEmail({ prisma, mailer, publicUrl }, user, req);
    res.json(ok);
  });
}
