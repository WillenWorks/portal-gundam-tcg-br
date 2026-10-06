/**
 * Dicionário canônico de keywords, mecânicas, gatilhos e passos de jogo.
 *
 * REGRA FIXADA (docs/17-glossario-traducao.md):
 * O nome oficial da keyword em inglês NUNCA é traduzido (<Blocker>, <Breach N>,
 * 【Deploy】, Link, etc.), preservando o vocabulário oficial usado em torneios
 * e cartas importadas. Apenas a explicação mecânica é disponibilizada em português,
 * com interpolação precisa de valores (ex.: Breach 2, Repair 1, Support 3).
 */

import type { CardLanguage, KeywordCategory, KeywordDefinition, PhaseStepLabel } from "./types";

interface BaseKeywordSpec {
  id: string;
  name: string;
  raw: string;
  category: KeywordCategory;
  hasValue?: boolean;
  rulesSection?: string;
  formatPt: (value?: number | string) => string;
  formatEn: (value?: number | string) => string;
  examplePt?: string;
  exampleEn?: string;
}

const KEYWORD_SPECS: BaseKeywordSpec[] = [
  // ── Keywords de efeito (Comprehensive Rules, Seção 13) ───────────────
  {
    id: "blocker",
    name: "Blocker",
    raw: "<Blocker>",
    category: "effect_keyword",
    rulesSection: "CR 13-1-1",
    formatPt: () =>
      "Quando o oponente declara ataque, você pode descansar esta Unidade para mudar o alvo do ataque para ela.",
    formatEn: () =>
      "When an opponent declares an attack, you may rest this Unit to change the attack target to this Unit.",
    examplePt: "Protege outra Unidade ou seu escudo redirecionando o dano de batalha para o Blocker.",
    exampleEn: "Protects another Unit or your shield area by redirecting battle damage.",
  },
  {
    id: "breach",
    name: "Breach",
    raw: "<Breach N>",
    category: "effect_keyword",
    hasValue: true,
    rulesSection: "CR 13-1-2",
    formatPt: (v) =>
      `Quando esta Unidade destrói uma Unidade inimiga com dano de batalha DURANTE O SEU TURNO, causa ${v ?? "N"} de dano direto na primeira carta da área de escudo do oponente (a Base, se houver, senão o escudo do topo).`,
    formatEn: (v) =>
      `When this Unit destroys an enemy Unit with battle damage DURING YOUR TURN, deal ${v ?? "N"} direct damage to the first card in the opponent's shield area (the Base, or the top shield).`,
    examplePt: "Dano extra de penetração além da batalha regular. Ativa mesmo se as duas Unidades se destruírem mutuamente.",
    exampleEn: "Deals additional penetration damage when destroying an enemy Unit in battle on your turn.",
  },
  {
    id: "repair",
    name: "Repair",
    raw: "<Repair N>",
    category: "effect_keyword",
    hasValue: true,
    rulesSection: "CR 13-1-3",
    formatPt: (v) =>
      `No fim do seu turno, esta Unidade recupera ${v ?? "N"} pontos de HP.`,
    formatEn: (v) =>
      `At the end of your turn, this Unit recovers ${v ?? "N"} HP.`,
    examplePt: "Cura acumulativa aplicada no fechamento do seu turno, limitada ao HP máximo impresso/efetivo da carta.",
    exampleEn: "Heals damage at the end of your turn up to the Unit's effective HP limit.",
  },
  {
    id: "high-maneuver",
    name: "High-Maneuver",
    raw: "<High-Maneuver>",
    category: "effect_keyword",
    rulesSection: "CR 13-1-4",
    formatPt: () =>
      "Esta Unidade não pode ser bloqueada. Ataques dela sempre atingem o alvo original escolhido, mesmo que o oponente tenha Blocker disponível.",
    formatEn: () =>
      "This Unit cannot be blocked. Its attacks cannot be redirected by Blocker.",
    examplePt: "Ignora unidades com <Blocker> do oponente na declaração de ataque.",
    exampleEn: "Bypasses all enemy Blocker units.",
  },
  {
    id: "first-strike",
    name: "First Strike",
    raw: "<First Strike>",
    category: "effect_keyword",
    rulesSection: "CR 13-1-5",
    formatPt: () =>
      "Durante uma batalha, esta Unidade causa dano de batalha ANTES da Unidade inimiga. Se o dano for suficiente para destruir o alvo, o inimigo não chega a causar dano de volta.",
    formatEn: () =>
      "During battle, this Unit deals battle damage BEFORE the enemy Unit. If the damage destroys the enemy, it deals no return damage.",
    examplePt: "Se destruir a unidade defensora antecipadamente, sobrevive ilesa à batalha.",
    exampleEn: "Wins trades without taking damage if dealing lethal damage first.",
  },
  {
    id: "suppression",
    name: "Suppression",
    raw: "<Suppression>",
    category: "effect_keyword",
    rulesSection: "CR 13-1-6",
    formatPt: () =>
      "Quando o dano de batalha desta Unidade atinge a área de escudo do oponente, atinge os 2 primeiros escudos simultaneamente, em vez de apenas 1.",
    formatEn: () =>
      "When this Unit deals battle damage to the opponent's shield area, damage is dealt to the top 2 shields simultaneously.",
    examplePt: "Quebra dois escudos de uma só vez com um único ataque.",
    exampleEn: "Breaks two shields simultaneously with a single direct hit.",
  },
  {
    id: "support",
    name: "Support",
    raw: "<Support N>",
    category: "effect_keyword",
    hasValue: true,
    rulesSection: "CR 13-1-7",
    formatPt: (v) =>
      `Descansando esta Unidade durante a sua Fase Principal, você concede AP+${v ?? "N"} para 1 outra Unidade aliada durante este turno.`,
    formatEn: (v) =>
      `By resting this Unit during your Main Phase, 1 of your other Units gets AP+${v ?? "N"} during this turn.`,
    examplePt: "Habilidade de suporte tático que descansa a carta em campo para turbinar o ataque de uma aliada.",
    exampleEn: "Rests to buff another friendly unit's AP for the rest of the turn.",
  },

  // ── Gatilhos e limites (Comprehensive Rules, Seções 9–11) ───────────
  {
    id: "deploy",
    name: "Deploy",
    raw: "【Deploy】",
    category: "trigger_keyword",
    rulesSection: "CR 9-2",
    formatPt: () =>
      "Ativa automaticamente no instante em que a carta entra em jogo no campo de batalha.",
    formatEn: () =>
      "Activates automatically when this card is deployed to the field.",
  },
  {
    id: "burst",
    name: "Burst",
    raw: "【Burst】",
    category: "trigger_keyword",
    rulesSection: "CR 10-3",
    formatPt: () =>
      "Ativa quando esta carta é revelada na área de escudo ao receber dano de batalha, concedendo um efeito imediato antes de ir para a lixeira.",
    formatEn: () =>
      "Activates when this card is revealed from the shield area upon taking battle damage.",
  },
  {
    id: "when-paired",
    name: "When Paired",
    raw: "【When Paired】",
    category: "trigger_keyword",
    rulesSection: "CR 9-4",
    formatPt: () =>
      "Dispara no exato momento em que um Piloto é pareado com esta Unidade.",
    formatEn: () =>
      "Triggers the exact moment a Pilot is paired with this Unit.",
  },
  {
    id: "during-pair",
    name: "During Pair",
    raw: "【During Pair】",
    category: "trigger_keyword",
    rulesSection: "CR 9-4",
    formatPt: () =>
      "Efeito estático continuamente ativo enquanto esta Unidade estiver pareada com um Piloto.",
    formatEn: () =>
      "Continuous static effect active as long as this Unit is paired with a Pilot.",
  },
  {
    id: "during-link",
    name: "During Link",
    raw: "【During Link】",
    category: "trigger_keyword",
    rulesSection: "CR 9-4",
    formatPt: () =>
      "Efeito estático continuamente ativo enquanto esta Unidade estiver linkada com o Piloto indicado no seu requisito de Link.",
    formatEn: () =>
      "Continuous static effect active as long as this Unit satisfies its Link requirement.",
  },
  {
    id: "activate-main",
    name: "Activate･Main",
    raw: "【Activate･Main】",
    category: "trigger_keyword",
    rulesSection: "CR 9-3",
    formatPt: () =>
      "Habilidade de ativação manual que pode ser declarada durante a sua Fase Principal, pagando os custos especificados.",
    formatEn: () =>
      "Manual activation ability that can be used during your Main Phase by paying costs.",
  },
  {
    id: "activate-action",
    name: "Activate･Action",
    raw: "【Activate･Action】",
    category: "trigger_keyword",
    rulesSection: "CR 9-3",
    formatPt: () =>
      "Habilidade de ativação manual utilizável durante a Etapa de Ação de uma batalha ou na Etapa de Ação da Fase Final.",
    formatEn: () =>
      "Manual activation ability usable during an Action Step in combat or the End Phase.",
  },
  {
    id: "attack",
    name: "Attack",
    raw: "【Attack】",
    category: "trigger_keyword",
    rulesSection: "CR 8-2",
    formatPt: () =>
      "Dispara no momento em que esta Unidade é descansada para declarar um ataque.",
    formatEn: () =>
      "Triggers when this Unit is rested to declare an attack.",
  },
  {
    id: "destroyed",
    name: "Destroyed",
    raw: "【Destroyed】",
    category: "trigger_keyword",
    rulesSection: "CR 11-1",
    formatPt: () =>
      "Dispara quando esta carta é destruída em batalha ou por efeito e enviada para o lixo.",
    formatEn: () =>
      "Triggers when this card is destroyed and sent to the trash.",
  },
  {
    id: "once-per-turn",
    name: "Once per Turn",
    raw: "【Once per Turn】",
    category: "trigger_keyword",
    rulesSection: "CR 9-1",
    formatPt: () =>
      "Limite de resolução: esta habilidade só pode ser ativada uma única vez por turno por esta carta.",
    formatEn: () =>
      "Usage limit: this effect can only be activated once per turn by this card instance.",
  },

  // ── Mecânicas gerais ────────────────────────────────────────────────
  {
    id: "link",
    name: "Link",
    raw: "Link",
    category: "mechanic",
    rulesSection: "CR 9-4",
    formatPt: () =>
      "Condição de afinidade de Piloto (por nome ou característica). Quando cumprida, ativa efeitos estáticos 【During Link】 e bônus da Unidade.",
    formatEn: () =>
      "Pilot affinity condition (by name or trait) that unlocks 【During Link】 abilities.",
  },
  {
    id: "ex-resource",
    name: "EX Resource",
    raw: "EX Resource",
    category: "mechanic",
    rulesSection: "CR 7-3",
    formatPt: () =>
      "Recurso adicional concedido na Área de Recursos (máximo 5). Pode ser descansado para pagar custo ou nível como um recurso normal.",
    formatEn: () =>
      "Bonus resource placed in the resource area (maximum 5), usable to pay costs.",
  },
  {
    id: "development",
    name: "Development",
    raw: "Development N",
    category: "mechanic",
    hasValue: true,
    rulesSection: "CR 9-5",
    formatPt: (v) =>
      `Mecânica avançada: exile ${v ?? "N"} cartas com a característica especificada da sua lixeira para ativar o efeito subsequente (■).`,
    formatEn: (v) =>
      `Exile ${v ?? "N"} cards with the specified trait from your trash to activate the subsequent effect (■).`,
    examplePt: "Exila cartas do descarte para pagar o custo alternativo do efeito.",
    exampleEn: "Exiles cards from trash to satisfy the development cost.",
  },
  {
    id: "rest",
    name: "Rest",
    raw: "Rest",
    category: "mechanic",
    rulesSection: "CR 5-2",
    formatPt: () =>
      "Estado descansado (carta na horizontal). Indica que a carta já agiu, atacou ou pagou um custo neste turno.",
    formatEn: () =>
      "Exhausted/rested state (horizontal orientation), showing the card has acted or paid cost.",
  },
  {
    id: "active",
    name: "Active",
    raw: "Active",
    category: "mechanic",
    rulesSection: "CR 5-2",
    formatPt: () =>
      "Estado ativo (carta na vertical). Indica que a carta está pronta para atacar, agir ou usar habilidades.",
    formatEn: () =>
      "Ready/active state (vertical orientation), available to attack or use abilities.",
  },
];

