/* Traducao dos titulos de categoria de ruling (campo `title` no banco) para PT-BR.
 *
 * Regra fixada com o Willen (ver docs/17-glossario-traducao.md): a KEYWORD em si
 * nunca traduz (Burst, Blocker, Deploy, Repair etc. ficam exatamente como no card
 * ou nas regras oficiais, sempre em ingles) -- só a explicação mecânica vira PT-BR.
 * Por isso os titulos que SAO nome de keyword ficam de fora deste mapa de proposito
 * (Activate, Attack, Blocker, Burst, Command, Deploy, Destroyed, Development,
 * During Pair, First Strike, HP, Link, Once per Turn, Repair, Token, When Paired).
 * Os demais titulos aqui sao nomes estruturais/de fase que nao aparecem impressos
 * em nenhuma carta, entao traduzir ajuda o jogador que esta aprendendo.
 */
const RULE_TITLE_LABELS_PT: Record<string, string> = {
  "Preparing to Play": "Preparação para Jogar",
  "Turn Flow": "Fluxo do Turno",
  "Start Phase": "Fase de Início",
  "Draw Phase": "Fase de Compra",
  "Resource Phase": "Fase de Recurso",
  "Main Phase: Playing Cards": "Fase Principal: Jogando Cartas",
  "Main Phase: Activating Card Effects": "Fase Principal: Ativando Efeitos de Carta",
  "Main Phase: Unit Attacks": "Fase Principal: Ataques de Unidade",
  "End Phase": "Fase Final",
  "Action Steps": "Etapa de Ação",
  "Effect Activation and Resolution": "Ativação e Resolução de Efeitos",
  "Rules Management": "Gerenciamento de Regras",
  "Fundamental Terminology": "Terminologia Fundamental",
  Damage: "Dano",
};

export function translateRuleTitle(title: string | undefined | null): string {
  if (!title) return "";
  return RULE_TITLE_LABELS_PT[title] ?? title;
}
