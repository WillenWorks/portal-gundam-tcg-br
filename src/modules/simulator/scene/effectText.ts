/* Spec simulador-cadencia-de-mesa (P5) — o texto de um gatilho da carta, para o banner pequeno do topo ("Escolha 1
 * Unidade inimiga. Cause 2 de dano a ela."). O texto da carta vem em formatos diferentes ("[Burst] …<br>…",
 * "【Burst】…\n…"); aqui sai só o trecho do gatilho, sem HTML. */

const TAG = /[【[]\s*([^】\]]+?)\s*[】\]]/g;

function plain(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "");
}

/** o trecho de `trigger` (ex.: "Burst") no texto da carta; `null` se a carta não tem esse gatilho */
export function triggerEffectText(text: string | undefined, trigger: string): string | null {
  if (!text) return null;
  const clean = plain(text);
  const lines = clean.split("\n");
  for (const line of lines) {
    TAG.lastIndex = 0;
    const tags = [...line.matchAll(TAG)];
    const at = tags.find((m) => m[1].toLowerCase() === trigger.toLowerCase());
    if (!at || at.index === undefined) continue;
    const start = at.index + at[0].length;
    // até o próximo gatilho na mesma linha (palavras-chave como 【Once per Turn】 fazem parte do texto)
    const nextTrigger = tags.find((m) => m.index !== undefined && m.index > at.index! && /^(burst|deploy|attack|destroyed|main|action|activate)/i.test(m[1]));
    const end = nextTrigger?.index ?? line.length;
    const body = line.slice(start, end).trim();
    if (body) return body;
  }
  return null;
}