// ── Rótulos de Fases e Etapas (Comprehensive Rules Seções 7 e 8) ──────
export const PHASE_STEP_LABELS: Record<string, PhaseStepLabel> = {
  // Fases do Turno
  start_phase: {
    id: "start_phase",
    pt: "Fase de Início",
    en: "Start Phase",
    detailPt: "Reativa todas as cartas descansadas do jogador ativo.",
    detailEn: "Sets all rested cards of the active player to active.",
  },
  draw_phase: {
    id: "draw_phase",
    pt: "Fase de Compra",
    en: "Draw Phase",
    detailPt: "Compra exatamente 1 carta do topo do deck.",
    detailEn: "Draw 1 card from the top of the deck.",
  },
  resource_phase: {
    id: "resource_phase",
    pt: "Fase de Recurso",
    en: "Resource Phase",
    detailPt: "Coloca 1 carta de Recurso da mão ou EX Resource na área de recursos.",
    detailEn: "Place 1 resource card into the resource area.",
  },
  main_phase: {
    id: "main_phase",
    pt: "Fase Principal",
    en: "Main Phase",
    detailPt: "Jogue cartas, declare ataques e ative habilidades 【Activate･Main】.",
    detailEn: "Play cards, declare attacks, and activate main abilities.",
  },
  end_phase: {
    id: "end_phase",
    pt: "Fase Final",
    en: "End Phase",
    detailPt: "Etapas finais do turno, incluindo ação, cura <Repair> e limite de mão.",
    detailEn: "End-of-turn steps, action windows, Repair triggers, and hand size limit.",
  },

  // Etapas de Batalha (Combat Steps)
  attack_step: {
    id: "attack_step",
    pt: "Etapa de Ataque",
    en: "Attack Step",
    detailPt: "Declaração de atacante e escolha do alvo (Unidade em Rest, Base ou Escudo).",
    detailEn: "Attacker declaration and target choice.",
  },
  blocker_step: {
    id: "blocker_step",
    pt: "Etapa de Bloqueio",
    en: "Blocker Step",
    detailPt: "Defensor pode descansar uma Unidade com <Blocker> para redirecionar o ataque.",
    detailEn: "Defender may rest a Unit with <Blocker> to redirect the attack.",
  },
  action_step: {
    id: "action_step",
    pt: "Etapa de Ação",
    en: "Action Step",
    detailPt: "Jogadores alternam prioridade para jogar cartas de Comando e efeitos 【Activate･Action】.",
    detailEn: "Players alternate priority to play Command cards and action abilities.",
  },
  damage_step: {
    id: "damage_step",
    pt: "Etapa de Dano",
    en: "Damage Step",
    detailPt: "Resolução do dano de batalha (simultâneo, salvo First Strike).",
    detailEn: "Battle damage resolution (simultaneous, unless First Strike applies).",
  },
  end_battle_step: {
    id: "end_battle_step",
    pt: "Etapa Final da Batalha",
    en: "End of Battle Step",
    detailPt: "Expiração de efeitos temporários 'durante esta batalha'.",
    detailEn: "Expiration of 'during this battle' effects.",
  },

  // Etapas da Fase Final
  end_action_step: {
    id: "end_action_step",
    pt: "Etapa de Ação Final",
    en: "End Action Step",
    detailPt: "Janela de ação da Fase Final. O jogador em espera tem prioridade.",
    detailEn: "End Phase action window. Waiting player acts first.",
  },
  end_resolution_step: {
    id: "end_resolution_step",
    pt: "Etapa Final",
    en: "End Step",
    detailPt: "Disparo e resolução de efeitos de 'fim de turno' (ex.: <Repair>).",
    detailEn: "Triggers and resolves 'end of turn' abilities such as <Repair>.",
  },
  hand_limit_step: {
    id: "hand_limit_step",
    pt: "Etapa de Limite da Mão",
    en: "Hand Limit Step",
    detailPt: "Descarte de cartas da mão até o limite máximo de 10 cartas.",
    detailEn: "Discards down to the hand size limit of 10 cards.",
  },
  cleanup_step: {
    id: "cleanup_step",
    pt: "Etapa de Limpeza",
    en: "Cleanup Step",
    detailPt: "Expiração de efeitos 'durante este turno' e transferência do turno.",
    detailEn: "Expiration of 'during this turn' effects and passing the turn.",
  },
};

