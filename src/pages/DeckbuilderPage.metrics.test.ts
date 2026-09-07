import { describe, expect, it } from "vitest";
import source from "./DeckbuilderPage.tsx?raw";

/**
 * Cobertura de tooltips das métricas do Deckbuilder (Demanda 10).
 *
 * Regra: todo número/bloco visível nas abas "Estatísticas" e "Mão inicial" precisa
 * de um <MetricTooltip> (que renderiza o ícone "?" acessível e marca o bloco com
 * data-metric). Este teste varre o fonte da página, isola a região dessas abas e
 * falha se um título de seção ou um card de métrica não tiver o tooltip ao lado.
 */

// A aba "Montar" não tem métricas — recorta só da "Leitura rápida do deck" (início
// da aba Estatísticas) até os modais globais no fim do componente.
const start = source.indexOf("Diagnóstico operacional");
const end = source.indexOf("<AltArtModal");
const region = source.slice(start, end);

// Seções/labels que aparecem na região mas não exibem número — não exigem tooltip.
const NON_METRIC_HEADINGS = new Set(["Recomendações por carta"]);

describe("DeckbuilderPage — cobertura de tooltips nas métricas", () => {
  it("a região das abas de estatística foi encontrada", () => {
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
  });

  it("todo título de seção de métrica tem <MetricTooltip> ao lado", () => {
    const semTooltip: string[] = [];
    const re = /heading-portal">([A-Za-zÀ-ÿ][^<{]*?)(<MetricTooltip|<\/h3>)/g;
    for (const match of region.matchAll(re)) {
      const title = match[1].trim();
      const followedBy = match[2];
      if (followedBy === "<MetricTooltip") continue;
      if (NON_METRIC_HEADINGS.has(title)) continue;
      semTooltip.push(title);
    }
    expect(semTooltip).toEqual([]);
  });

  it("todo card de métrica (label em tracking-[0.22em]) tem <MetricTooltip> ao lado", () => {
    const semTooltip: string[] = [];
    const re = /tracking-\[0\.22em\][^>]*>([A-Za-zÀ-ÿ][^<{]*?)(<MetricTooltip|<\/p>)/g;
    for (const match of region.matchAll(re)) {
      const label = match[1].trim();
      if (match[2] === "<MetricTooltip") continue;
      semTooltip.push(label);
    }
    expect(semTooltip).toEqual([]);
  });

  it("cada <MetricTooltip> declara metric + what + howToRead não vazios", () => {
    const tooltips = [...source.matchAll(/<MetricTooltip\s+(.*?)\s*\/>/g)].map((m) => m[1]);
    expect(tooltips.length).toBeGreaterThanOrEqual(20);
    for (const attrs of tooltips) {
      const metric = attrs.match(/metric="([^"]+)"/)?.[1] ?? "";
      const what = attrs.match(/what="([^"]+)"/)?.[1] ?? "";
      const howToRead = attrs.match(/howToRead="([^"]+)"/)?.[1] ?? "";
      expect(metric, `metric ausente em: ${attrs}`).toMatch(/^[a-z][a-z-]+$/);
      expect(what.length, `what curto demais para ${metric}`).toBeGreaterThan(15);
      expect(howToRead.length, `howToRead curto demais para ${metric}`).toBeGreaterThan(15);
    }
  });

  it("os identificadores data-metric são únicos e batem com o inventário auditado", () => {
    const ids = [...source.matchAll(/<MetricTooltip\s+metric="([a-z-]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(
      [
        "composicao-tipo",
        "curva-custo",
        "curva-nivel",
        "custo-baixo-abertura",
        "custo-baixo-contagem",
        "custo-baixo-mulligan",
        "distribuicao-ap",
        "distribuicao-cor",
        "distribuicao-hp",
        "identidade-lista",
        "keywords-efeito",
        "keywords-gatilho",
        "leitura-rapida",
        "mao-inicial",
        "nivel-baixo-abertura",
        "series-no-deck",
        "sinergia-estimada",
        "tipos-no-deck",
        "top-cores",
        "top-traits",
      ].sort(),
    );
  });

  it("não sobrou nenhum <InfoHint> legado", () => {
    expect(source).not.toContain("InfoHint");
  });
});
