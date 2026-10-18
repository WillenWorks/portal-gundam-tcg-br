/* Estatísticas de audiência com o Cloudflare Web Analytics: gratuito, sem cookies e sem
 * localStorage (não exige banner de consentimento), com suporte a SPA (cada troca de rota
 * conta como uma visualização).
 *
 * Só liga no domínio de produção e só se o build tiver o token do site:
 *   VITE_CF_BEACON_TOKEN=<token do painel Cloudflare → Web Analytics → Add a site>
 * (no .env da VPS; o deploy roda o build e o token entra no bundle). */
const BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";
const PRODUCTION_HOSTS = new Set(["anaheimhub.com", "www.anaheimhub.com"]);

export function shouldLoadAnalytics(token: string | undefined, hostname: string): token is string {
  return Boolean(token && token.trim()) && PRODUCTION_HOSTS.has(hostname);
}

export function initAnalytics(token = import.meta.env.VITE_CF_BEACON_TOKEN as string | undefined) {
  if (typeof document === "undefined") return;
  if (!shouldLoadAnalytics(token, window.location.hostname)) return;
  if (document.querySelector(`script[src="${BEACON_SRC}"]`)) return;
  const script = document.createElement("script");
  script.defer = true;
  script.src = BEACON_SRC;
  script.setAttribute("data-cf-beacon", JSON.stringify({ token: token.trim(), spa: true }));
  document.head.appendChild(script);
}