/**
 * Analisa uma string de keyword ou tag bruta (ex: "<Breach 2>", "Repair 1", "【Deploy】", "Development 3")
 * e extrai o nome base, valor numérico e formato padronizado.
 */
export function parseKeywordValue(raw: string): {
  id: string;
  name: string;
  value?: number;
  cleanTag: string;
} {
  const trimmed = raw.trim();
  // Remove delimitadores < >, 【 】, [ ] para encontrar o núcleo
  const inner = trimmed.replace(/^[<【[]+|[>】\]]+$/g, "").trim();

  // Expressão para pegar nome + valor opcional (ex: "Breach 2", "Repair 1", "Support 3", "Development 2")
  const match = inner.match(/^([A-Za-z\-･\s]+?)(?:\s+(\d+))?$/);
  if (!match) {
    return {
      id: inner.toLowerCase().replace(/[\s･]+/g, "-"),
      name: inner,
      cleanTag: trimmed,
    };
  }

  const baseName = match[1].trim();
  const value = match[2] ? Number.parseInt(match[2], 10) : undefined;
  const id = baseName.toLowerCase().replace(/[\s･]+/g, "-");

  return {
    id,
    name: baseName,
    value,
    cleanTag: trimmed,
  };
}

/**
 * Retorna a definição completa da keyword ou mecânica com interpolação de valor se presente.
 */
