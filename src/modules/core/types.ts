/* Domain core types — base unificada para cards, decks e regras (RuleEntry). */
export type CardColor = "Blue" | "Green" | "Red" | "White" | "Purple" | "Black";
export type CardType = "Unit" | "Pilot" | "Command" | "Base" | "Resource" | "UNIT" | "PILOT" | "COMMAND" | "COMMAND_PILOT" | "BASE" | "RESOURCE" | "EX_BASE" | "EX_RESOURCE" | "UNIT_TOKEN";

export interface CardRecord {
  id: string;
  printId?: string;
  cardModelId?: string;
  code: string;
  name: string;
  namePt?: string;
  color: CardColor;
  type: CardType;
  cost: number;
  level?: number;
  ap?: number;
  hp?: number;
  series: string;
  trait: string;
  keywords: string[];
  triggerKeywords: string[];
  effect: string;
  rarity?: string;
  setCode?: string;
  setName?: string;
  imageUrl?: string;
  imageSmallUrl?: string;
  imageMediumUrl?: string;
  imageLargeUrl?: string;
}

export interface DeckEntry {
  cardId: string;
  quantity: number;
  section?: "main" | "resource" | "ex_base" | "ex_resource";
}

export interface RuleEntry {
  id: string;
  title: string;
  category: "Basic Rules" | "Vocabulary" | "Keywords" | "Detailed Rules";
  source: "Official Rules" | "Official FAQ" | "Community Explainer";
  /** Resposta (PT-BR) -- nome mantido por compatibilidade, mas representa a RESPOSTA, nao um resumo. */
  summaryPt: string;
  /** Pergunta (PT-BR) -- o que deve aparecer em listas/filtros, nunca a resposta. */
  questionPt: string;
  examplePlayPt?: string;
  originalRef: string;
  relatedCards?: string[];
  relatedKeyword?: string;
  relatedPhase?: string;
}
