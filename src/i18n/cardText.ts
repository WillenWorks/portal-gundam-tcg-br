/**
 * Resolução multilíngue do texto de cartas com suporte a preferências de conta,
 * seções por gatilho e sinalização de tradução pendente com fallback para o inglês.
 */

import type { CardLanguage, CardSectionText, CardTextInput, CardTextResult } from "./types";

/**
 * Remove colchetes e delimitadores de gatilhos para comparação normalizada.
 * Ex.: "【Deploy】" -> "deploy", "[Burst]" -> "burst".
 */
export function normalizeTrigger(trigger: string): string {
  if (!trigger) return "";
  return trigger
    .replace(/^[【[<]+|[】\]>]+$/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Normaliza quebras de linha e espaçamentos repetidos.
 */
function cleanText(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .trim();
}

/**
 * Extrai seções estruturadas a partir de `textSectionsJson`, `textSections` ou
 * por divisão léxica de gatilhos no texto corrido.
 */
export function extractCardSections(
  card: CardTextInput,
  lang: CardLanguage = "PT_BR",
): CardSectionText[] {
  if (!card) return [];

  // Se já houver seções pré-estruturadas no card
  const rawSections = Array.isArray(card.textSections)
    ? card.textSections
    : Array.isArray(card.textSectionsJson)
      ? (card.textSectionsJson as Array<any>)
      : [];

  if (rawSections.length > 0) {
    return rawSections.map((sec) => {
      const trigger = sec.trigger || sec.label || sec.kind || undefined;
      const textPt = cleanText(sec.textPt);
      const textEn = cleanText(sec.textEn);
      const hasPt = Boolean(textPt);
      const hasEn = Boolean(textEn);

      let resolvedText = "";
      let isPending = false;

      if (lang === "EN") {
        resolvedText = textEn || textPt;
      } else {
        if (hasPt) {
          resolvedText = textPt;
        } else if (hasEn) {
          resolvedText = textEn;
          isPending = true;
        }
      }

      return {
        trigger,
        label: sec.label,
        textPt: hasPt ? textPt : undefined,
        textEn: hasEn ? textEn : undefined,
        resolvedText,
        isPending,
      };
    });
  }

  // Divisão léxica do efeito quando não há textSectionsJson
  const fullPt = cleanText(card.effectPt);
  const fullEn = cleanText(card.effectEn || card.def?.sourceText);

  // Divide por quebras de linha que iniciam com gatilhos (ex: 【Deploy】 ou <Repair 2>)
  const ptBlocks = fullPt ? fullPt.split(/\n+/).filter(Boolean) : [];
  const enBlocks = fullEn ? fullEn.split(/\n+/).filter(Boolean) : [];

  const maxLen = Math.max(ptBlocks.length, enBlocks.length);
  if (maxLen === 0) return [];

  const sections: CardSectionText[] = [];
  for (let i = 0; i < maxLen; i++) {
    const ptBlock = ptBlocks[i] || "";
    const enBlock = enBlocks[i] || "";

    const triggerMatch = (enBlock || ptBlock).match(/^([【[<][^】\]>]+[】\]>])/);
    const trigger = triggerMatch ? triggerMatch[1] : undefined;

    const hasPt = Boolean(ptBlock);
    const hasEn = Boolean(enBlock);
    let resolvedText = "";
    let isPending = false;

    if (lang === "EN") {
      resolvedText = enBlock || ptBlock;
    } else {
      if (hasPt) {
        resolvedText = ptBlock;
      } else if (hasEn) {
        resolvedText = enBlock;
        isPending = true;
      }
    }

    sections.push({
      trigger,
      textPt: hasPt ? ptBlock : undefined,
      textEn: hasEn ? enBlock : undefined,
      resolvedText,
      isPending,
    });
  }

  return sections;
}

/**
 * Resolve o texto de efeito no idioma especificado, com fallback automático
 * para inglês caso a tradução pt-BR esteja pendente.
 *
 * @param card Dados da carta (CardModel, CardInstance ou CardDef com effectPt/effectEn/sourceText)
 * @param trigger Opcional: gatilho específico a filtrar (ex.: "Deploy", "Attack", "Burst")
 * @param lang Idioma alvo ("PT_BR" | "EN"). Padrão "PT_BR".
 */
export function cardText(
  card: CardTextInput | null | undefined,
  trigger?: string,
  lang: CardLanguage = "PT_BR",
): CardTextResult {
  if (!card) {
    return {
      text: "",
      language: lang,
      isFallback: false,
      isPending: false,
      sections: [],
    };
  }

  const sections = extractCardSections(card, lang);

  // Se um gatilho específico foi solicitado, localiza a seção correspondente
  if (trigger) {
    const normReq = normalizeTrigger(trigger);
    const matchedSection = sections.find(
      (sec) => sec.trigger && normalizeTrigger(sec.trigger).includes(normReq),
    );

    if (matchedSection) {
      return {
        text: matchedSection.resolvedText,
        language: matchedSection.isPending ? "EN" : lang,
        isFallback: matchedSection.isPending,
        isPending: matchedSection.isPending,
        sections: [matchedSection],
      };
    }
  }

  // Resolução do efeito completo
  const rawPt = cleanText(card.effectPt);
  const rawEn = cleanText(card.effectEn || card.def?.sourceText);

  const hasPt = Boolean(rawPt);
  const hasEn = Boolean(rawEn);

  if (lang === "EN") {
    return {
      text: rawEn || rawPt,
      language: "EN",
      isFallback: false,
      isPending: false,
      sections,
    };
  }

  // Caso lang === "PT_BR"
  if (hasPt) {
    return {
      text: rawPt,
      language: "PT_BR",
      isFallback: false,
      isPending: false,
      sections,
    };
  }

  if (hasEn) {
    // Carta sem tradução em português -> fallback EN sinalizando pendência
    return {
      text: rawEn,
      language: "EN",
      isFallback: true,
      isPending: true,
      sections,
    };
  }

  // Carta vanilla ou sem efeito
  return {
    text: "",
    language: "PT_BR",
    isFallback: false,
    isPending: false,
    sections: [],
  };
}

/**
 * Verifica se a carta possui texto original em inglês que ainda não tem tradução para português.
 */
export function isTranslationPending(
  card: CardTextInput | null | undefined,
  trigger?: string,
): boolean {
  if (!card) return false;
  const res = cardText(card, trigger, "PT_BR");
  return res.isPending;
}

/**
 * Rótulo amigável exibido para cartas com tradução pendente.
 */
export function getTranslationPendingBadge(lang: CardLanguage = "PT_BR"): string {
  return lang === "PT_BR" ? "Tradução pendente" : "Pending translation";
}
