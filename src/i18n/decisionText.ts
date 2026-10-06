/**
 * Resolução multilíngue para decisões interativas do simulador (PendingDecision)
 * e do AbilityResolutionModal, em conformidade com CONTRATO-MOTOR §1, §3, §4 e §8.
 *
 * O motor puro opera com o texto oficial em inglês (`label`/`sourceText`).
 * A camada de UI/i18n traduz o conteúdo para pt-BR casando por `cardCode` e gatilho
 * (【Deploy】, 【Attack】, 【When Paired】, 【Burst】, etc.), preservando os nomes
 * originais em EN quando a conta estiver configurada para inglês ou a tradução estiver pendente.
 */

import { cardText, extractCardSections, normalizeTrigger } from "./cardText";
import type { CardLanguage, CardTextInput } from "./types";

/**
 * Expressão regular para extrair o código da carta de identificadores como specId
 * (ex.: "ST01-010-WhenPaired", "GD01-044-WhenPaired", "ST03-015-Deploy-Damage", "EB01-022-Attack", "T-025-Deploy").
 */
const CARD_CODE_REGEX = /^([A-Z0-9]+-[0-9]{3})/i;

/**
 * Extrai o código da carta a partir de um specId ou identificador sintético.
 */
export function extractCardCodeFromSpecId(specId?: string | null): string | null {
  if (!specId) return null;
  const match = specId.match(CARD_CODE_REGEX);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Cache global em memória de traduções de cartas para suporte síncrono a decisões do simulador.
 */
const cardTranslationRegistry = new Map<string, CardTextInput>();

/**
 * Mapeamento inicial embutido para as principais cartas de teste e do catálogo inicial.
 */
const INITIAL_TRANSLATIONS: Record<string, { effectPt: string; effectEn?: string }> = {
  "ST01-010": {
    effectPt: "【When Paired】Escolha 1 Unidade inimiga. Descanse-a.",
    effectEn: "【When Paired】Choose 1 enemy Unit. Rest it.",
  },
  "ST01-011": {
    effectPt: "【Attack】Escolha 1 dos seus recursos. Coloque-o como ativo.",
    effectEn: "【Attack】Choose 1 of your resources. Set it as active.",
  },
  "ST02-015": {
    effectPt: "【Deploy】Olhe as 2 cartas do topo do seu deck e retorne 1 para o topo e 1 para o fundo.",
    effectEn: "【Deploy】Look at the top 2 cards of your deck and return 1 to the top and 1 to the bottom.",
  },
  "ST03-006": {
    effectPt: "【Destroyed】Olhe as 3 cartas do topo do seu deck. Você pode revelar 1 carta de Unidade (Zeon)/(Neo Zeon) entre elas e adicioná-la à sua mão. Retorne as cartas restantes aleatoriamente para o fundo.",
    effectEn: "【Destroyed】Look at the top 3 cards of your deck. You may reveal 1 (Zeon)/(Neo Zeon) Unit card among them and add it to your hand. Return the remaining cards randomly to the bottom.",
  },
  "ST03-010": {
    effectPt: "【When Paired】Você pode implantar 1 carta de Unidade (Neo Zeon)/(Zeon) de Lv.4 ou menor da sua mão.",
    effectEn: "【When Paired】You may deploy 1 (Neo Zeon)/(Zeon) Unit card Lv.4 or lower from your hand.",
  },
  "ST04-002": {
    effectPt: "【Deploy】Compre 1. Em seguida, descarte 1.",
    effectEn: "【Deploy】Draw 1. Then, discard 1.",
  },
  "ST04-012": {
    effectPt: "【Main】Implante 1 ficha de Unidade [Sword Strike] ou 1 [Launcher Strike].",
    effectEn: "【Main】Deploy 1 [Sword Strike] or 1 [Launcher Strike] Unit token.",
  },
  "ST05-010": {
    effectPt: "【When Paired】Escolha 1 das suas Unidades e 1 Unidade inimiga. Cause 1 de dano a elas.",
    effectEn: "【When Paired】Choose 1 of your Units and 1 enemy Unit. Deal 1 damage to them.",
  },
  "GD01-044": {
    effectPt: "【When Paired】Escolha até 2 Unidades inimigas. Cause 2 de dano a cada uma.",
    effectEn: "【When Paired】Choose up to 2 enemy Units. Deal 2 damage to each.",
  },
  "GD01-067": {
    effectPt: "【When Paired】Escolha 1 carta de Comando que seja Lv.5 ou menor da sua lixeira. Adicione-a à sua mão.",
    effectEn: "【When Paired】Choose 1 Command card that is Lv.5 or lower from your trash. Add it to your hand.",
  },
};

// Inicializa o registro com o conjunto canônico inicial
for (const [code, data] of Object.entries(INITIAL_TRANSLATIONS)) {
  cardTranslationRegistry.set(code, {
    code,
    effectPt: data.effectPt,
    effectEn: data.effectEn,
  });
}

/**
 * Registra dados de tradução de cartas (por exemplo, ao carregar /api/cards na partida).
 */
export function registerCardTranslations(
  cards: Array<CardTextInput | { code: string; effectPt?: string | null; effectEn?: string | null; textSections?: any; textSectionsJson?: any }>,
): void {
  for (const card of cards) {
    if (card && card.code) {
      cardTranslationRegistry.set(card.code.toUpperCase(), card as CardTextInput);
    }
  }
}

/**
 * Obtém uma carta registrada pelo código.
 */
export function getRegisteredCardTranslation(code?: string | null): CardTextInput | undefined {
  if (!code) return undefined;
  return cardTranslationRegistry.get(code.toUpperCase());
}

/**
 * Limpa o registro em memória (útil para testes unitários).
 */
export function clearCardTranslationRegistry(): void {
  cardTranslationRegistry.clear();
  for (const [code, data] of Object.entries(INITIAL_TRANSLATIONS)) {
    cardTranslationRegistry.set(code, {
      code,
      effectPt: data.effectPt,
      effectEn: data.effectEn,
    });
  }
}

export interface ResolveDecisionTextParams {
  /** Rótulo oficial em inglês retornado pelo motor (PendingDecision queue[i].label). */
  label: string;
  /** Identificador do spec de efeito (ex.: "ST01-010-WhenPaired"). */
  specId?: string;
  /** Código da carta caso já conhecido diretamente (ex.: "ST01-010"). */
  cardCode?: string;
  /** Gatilho do evento ou da habilidade (ex.: "Deploy", "Attack", "When Paired", "Burst"). */
  trigger?: string;
  /** Objeto da carta com effectPt/textSections já disponível no contexto. */
  card?: CardTextInput | null;
}

/**
 * Remove marcadores de gatilho de um texto de efeito para exibição limpa da cláusula.
 * Ex.: "【Deploy】Compre 1." -> "Compre 1."
 */
function stripTriggerPrefix(text: string, trigger?: string): string {
  if (!text) return "";
  let clean = text.trim();
  if (trigger) {
    const norm = normalizeTrigger(trigger);
    clean = clean.replace(new RegExp(`^[【[<][^】\\]>]*${norm}[^】\\]>]*[】\\]>]\\s*`, "i"), "");
  }
  // Remove qualquer gatilho inicial genérico se sobrou
  clean = clean.replace(/^[【[<][^】\]>]+[】\]>]\s*/, "");
  return clean.trim();
}

