/**
 * Endereço público do site usado nos links de e-mail (confirmação de conta e redefinição de senha).
 *
 * Por quê: antes a URL vinha do cabeçalho `X-Forwarded-Host`/`Host` da própria requisição. Quem pedisse
 * "esqueci a senha" para o e-mail de outra pessoa com `X-Forwarded-Host: site-falso.com` fazia o e-mail
 * legítimo levar um token válido para o site falso. Agora o cabeçalho só vale se a origem montada estiver
 * na lista de origens permitidas (`ALLOWED_ORIGINS`); fora isso vale a URL fixa do ambiente.
 */
export type PublicUrlRequest = {
  get(name: string): string | undefined;
  protocol?: string;
};

export type PublicUrlOptions = {
  allowedOrigins: string[];
  envUrl?: string;
  isRemote: boolean;
  productionUrl?: string;
  localUrl?: string;
};

const isLocal = (url: string) => url.includes("localhost") || url.includes("127.0.0.1");
const trim = (url: string) => url.replace(/\/+$/, "");

export function resolvePublicAppUrl(req: PublicUrlRequest | undefined, options: PublicUrlOptions): string {
  const { allowedOrigins, envUrl, isRemote, productionUrl = "https://anaheimhub.com", localUrl = "http://localhost:8787" } = options;
  const allowed = new Set(allowedOrigins.map(trim));

  if (req) {
    const host = req.get("x-forwarded-host") || req.get("host");
    const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
    if (host) {
      const origin = trim(`${proto}://${host.split(",")[0].trim()}`);
      if (allowed.has(origin)) return origin;
    }
  }

  const env = envUrl?.trim();
  if (env && !isLocal(env)) return trim(env);
  if (isRemote) return productionUrl;
  return env ? trim(env) : localUrl;
}
