/* Monitoramento de erros do site com o Sentry (plano gratuito).
 *
 * - Só liga no domínio de produção, como o analytics.
 * - O SDK é carregado depois da página (import dinâmico), então não pesa no carregamento inicial;
 *   erros que acontecem antes disso ficam guardados e são enviados quando ele chega.
 * - Sem dados pessoais: sem IP, sem cookies, sem usuário, sem gravação de tela, sem rastreamento
 *   de performance. Tokens e e-mails em URLs e mensagens são trocados por "[removido]".
 *
 * O DSN é público por natureza (vai no código do site de qualquer jeito); VITE_SENTRY_DSN no build
 * sobrescreve, se um dia precisar trocar. */
import type { ErrorEvent, EventHint } from "@sentry/react";

export const DEFAULT_SENTRY_DSN =
  "https://6175b4ddb9ce7103a34f3550645c6313@o4512285592518656.ingest.us.sentry.io/4512285603790848";
const PRODUCTION_HOSTS = new Set(["anaheimhub.com", "www.anaheimhub.com"]);

type SentryModule = typeof import("@sentry/react");

let sentry: SentryModule | null = null;
let pending: unknown[] = [];

export function shouldMonitorErrors(dsn: string | undefined, hostname: string): dsn is string {
  return Boolean(dsn && dsn.trim()) && PRODUCTION_HOSTS.has(hostname);
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const SECRET_PARAM = /([?&#](?:token|access_token|code|key|senha|password)=)[^&#\s]+/gi;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/g;

/** Tira e-mails, tokens de URL e cabeçalhos de autorização de qualquer texto do evento. */
export function scrubText(text: string): string {
  return text.replace(EMAIL, "[removido]").replace(SECRET_PARAM, "$1[removido]").replace(BEARER, "Bearer [removido]");
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    if (event.request.url) event.request.url = scrubText(event.request.url);
    if (typeof event.request.query_string === "string") event.request.query_string = scrubText(event.request.query_string);
  }
  if (event.message) event.message = scrubText(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubText(ex.value);
  }
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = scrubText(crumb.message);
    if (crumb.data && typeof crumb.data.url === "string") crumb.data.url = scrubText(crumb.data.url);
  }
  return event;
}

/** Ruído de extensões do navegador e de scripts de terceiros que não são erros do site. */
const IGNORED_ERRORS = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  /reading 'startTime'/,
  "Non-Error promise rejection captured",
];
const DENIED_URLS = [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-(web-)?extension:\/\//, /static\.cloudflareinsights\.com/];

/** Registra um erro capturado à mão (ex.: ErrorBoundary). Antes do SDK carregar, fica na fila. */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (sentry) {
    sentry.captureException(error, context ? { extra: context } : undefined);
  } else if (pending.length < 20) {
    pending.push(error);
  }
}

export function initErrorMonitoring(
  dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || DEFAULT_SENTRY_DSN,
  hostname = typeof window === "undefined" ? "" : window.location.hostname,
) {
  if (typeof window === "undefined" || !shouldMonitorErrors(dsn, hostname)) return;

  // até o SDK chegar, guarda os erros não tratados para enviar depois
  const queue = (event: ErrorEvent | PromiseRejectionEvent | Event) => {
    const err = "reason" in event ? event.reason : "error" in event ? (event as globalThis.ErrorEvent).error : undefined;
    if (err && pending.length < 20) pending.push(err);
  };
  window.addEventListener("error", queue);
  window.addEventListener("unhandledrejection", queue);

  const load = () =>
    import("@sentry/react")
      .then((mod) => {
        mod.init({
          dsn: dsn.trim(),
          environment: "production",
          release: import.meta.env.VITE_RELEASE as string | undefined,
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
          tracesSampleRate: 0,
          ignoreErrors: IGNORED_ERRORS,
          denyUrls: DENIED_URLS,
          beforeSend: (event: ErrorEvent, _hint: EventHint) => scrubEvent(event),
        });
        sentry = mod;
        window.removeEventListener("error", queue);
        window.removeEventListener("unhandledrejection", queue);
        const early = pending;
        pending = [];
        for (const err of early) mod.captureException(err);
      })
      .catch(() => {
        // bloqueador de anúncios ou rede fora: o site segue normal, só sem monitoramento
      });

  if (document.readyState === "complete") void load();
  else window.addEventListener("load", () => void load(), { once: true });
}
