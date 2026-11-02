const ALLOWED_IMAGE_URL = /^(https?:\/\/|\/(?!\/))/i;

/** Só URL http(s) ou caminho do próprio site vira imagem; o resto, como `javascript:` ou `//host`, é descartado. */
export function safeImageSrc(value: unknown): string {
  const url = String(value ?? "").trim();
  if (!ALLOWED_IMAGE_URL.test(url)) return "";
  // estes caracteres nunca aparecem crus numa URL válida e permitiriam sair do atributo em HTML
  return url.replace(/[<>"'`]/g, "");
}