/**
 * Resolve o texto descritivo de uma cláusula/decisão do simulador conforme o idioma da conta.
 *
 * Em "PT_BR": tenta encontrar a tradução em português casando por `cardCode` e `trigger`.
 * Em "EN" (ou caso a tradução não exista): mantém o `label` oficial em inglês.
 */
export function resolveDecisionText(
  params: ResolveDecisionTextParams,
  lang: CardLanguage = "PT_BR",
  cardLookup?: (code: string) => CardTextInput | null | undefined,
): string {
  const { label, specId, trigger, card } = params;

  // Se o usuário prefere inglês, respeita estritamente o texto oficial do motor
  if (lang === "EN") {
    return label;
  }

  // Determina o código da carta
  const code = params.cardCode || extractCardCodeFromSpecId(specId);

  // Obtém a definição da carta
  const targetCard: CardTextInput | null | undefined =
    card ??
    (code ? (cardLookup ? cardLookup(code) : undefined) ?? getRegisteredCardTranslation(code) : null);

  if (!targetCard) {
    return label;
  }

  // Se houver um gatilho especificado, tenta localizar a seção correspondente
  if (trigger) {
    const sections = extractCardSections(targetCard, "PT_BR");
    const normReq = normalizeTrigger(trigger);
    const matched = sections.find(
      (sec) => sec.trigger && normalizeTrigger(sec.trigger).includes(normReq),
    );

    if (matched && matched.textPt) {
      return stripTriggerPrefix(matched.textPt, trigger) || matched.textPt;
    }
  }

  // Resolução geral via cardText
  const result = cardText(targetCard, trigger, "PT_BR");
  if (result.text && !result.isPending) {
    return stripTriggerPrefix(result.text, trigger) || result.text;
  }

  // Fallback para o label original do motor
  return label;
}