export function getKeywordDefinition(
  rawOrName: string,
  _lang: CardLanguage = "PT_BR",
): KeywordDefinition | undefined {
  if (!rawOrName) return undefined;
  const parsed = parseKeywordValue(rawOrName);

  // Busca na lista de especificações pelo id ou nome
  const spec = KEYWORD_SPECS.find(
    (s) =>
      s.id === parsed.id ||
      s.name.toLowerCase() === parsed.name.toLowerCase() ||
      s.raw.toLowerCase() === parsed.cleanTag.toLowerCase(),
  );

  if (!spec) {
    // Tenta encontrar por prefixo em casos como "When Paired･(White Base Team) Pilot"
    const prefixSpec = KEYWORD_SPECS.find((s) => parsed.name.toLowerCase().startsWith(s.name.toLowerCase()));
    if (prefixSpec) {
      return {
        id: prefixSpec.id,
        name: parsed.name,
        raw: parsed.cleanTag,
        category: prefixSpec.category,
        hasValue: prefixSpec.hasValue,
        value: parsed.value,
        descriptionPt: prefixSpec.formatPt(parsed.value),
        descriptionEn: prefixSpec.formatEn(parsed.value),
        examplePt: prefixSpec.examplePt,
        exampleEn: prefixSpec.exampleEn,
        rulesSection: prefixSpec.rulesSection,
      };
    }
    return undefined;
  }

  const rawDisplay = spec.hasValue && parsed.value !== undefined
    ? spec.raw.replace(/N\b/, String(parsed.value))
    : spec.raw;

  return {
    id: spec.id,
    name: spec.hasValue && parsed.value !== undefined ? `${spec.name} ${parsed.value}` : spec.name,
    raw: rawDisplay,
    category: spec.category,
    hasValue: spec.hasValue,
    value: parsed.value,
    descriptionPt: spec.formatPt(parsed.value),
    descriptionEn: spec.formatEn(parsed.value),
    examplePt: spec.examplePt,
    exampleEn: spec.exampleEn,
    rulesSection: spec.rulesSection,
  };
}

