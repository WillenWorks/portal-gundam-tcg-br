/**
 * Módulo de Internacionalização (i18n) e Acesso à Informação — Portal Gundam TCG BR
 */

export * from "./types";
export * from "./keywords";
export * from "./cardText";
export * from "./useCardLanguage";
export * from "./KeywordTooltip";
export * from "./battleLogI18n";
export * from "./decisionText";
// `translatedCardsData` (≈1.000 cartas) NÃO é reexportado aqui: o simulador importa sob demanda, para não pesar
// no carregamento inicial de toda página.
