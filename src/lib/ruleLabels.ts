/* Traducao dos titulos de categoria de ruling (campo `title` no banco) para PT-BR.
 *
 * Regra fixada (ver docs/17-glossario-traducao.md): a KEYWORD em si
 * nunca traduz (Burst, Blocker, Deploy, Repair, Breach, Support, High-Maneuver etc.
 * ficam exatamente como no card ou nas regras oficiais, sempre em ingles) --
 * só a explicação mecânica vira PT-BR.
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
  Color: "Cor",
  Target: "Alvo",
  Unit: "Unidade",
  Pilot: "Piloto",
  Command: "Comando",
  Miscellaneous: "Geral / Diversos",
  Repair: "Repair",
  Breach: "Breach",
  Support: "Support",
  Blocker: "Blocker",
  "First Strike": "First Strike",
  "High-Maneuver": "High-Maneuver",
  Suppression: "Suppression",
  Activate: "Activate",
  Burst: "Burst",
  Deploy: "Deploy",
  Attack: "Attack",
  Destroyed: "Destroyed",
  "When Paired": "When Paired",
  "During Pair": "During Pair",
  "Once per Turn": "Once per Turn",
  Token: "Token",
  AP: "AP",
  HP: "HP",
};

export function translateRuleTitle(title: string | undefined | null): string {
  if (!title) return "";
  return RULE_TITLE_LABELS_PT[title] ?? title;
}
