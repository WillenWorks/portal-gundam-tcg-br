/* Estatísticas de audiência com o Cloudflare Web Analytics: gratuito, sem cookies e sem
 * localStorage (não exige banner de consentimento), com suporte a SPA (cada troca de rota
 * conta como uma visualização).
 *
 * Só liga no domínio de produção. O token do site (público por natureza: vai no HTML de qualquer
 * jeito) fica fixo abaixo; VITE_CF_BEACON_TOKEN no build sobrescreve, se um dia precisar trocar. */
const BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";
const DEFAULT_BEACON_TOKEN = "bc2aeaeb83ef4bfb98b0977292b6d603";
const PRODUCTION_HOSTS = new Set(["anaheimhub.com", "www.anaheimhub.com"]);

export function shouldLoadAnalytics(token: string | undefined, hostname: string): token is string {
  return Boolean(token && token.trim()) && PRODUCTION_HOSTS.has(hostname);
}

export function initAnalytics(
  token = (import.meta.env.VITE_CF_BEACON_TOKEN as string | undefined) || DEFAULT_BEACON_TOKEN,
  hostname = typeof window === "undefined" ? "" : window.location.hostname,
) {
  if (typeof document === "undefined") return;
  if (!shouldLoadAnalytics(token, hostname)) return;
  if (document.querySelector(`script[src="${BEACON_SRC}"]`)) return;
  const script = document.createElement("script");
  script.defer = true;
  script.src = BEACON_SRC;
  script.setAttribute("data-cf-beacon", JSON.stringify({ token: token.trim(), spa: true }));
  document.head.appendChild(script);
}