/**
 * Traduz rótulos de fases e etapas de combate ou turno.
 */
export function getPhaseStepLabel(key: string, lang: CardLanguage = "PT_BR"): string {
  if (!key) return "";
  const normalized = key.toLowerCase().replace(/[\s-]+/g, "_");
  const found = PHASE_STEP_LABELS[normalized];
  if (found) {
    return lang === "EN" ? found.en : found.pt;
  }

  // Alias para passos comuns do simulador (ex.: "attack", "action", "block")
  const aliasMap: Record<string, string> = {
    attack: "attack_step",
    block: "blocker_step",
    blocker: "blocker_step",
    action: "action_step",
    damage: "damage_step",
    end: "end_battle_step",
    battle_end: "end_battle_step",
    start: "start_phase",
    draw: "draw_phase",
    resource: "resource_phase",
    main: "main_phase",
    cleanup: "cleanup_step",
  };

  const aliasKey = aliasMap[normalized];
  if (aliasKey && PHASE_STEP_LABELS[aliasKey]) {
    const item = PHASE_STEP_LABELS[aliasKey];
    return lang === "EN" ? item.en : item.pt;
  }

  return key;
}

/**
 * Lista de todas as definições base de keywords para uso em índices, tooltips e autocompletes.
 */
export const ALL_KEYWORDS: KeywordDefinition[] = KEYWORD_SPECS.map((s) => ({
  id: s.id,
  name: s.name,
  raw: s.raw,
  category: s.category,
  hasValue: s.hasValue,
  descriptionPt: s.formatPt(),
  descriptionEn: s.formatEn(),
  examplePt: s.examplePt,
  exampleEn: s.exampleEn,
  rulesSection: s.rulesSection,
}));
