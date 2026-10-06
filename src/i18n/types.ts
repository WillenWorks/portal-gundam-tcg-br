/**
 * Tipos fundamentais para a camada de internacionalização (i18n) e acesso à informação.
 * Suporta preferência de conta (PT_BR / EN), resolução de textos de cartas com fallback,
 * dicionário de keywords/gatilhos e rótulos de fases/etapas.
 */

export type CardLanguage = "PT_BR" | "EN";

export type KeywordCategory =
  | "effect_keyword"
  | "trigger_keyword"
  | "mechanic"
  | "phase_or_step";

export interface KeywordDefinition {
  /** Identificador único sem valor, ex: "breach", "blocker", "deploy". */
  id: string;
  /** Nome canônico oficial em inglês (nunca traduz), ex: "Breach", "Blocker", "Deploy". */
  name: string;
  /** Formato exibido/impresso, ex: "<Breach N>", "<Blocker>", "【Deploy】". */
  raw: string;
  /** Categoria da keyword / termo. */
  category: KeywordCategory;
  /** Explicação mecânica em português (com interpolação de valor se aplicável). */
  descriptionPt: string;
  /** Explicação mecânica oficial em inglês. */
  descriptionEn: string;
  /** Indica se a keyword aceita um parâmetro numérico (ex: Breach 2, Repair 1). */
  hasValue?: boolean;
  /** Valor numérico específico quando instanciada com valor. */
  value?: number;
  /** Exemplo prático de funcionamento em português. */
  examplePt?: string;
  /** Exemplo prático em inglês. */
  exampleEn?: string;
  /** Seção correspondente nas Comprehensive Rules oficiais, ex: "CR 13-1-2". */
  rulesSection?: string;
}

export interface PhaseStepLabel {
  id: string;
  pt: string;
  en: string;
  detailPt?: string;
  detailEn?: string;
}

export interface CardSectionText {
  trigger?: string;
  label?: string;
  textPt?: string;
  textEn?: string;
  resolvedText: string;
  isPending: boolean;
}

export interface CardTextResult {
  /** Texto resolvido de acordo com o idioma solicitado e fallbacks. */
  text: string;
  /** Idioma efetivo do texto retornado. */
  language: CardLanguage;
  /** True quando o idioma solicitado era PT_BR mas caiu no inglês por falta de tradução. */
  isFallback: boolean;
  /** True quando a carta possui texto original em inglês porém a tradução em português está pendente. */
  isPending: boolean;
  /** Seções individuais de efeito divididas por gatilho quando identificadas. */
  sections: CardSectionText[];
}

export interface CardTextInput {
  code?: string;
  name?: string;
  namePt?: string;
  nameEn?: string;
  effect?: string | null;
  effectPt?: string | null;
  effectEn?: string | null;
  burstEffect?: string | null;
  burstEffectPt?: string | null;
  burstEffectEn?: string | null;
  textSectionsJson?: unknown;
  textSections?: Array<{
    kind?: string;
    label?: string;
    trigger?: string;
    textPt?: string;
    textEn?: string;
  }>;
  def?: {
    code?: string;
    name?: string;
    sourceText?: string;
    [key: string]: unknown;
  };
}
