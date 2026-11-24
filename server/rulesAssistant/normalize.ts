/**
 * Texto → termos de busca do assistente de regras (pt-BR, com o vocabulário oficial em inglês misturado).
 * Minúsculas, sem acento, stemming leve e sinônimos do jogo: "bloqueador" e "Blocker" viram o mesmo termo.
 */

const STOPWORDS = new Set(
  (
    "a o as os um uma uns umas de da do das dos em na no nas nos por pra pro para com sem sob sobre e ou que se " +
    "ao aos me te lhe eu voce voces ele ela eles elas meu minha meus minhas seu sua seus suas isso isto esse essa " +
    "este esta ja nao sim mais menos muito muita como quando onde qual quais quem tem ter ha foi ser esta estao " +
    "posso pode podem consigo da vai vou fica ficar entao mas tambem so todo toda todos todas outro outra " +
    "the an of to in on at for with is are be can does do if it its this that my your when what which or and as by from"
  ).split(/\s+/),
);

/** grupos de sinônimos: o 1º é o termo canônico (o nome oficial, normalizado e sem espaço) */
const SYNONYM_GROUPS: string[][] = [
  ["blocker", "bloqueador", "bloqueadora", "bloquear", "bloqueio", "bloqueia", "bloquea", "block"],
  ["firststrike", "first strike", "primeiro ataque", "ataque primeiro", "golpe primeiro"],
  ["repair", "reparo", "reparar", "repara", "curar", "cura"],
  ["breach", "violar", "violacao", "brecha"],
  ["highmaneuver", "high maneuver", "high-maneuver", "alta manobra"],
  ["suppression", "supressao", "suprimir"],
  ["support", "apoio", "suporte"],
  ["deploy", "implantar", "implantada", "implantado", "implantacao", "entrar em jogo", "entra em jogo", "baixar", "descer", "colocar em campo", "por em campo", "colocar outra", "colocar uma", "colocar"],
  ["battlearea", "battle area", "area de batalha", "campo", "mesa"],
  ["burst", "explosao"],
  ["whenpaired", "when paired", "ao parear", "quando pareado", "quando parear"],
  ["duringpair", "during pair", "enquanto pareado", "durante pareamento"],
  ["duringlink", "during link", "enquanto linkado"],
  ["whenlinked", "when linked", "quando linkado", "ao linkar"],
  ["onceperturn", "once per turn", "uma vez por turno", "1 vez por turno"],
  ["destroyed", "destruido", "destruida", "destruir", "destroi", "destroy"],
  ["shield", "escudo", "escudos", "shields"],
  ["resource", "recurso", "recursos", "resources"],
  ["exresource", "ex resource", "recurso ex"],
  ["pilot", "piloto", "pilotos", "pilots"],
  ["pair", "parear", "pareado", "pareada", "pareamento", "paired", "emparelhar"],
  ["link", "linkar", "linkado", "linkada", "linked"],
  ["unit", "unidade", "unidades", "units"],
  ["command", "comando", "comandos", "commands"],
  ["base", "bases"],
  ["token", "tokens", "ficha"],
  ["rest", "descansar", "descansada", "descansado", "descansa", "rested", "virar", "virada", "virado"],
  ["active", "ativa", "ativo", "ativar", "desvirar", "set active"],
  ["damage", "dano", "danos"],
  ["attack", "atacar", "ataque", "ataca", "atacando", "attacking"],
  ["draw", "comprar", "compra", "compro", "puxar"],
  ["hand", "mao", "maos"],
  ["deck", "baralho"],
  ["trash", "descarte", "cemiterio", "lixo", "lixeira"],
  ["level", "nivel", "lv", "lvl"],
  ["cost", "custo"],
  ["mulligan", "trocar a mao", "trocar mao"],
  ["turn", "turno", "turnos"],
  ["phase", "fase", "fases"],
  ["step", "etapa", "passo"],
  ["effect", "efeito", "efeitos", "habilidade", "habilidades"],
  ["activatemain", "activate main", "ativar principal"],
  ["activateaction", "activate action", "ativar acao"],
  ["action", "acao", "acoes"],
  ["main", "principal"],
  ["battle", "batalha", "combate"],
  ["opponent", "oponente", "adversario", "inimigo"],
];

const SYNONYMS = new Map<string, string>();
/** sinônimos de várias palavras, do mais longo para o mais curto (troca antes de quebrar em termos) */
const PHRASES: Array<[RegExp, string]> = [];

export function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** minúsculas, sem acento, só letras/números/espaço */
export function normalizeText(text: string): string {
  return stripAccents(String(text ?? "").toLowerCase())
    .replace(/[【】<>«»"“”'’`]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

for (const group of SYNONYM_GROUPS) {
  const canonical = group[0];
  for (const raw of group) {
    const term = normalizeText(raw);
    if (term.includes(" ")) PHRASES.push([new RegExp(`\\b${term}\\b`, "g"), canonical]);
    else SYNONYMS.set(term, canonical);
  }
}
PHRASES.sort((a, b) => b[0].source.length - a[0].source.length);

/** stemming leve de pt: plural e sufixos comuns (só o bastante para "pareadas" ≈ "pareado") */
export function stem(word: string): string {
  if (word.length <= 3 || /\d/.test(word)) return word;
  let w = word;
  if (w.endsWith("coes")) w = `${w.slice(0, -4)}cao`;
  else if (w.endsWith("oes")) w = `${w.slice(0, -3)}ao`;
  else if (w.endsWith("aes")) w = `${w.slice(0, -3)}ao`;
  else if (w.endsWith("is") && w.length > 4) w = `${w.slice(0, -2)}l`;
  else if (w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.endsWith("mente") && w.length > 7) w = w.slice(0, -5);
  if (/[ao]$/.test(w) && w.length > 4) w = w.slice(0, -1);
  return w;
}

/** termos de busca: frases-sinônimo → termo canônico, stopwords fora, stem no resto */
export function tokenize(text: string): string[] {
  let t = ` ${normalizeText(text)} `;
  for (const [re, canonical] of PHRASES) t = t.replace(re, ` ${canonical} `);
  const out: string[] = [];
  for (const word of t.split(" ")) {
    if (!word || STOPWORDS.has(word)) continue;
    const syn = SYNONYMS.get(word);
    if (syn) out.push(syn);
    else if (word.length > 1) out.push(stem(word));
  }
  return out;
}

/** termo canônico de uma keyword pelo nome oficial ("First Strike" → "firststrike"), ou null */
export function canonicalTerm(name: string): string | null {
  const term = normalizeText(name);
  if (!term) return null;
  const tokens = tokenize(name);
  if (tokens.length === 1) return tokens[0];
  return SYNONYMS.get(term.replace(/\s+/g, "")) ?? term.replace(/\s+/g, "");
}

/** pergunta normalizada para cache e agrupamento de perguntas repetidas */
export function questionKey(text: string): string {
  return tokenize(text).join(" ");
}
