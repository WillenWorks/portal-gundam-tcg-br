import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import ts from "typescript";

import { classifyHeuristic, deriveCandidatePaths, reproTestSource, validateReport } from "./gundam-triage.mjs";

const scriptPath = fileURLToPath(new URL("./gundam-triage.mjs", import.meta.url));
const fixturePath = fileURLToPath(
  new URL("../src/modules/simulator/repro/__fixtures__/synthetic-report.json", import.meta.url),
);
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gundam-triage-test-"));

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function runTriage(args) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [scriptPath, ...args], { encoding: "utf8" }) };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

function isSyntacticallyValidTs(source) {
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  return (transpiled.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
}

describe("gundam:triage — bug sintético", () => {
  it("roda --file e classifica de forma coerente", () => {
    const { code, out } = runTriage(["--file", fixturePath, "--repro-dir", tmpDir, "--json"]);
    expect(code, out).toBe(0);
    const triage = JSON.parse(out);

    expect(triage.shortCode).toBe("BUG-SYNTHETIC");
    // o fixture aponta content/st01.ts no note, repro determinístico, engine intacto → RÁPIDO
    expect(triage.complexity).toBe("rapido");
    expect(triage.repro.hydrated).toBe(true);
    expect(triage.repro.hasLastAction).toBe(true);
    expect(triage.heuristic.candidatePaths).toContain("src/modules/simulator/content/st01.ts");
    expect(triage.heuristic.hardComplex).toBe(false);
    expect(triage.nextStep).toContain("gundam:fix");
  });

  it("gera um repro/*.test.ts sintaticamente válido", () => {
    runTriage(["--file", fixturePath, "--repro-dir", tmpDir, "--json"]);
    const testFile = path.join(tmpDir, "BUG-SYNTHETIC.test.ts");
    expect(fs.existsSync(testFile)).toBe(true);
    const src = fs.readFileSync(testFile, "utf8");
    const errors = isSyntacticallyValidTs(src);
    expect(errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))).toEqual([]);
    expect(src).toContain('describe("BUG-SYNTHETIC"');
    expect(fs.existsSync(path.join(tmpDir, "BUG-SYNTHETIC.fixture.json"))).toBe(true);
  });

  it("classifica COMPLEXO quando o note aponta engine/**", () => {
    const report = validateReport({
      shortCode: "BUG-ENGINE",
      seat: "A",
      note: "o bug está em engine/combat.ts no cálculo de dano",
      cardsInvolved: [],
      gameState: {},
    });
    const repro = { hydrated: true, hasLastAction: true, threw: true, changedZones: [] };
    const c = classifyHeuristic(report, repro);
    expect(c.complexity).toBe("complexo");
    expect(c.hardComplex).toBe(true);
    expect(c.signals.touchesEngine).toBe(true);
  });

  it("classifica COMPLEXO quando o repro não é determinístico", () => {
    const report = validateReport({
      shortCode: "BUG-FLAKY",
      seat: "B",
      note: "às vezes o ataque de ST02-001 não conta o buff, content/st02.ts",
      cardsInvolved: ["ST02-001"],
      gameState: {},
    });
    const repro = { hydrated: true, hasLastAction: true, threw: false, changedZones: ["B.hand: 5→4"] };
    const c = classifyHeuristic(report, repro);
    expect(c.complexity).toBe("complexo");
    expect(c.signals.nonDeterministic).toBe(true);
  });

  it("deriveCandidatePaths mapeia card codes pro arquivo do set", () => {
    const { paths, cardCodes } = deriveCandidatePaths({ note: "", cardsInvolved: ["ST03-005", "ST04-010"] });
    expect(cardCodes).toEqual(expect.arrayContaining(["ST03-005", "ST04-010"]));
    expect(paths).toEqual(
      expect.arrayContaining([
        "src/modules/simulator/content/st03.ts",
        "src/modules/simulator/content/st04.ts",
      ]),
    );
  });

  it("reproTestSource gera .skip quando o repro não é estável", () => {
    const src = reproTestSource({
      shortCode: "BUG-NOSTABLE",
      report: { seat: "A", note: "x", lastAction: null },
      repro: { threw: false, changedZones: [], errorMessage: null },
      classification: { complexity: "complexo", deterministicRepro: false },
    });
    expect(src).toContain("it.skip(");
    expect(isSyntacticallyValidTs(src)).toEqual([]);
  });
});
