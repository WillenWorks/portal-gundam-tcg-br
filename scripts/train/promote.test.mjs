import { describe, expect, it } from "vitest";

import {
  parseArgs,
  evaluatePromotionCriteria,
  generatePromotionPrBody,
  PROMOTION_THRESHOLD,
} from "./promote.mjs";
import { FEATURE_SIZE, ACTION_SPACE } from "./engine.mjs";

describe("scripts/train/promote", () => {
  it("parseArgs: analisa flags e argumentos", () => {
    const args = parseArgs([
      "--model=services/sim-trainer/models/abc123",
      "--report=docs/bot/train-2026-10-05.json",
      "--golden",
      "--check-only",
      "--force",
      "--out=docs/bot/custom-pr.md",
    ]);

    expect(args.model).toBe("services/sim-trainer/models/abc123");
    expect(args.report).toBe("docs/bot/train-2026-10-05.json");
    expect(args.golden).toBe(true);
    expect(args.checkOnly).toBe(true);
    expect(args.force).toBe(true);
    expect(args.out).toBe("docs/bot/custom-pr.md");
  });

  it("evaluatePromotionCriteria: APROVA modelo quando atende todos os 4 critérios", () => {
    const manifest = {
      featureSize: FEATURE_SIZE,
      actionSpace: ACTION_SPACE,
      finalLoss: 2.345,
      policyAccuracy: 0.28,
      engineSha: "8357664",
    };

    const evalReport = {
      evaluation: {
        vsHeuristic: {
          winrate: 0.62,
          decided: 50,
          wilson: { low: 0.52, high: 0.71 },
        },
      },
    };

    const result = evaluatePromotionCriteria({
      manifest,
      evalReport,
      currentEngineSha: "8357664",
      goldenPassed: true,
    });

    expect(result.approved).toBe(true);
    expect(result.checks).toHaveLength(4);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it("evaluatePromotionCriteria: RECUSA modelo com taxa de vitória <= 55%", () => {
    const manifest = {
      featureSize: FEATURE_SIZE,
      actionSpace: ACTION_SPACE,
      finalLoss: 3.1,
      policyAccuracy: 0.15,
      engineSha: "8357664",
    };

    const evalReport = {
      vsHeuristic: {
        winrate: 0.52,
        decided: 40,
        wilson: { low: 0.41, high: 0.63 },
      },
    };

    const result = evaluatePromotionCriteria({
      manifest,
      evalReport,
      currentEngineSha: "8357664",
    });

    expect(result.approved).toBe(false);
    const baselineCheck = result.checks.find((c) => c.name.includes("baseline"));
    expect(baselineCheck?.passed).toBe(false);
  });

  it("evaluatePromotionCriteria: RECUSA modelo com Wilson inferior <= 50% em amostra >= 30", () => {
    const manifest = {
      featureSize: FEATURE_SIZE,
      actionSpace: ACTION_SPACE,
      finalLoss: 2.8,
      policyAccuracy: 0.22,
      engineSha: "8357664",
    };

    const evalReport = {
      vsHeuristic: {
        winrate: 0.56,
        decided: 35,
        wilson: { low: 0.44, high: 0.67 },
      },
    };

    const result = evaluatePromotionCriteria({
      manifest,
      evalReport,
      currentEngineSha: "8357664",
    });

    expect(result.approved).toBe(false);
  });

  it("evaluatePromotionCriteria: RECUSA modelo com engineSha divergente", () => {
    const manifest = {
      featureSize: FEATURE_SIZE,
      actionSpace: ACTION_SPACE,
      finalLoss: 2.1,
      policyAccuracy: 0.35,
      engineSha: "old-sha-123",
    };

    const evalReport = {
      vsHeuristic: {
        winrate: 0.65,
        decided: 60,
        wilson: { low: 0.55, high: 0.74 },
      },
    };

    const result = evaluatePromotionCriteria({
      manifest,
      evalReport,
      currentEngineSha: "new-sha-456",
    });

    expect(result.approved).toBe(false);
    const shaCheck = result.checks.find((c) => c.name.includes("motor"));
    expect(shaCheck?.passed).toBe(false);
  });

  it("generatePromotionPrBody: gera markdown formatado com os números", () => {
    const md = generatePromotionPrBody({
      modelDir: "services/sim-trainer/models/abc12345",
      manifest: {
        arch: "MLP 128",
        finalLoss: 2.45,
        policyAccuracy: 0.29,
        epochs: 20,
        samples: 500,
      },
      evalReport: {
        evaluation: {
          vsHeuristic: { winrate: 0.60, wins: 30, decided: 50, wilson: { low: 0.51, high: 0.69 } },
        },
      },
      currentEngineSha: "8357664",
      checks: [
        { name: "Integridade", passed: true, detail: "ok" },
      ],
    });

    expect(md).toContain("# Proposta de Promoção de Modelo ML (A5)");
    expect(md).toContain("**Engine SHA:** `8357664`");
    expect(md).toContain("**vs Heurística (normal):** 60.0% Wilson [51.0%, 69.0%]");
    expect(md).toContain("- [x] **Integridade**: ok");
  });
});