/**
 * Títulos padronizados para cabeçalhos de gatilhos em AbilityResolutionModal.
 */
export const TRIGGER_MODAL_LABELS: Record<CardLanguage, Record<string, string>> = {
  PT_BR: {
    "When Paired": "Vínculo resolvido — 【When Paired】",
    Attack: "Ataque declarado — 【Attack】",
    Deploy: "Carta implantada — 【Deploy】",
    Main: "Comando — 【Main】",
    Action: "Comando — 【Action】",
    Burst: "Habilidade de Burst — 【Burst】",
    Destroyed: "Destruição — 【Destroyed】",
    "Reaction:effectDamage": "Reação — Unit recebeu dano de efeito",
    "Reaction:restedByEffect": "Reação — Unit descansada por efeito",
    "Reaction:setActiveByEffect": "Reação — Unit ativada por efeito",
    "Reaction:pilotPaired": "Reação — Piloto pareado",
    "Reaction:attack": "Reação — Ataque declarado",
    "Reaction:endOfTurn": "Reação — Fim do turno",
  },
  EN: {
    "When Paired": "Pairing resolved — 【When Paired】",
    Attack: "Attack declared — 【Attack】",
    Deploy: "Card deployed — 【Deploy】",
    Main: "Command — 【Main】",
    Action: "Command — 【Action】",
    Burst: "Burst Ability — 【Burst】",
    Destroyed: "Destroyed — 【Destroyed】",
    "Reaction:effectDamage": "Reaction — Unit received effect damage",
    "Reaction:restedByEffect": "Reaction — Unit rested by effect",
    "Reaction:setActiveByEffect": "Reaction — Unit activated by effect",
    "Reaction:pilotPaired": "Reaction — Pilot paired",
    "Reaction:attack": "Reaction — Attack declared",
    "Reaction:endOfTurn": "Reaction — End of turn",
  },
};

/**
 * Retorna o rótulo do cabeçalho de gatilho no idioma apropriado.
 */
export function getTriggerModalLabel(trigger: string, lang: CardLanguage = "PT_BR"): string {
  const dict = TRIGGER_MODAL_LABELS[lang] ?? TRIGGER_MODAL_LABELS.PT_BR;
  return dict[trigger] ?? trigger;
}

/**
 * Dicionário de strings e mensagens do AbilityResolutionModal em pt-BR e EN.
 */
export interface DecisionModalStrings {
  confirm: string;
  orderAndChoose: string;
  activate: string;
  skip: string;
  noLegalTargets: string;
  noLegalSecondaryTargets: string;
  handChoicePrompt: string;
  noEligibleHandUnits: string;
  deckTopRevealPrompt: (count: number) => string;
  doNotReveal: string;
  notRevealable: string;
  handDiscardPrompt: string;
  emptyHandPrompt: string;
  deckReorderPrompt: string;
  reorderTop: string;
  reorderTrash: string;
  reorderBottom: string;
  choosePrompt: string;
  trashExilePrompt: (count: number, total: number, selected: number) => string;
  trashSearchPrompt: (total: number) => string;
  none: string;
  boardTargetPrompt: string;
  boardSecondaryTargetPrompt: string;
  also: string;
  ally: string;
  enemy: string;
  multiTargetCount: (selected: number, max: number) => string;
  multiTargetRange: (min: number, max: number, selected: number) => string;
  unnamedCard: string;
  boughtCardSuffix: string;
}

