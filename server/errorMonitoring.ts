/* Monitoramento de erros da API com o Sentry (plano gratuito).
 *
 * Só liga em produção (NODE_ENV=production ou SENTRY_ENABLED=true, que o deploy da VPS exporta). O SDK é importado sob demanda, então dev e testes não o
 * carregam. Captura: erros que chegam ao handler de erro do Express (chamada explícita abaixo) e,
 * pelas integrações padrão do SDK, exceções e promessas rejeitadas não tratadas.
 *
 * Sem dados pessoais: sem IP, cookies, cabeçalhos, corpo de requisição ou usuário; e-mails e tokens
 * em mensagens e URLs viram "[removido]". Sem rastreamento de performance.
 *
 * SENTRY_DSN no .env sobrescreve o DSN padrão (o mesmo projeto do site, marcado com runtime=api). */
import type { ErrorEvent } from "@sentry/node";

const DEFAULT_SENTRY_DSN =
  "https://6175b4ddb9ce7103a34f3550645c6313@o4512285592518656.ingest.us.sentry.io/4512285603790848";

type SentryNode = typeof import("@sentry/node");
let sentry: SentryNode | null = null;

// quantificadores limitados (tamanhos máximos de e-mail): sem eles a busca fica quadrática em textos longos sem "@"
const EMAIL = /[A-Za-z0-9._%+-]{1,64}@(?:[A-Za-z0-9-]{1,63}\.){1,8}[A-Za-z]{2,24}/g;
const SECRET_PARAM = /([?&#](?:token|access_token|code|key|senha|password)=)[^&#\s]+/gi;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/g;

export function scrubServerText(text: string): string {
  return text.replace(EMAIL, "[removido]").replace(SECRET_PARAM, "$1[removido]").replace(BEARER, "Bearer [removido]");
}

export function scrubServerEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.env;
    if (event.request.url) event.request.url = scrubServerText(event.request.url);
    if (typeof event.request.query_string === "string") event.request.query_string = scrubServerText(event.request.query_string);
  }
  if (event.message) event.message = scrubServerText(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubServerText(ex.value);
  }
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = scrubServerText(crumb.message);
  }
  return event;
}

/** Liga com NODE_ENV=production ou SENTRY_ENABLED=true (o deploy da VPS exporta este último). */
export function shouldMonitorServer(env: NodeJS.ProcessEnv): boolean {
  return (env.NODE_ENV === "production" || env.SENTRY_ENABLED === "true") && env.SENTRY_DISABLED !== "true";
}

export async function initServerErrorMonitoring(env: NodeJS.ProcessEnv = process.env) {
  if (!shouldMonitorServer(env)) return;
  try {
    const mod = await import("@sentry/node");
    mod.init({
      dsn: (env.SENTRY_DSN || DEFAULT_SENTRY_DSN).trim(),
      environment: "production",
      release: env.ENGINE_SHA,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        databaseQueryData: false,
        queues: false,
        stackFrameVariables: false,
        genAI: { inputs: false, outputs: false },
        graphQL: { document: false, variables: false },
      },
      initialScope: { tags: { runtime: "api" } },
      beforeSend: (event) => scrubServerEvent(event),
    });
    sentry = mod;
  } catch (error) {
    console.error("Aviso: Sentry não iniciou — a API segue sem monitoramento de erros.", error);
  }
}

/** Erro que chegou ao handler final do Express. `route` = método + caminho sem query (ex.: "GET /api/cards"). */
export function captureServerError(error: unknown, route?: string) {
  if (!sentry) return;
  sentry.captureException(error, route ? { tags: { route: scrubServerText(route) } } : undefined);
}
