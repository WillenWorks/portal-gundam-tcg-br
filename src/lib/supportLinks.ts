/* Links de apoio que dependem do .env (VITE_*, compilados no build). Só URL https vale; sem a variável, o link some. */

function httpsUrl(value: unknown): string {
  const url = String(value ?? "").trim();
  return /^https:\/\/[^\s"'<>`]+$/.test(url) ? url : "";
}

/** Campanha mensal (Apoia.se). */
export const SUPPORT_URL = httpsUrl(import.meta.env.VITE_SUPPORT_URL);
/** Perfil do Instagram. */
export const INSTAGRAM_URL = httpsUrl(import.meta.env.VITE_INSTAGRAM_URL);
/** Convite do servidor do Discord. */
export const DISCORD_URL = httpsUrl(import.meta.env.VITE_DISCORD_INVITE_URL);