export const DECISION_MODAL_STRINGS: Record<CardLanguage, DecisionModalStrings> = {
  PT_BR: {
    confirm: "Confirmar",
    orderAndChoose: "Ordene e escolha os alvos:",
    activate: "Ativar",
    skip: "Pular",
    noLegalTargets: "Nenhum alvo legal — o efeito não faz nada.",
    noLegalSecondaryTargets: "Nenhum alvo legal pro 2º escolhido — o efeito não faz nada.",
    handChoicePrompt: "Escolha 1 Unidade da sua mão pra implantar sem custo:",
    noEligibleHandUnits: "Nenhuma Unidade elegível na mão — o efeito não faz nada.",
    deckTopRevealPrompt: (count) =>
      `Topo do deck (${count}) — revele 1 Unidade (Zeon)/(Neo Zeon) ou nenhuma. O resto vai pro fundo.`,
    doNotReveal: "Não revelar",
    notRevealable: " (não revelável)",
    handDiscardPrompt: "Escolha 1 carta da mão pra descartar:",
    emptyHandPrompt: "Mão vazia — nada pra descartar.",
    deckReorderPrompt: "Topo do deck — coloque 1 no topo e 1 no fundo:",
    reorderTop: "↑ topo",
    reorderTrash: "→ trash",
    reorderBottom: "↓ fundo",
    choosePrompt: "Escolha:",
    trashExilePrompt: (count, total, selected) =>
      `Exilar do trash — escolha ${count} de ${total} carta(s) (${selected}/${count}):`,
    trashSearchPrompt: (total) => `Lixeira (${total} cartas) — escolha 1 carta (ou nenhuma):`,
    none: "Nenhuma",
    boardTargetPrompt: "Selecione no tabuleiro ou abaixo:",
    boardSecondaryTargetPrompt: "E também (no tabuleiro ou abaixo):",
    also: "E também:",
    ally: "aliado",
    enemy: "inimigo",
    multiTargetCount: (selected, max) =>
      `(${selected}/${max} selecionado${max === 1 ? "" : "s"})`,
    multiTargetRange: (min, max, selected) =>
      `Escolha de ${min} a ${max} alvos (selecionados: ${selected}/${max}):`,
    unnamedCard: "Carta",
    boughtCardSuffix: " (Comprada)",
  },
  EN: {
    confirm: "Confirm",
    orderAndChoose: "Order and choose targets:",
    activate: "Activate",
    skip: "Skip",
    noLegalTargets: "No legal targets — the effect does nothing.",
    noLegalSecondaryTargets: "No legal secondary targets — the effect does nothing.",
    handChoicePrompt: "Choose 1 Unit card from your hand to deploy without paying its cost:",
    noEligibleHandUnits: "No eligible Unit in hand — the effect does nothing.",
    deckTopRevealPrompt: (count) =>
      `Top of deck (${count}) — reveal 1 (Zeon)/(Neo Zeon) Unit card or none. The rest go to the bottom.`,
    doNotReveal: "Do not reveal",
    notRevealable: " (not revealable)",
    handDiscardPrompt: "Choose 1 card from hand to discard:",
    emptyHandPrompt: "Empty hand — nothing to discard.",
    deckReorderPrompt: "Top of deck — place 1 on top and 1 on the bottom:",
    reorderTop: "↑ top",
    reorderTrash: "→ trash",
    reorderBottom: "↓ bottom",
    choosePrompt: "Choose:",
    trashExilePrompt: (count, total, selected) =>
      `Exile from trash — choose ${count} of ${total} card(s) (${selected}/${count}):`,
    trashSearchPrompt: (total) => `Trash (${total} cards) — choose 1 card (or none):`,
    none: "None",
    boardTargetPrompt: "Select on the board or below:",
    boardSecondaryTargetPrompt: "And also (on board or below):",
    also: "And also:",
    ally: "ally",
    enemy: "enemy",
    multiTargetCount: (selected, max) => `(${selected}/${max} selected)`,
    multiTargetRange: (min, max, selected) =>
      `Choose ${min} to ${max} targets (selected: ${selected}/${max}):`,
    unnamedCard: "Card",
    boughtCardSuffix: " (Drawn)",
  },
};

/**
 * Retorna o conjunto completo de strings do modal de resolução no idioma especificado.
 */
export function getDecisionModalStrings(lang: CardLanguage = "PT_BR"): DecisionModalStrings {
  return DECISION_MODAL_STRINGS[lang] ?? DECISION_MODAL_STRINGS.PT_BR;
}
