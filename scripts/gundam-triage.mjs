/*
 * gundam:triage — agente de TRIAGEM de bug report do simulador
 * (docs/44 Fase 3 §5.2 / §10.1, Lane 3A).
 *
 * O que faz:
 *   1. Carrega um `SimulatorBugReport` — da API ADMIN (`--<shortCode>`) ou de um
 *      arquivo local (`--file report.json`).
 *   2. Re-hidrata o `gameState` congelado (`hydrateMatch`) e re-executa o
 *      `lastAction` do report via `applyPlayerAction`, capturando se o motor
 *      HOJE lança / muda o estado.
 *   3. Escreve um repro determinístico em
 *      `src/modules/simulator/repro/BUG-XXXX.test.ts` (+ o fixture do estado).
 *      Se não der pra montar um teste estável → `complexity: "complex"`.
 *   4. Classifica RÁPIDO vs COMPLEXO (tabela do docs/44 §5.2) — por heurística
 *      (paths do `note` + `cardsInvolved` + resultado do repro) e, quando
 *      `ANTHROPIC_API_KEY` está setado, com uma segunda opinião do Claude Agent
 *      SDK em modo headless com ferramentas restritas ao diretório `repro/`.
 *   5. Imprime o veredito e grava `BUG-XXXX.triage.json`. (Não existe rota
 *      PATCH pra gravar `triage` no banco ainda — docs/44 Wave 3; quando
 *      existir, é só setar `ADMIN_API_URL` + `ADMIN_API_TOKEN` e ligar aqui.)
 *
 * QUALQUER toque em `engine/**` = COMPLEXO, sem exceção. O fix autônomo
 * (`gundam:fix`) só roda quando a triagem = RÁPIDO.
 *
 * Uso:
 *   node scripts/gundam-triage.mjs BUG-AB12CD
 *   node scripts/gundam-triage.mjs --file ./report.json
 *   node scripts/gundam-triage.mjs --file ./report.json --repro-dir /tmp/repro --json
 *
 * Env:
 *   ADMIN_API_URL     base da API (ex.: https://portal.example.com) — p/ buscar por shortCode
 *   ADMIN_API_TOKEN   Bearer token de um usuário ADMIN
 *   ANTHROPIC_API_KEY liga o Claude Agent SDK (senão: heurística pura + repro template)
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_REPRO_DIR = path.join(ROOT, "src/modules/simulator/repro");

/* ────────────────────────────── args ────────────────────────────── */

export function parseArgs(argv) {
  const args = { shortCode: null, file: null, reproDir: null, outDir: null, json: false, agent: "auto" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") {
      args.file = argv[++i] ?? null;
    } else if (a === "--repro-dir") {
      args.reproDir = argv[++i] ?? null;
    } else if (a === "--out") {
      args.outDir = argv[++i] ?? null;
    } else if (a === "--json") {
      args.json = true;
    } else if (a === "--no-agent") {
      args.agent = "off";
    } else if (a === "--agent") {
      args.agent = "on";
    } else if (a.startsWith("--")) {
      // flag desconhecida — ignora (facilita `pnpm gundam:triage -- --x`)
    } else if (!args.shortCode) {
      args.shortCode = a.replace(/^--/, "");
    }
  }
  return args;
}

/* ────────────────────────── carregar report ─────────────────────── */

const REQUIRED_FIELDS = ["shortCode", "seat", "gameState"];

export function validateReport(report) {
  if (report === null || typeof report !== "object") {
    throw new Error("report não é um objeto JSON");
  }
  for (const field of REQUIRED_FIELDS) {
    if (!(field in report)) throw new Error(`report sem o campo obrigatório '${field}'`);
  }
  if (report.seat !== "A" && report.seat !== "B") {
    throw new Error(`report.seat inválido: ${JSON.stringify(report.seat)} (esperado "A" ou "B")`);
  }
  return report;
}

export function loadReportFromFile(file) {
  const raw = fs.readFileSync(path.resolve(file), "utf8");
  return validateReport(JSON.parse(raw));
}

export async function loadReportFromApi(shortCode, { url, token } = {}) {
  if (!url) throw new Error("ADMIN_API_URL não configurado — use --file ou exporte ADMIN_API_URL/ADMIN_API_TOKEN");
  const endpoint = `${url.replace(/\/+$/, "")}/api/simulator/bug-reports/${encodeURIComponent(shortCode)}`;
  const resp = await fetch(endpoint, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) {
    throw new Error(`GET ${endpoint} → ${resp.status} ${resp.statusText}`);
  }
  return validateReport(await resp.json());
}

/* ───────────────────────── repro determinístico ─────────────────── */

let enginePromise = null;
function loadEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const { register } = await import("tsx/esm/api");
      register();
      const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
      const [hydrate, actions, content] = await Promise.all([
        imp("src/modules/simulator/server/hydrateMatch.ts"),
        imp("src/modules/simulator/engine/actions.ts"),
        imp("src/modules/simulator/content/index.ts"),
      ]);
      return {
        hydrateMatch: hydrate.hydrateMatch,
        HydrateMatchError: hydrate.HydrateMatchError,
        applyPlayerAction: actions.applyPlayerAction,
        specs: content.ALL_EFFECT_SPECS,
        predicateResolver: content.defaultPredicateResolver,
        targetFilterResolver: content.defaultTargetFilterResolver,
      };
    })();
  }
  return enginePromise;
}

function zoneSizes(playerState) {
  const zones = [
    "deck",
    "resourceDeck",
    "shields",
    "resourceArea",
    "battleArea",
    "baseSection",
    "trash",
    "exile",
    "hand",
  ];
  const out = {};
  for (const z of zones) out[z] = Array.isArray(playerState?.[z]) ? playerState[z].length : 0;
  return out;
}

function diffZones(before, after) {
  const changed = [];
  for (const player of ["A", "B"]) {
    const b = zoneSizes(before.players?.[player]);
    const a = zoneSizes(after.players?.[player]);
    for (const zone of Object.keys(b)) {
      if (b[zone] !== a[zone]) changed.push(`${player}.${zone}: ${b[zone]}→${a[zone]}`);
    }
  }
  if (before.phase !== after.phase) changed.push(`phase: ${before.phase}→${after.phase}`);
  if (before.activePlayer !== after.activePlayer) changed.push(`activePlayer: ${before.activePlayer}→${after.activePlayer}`);
  if (before.turnNumber !== after.turnNumber) changed.push(`turnNumber: ${before.turnNumber}→${after.turnNumber}`);
  return changed;
}

/**
 * Reexecuta o `lastAction` sobre o estado hidratado. Devolve um objeto puro
 * (sem GameState pesado) descrevendo o que o motor faz HOJE.
 */
export async function reproduce(report) {
  const engine = await loadEngine();
  const result = {
    hydrated: false,
    hydrateError: null,
    hasLastAction: report.lastAction !== null && report.lastAction !== undefined,
    lastActionKind: report.lastAction?.kind ?? null,
    threw: false,
    errorMessage: null,
    changedZones: [],
    gameOverAfter: null,
  };

  let state;
  try {
    state = engine.hydrateMatch(report.gameState);
    result.hydrated = true;
  } catch (err) {
    result.hydrateError = err instanceof Error ? err.message : String(err);
    return { result, before: null, after: null };
  }

  if (!result.hasLastAction) {
    return { result, before: state, after: null };
  }

  let after = null;
  try {
    after = engine.applyPlayerAction(
      state,
      report.seat,
      report.lastAction,
      engine.specs,
      engine.predicateResolver,
      engine.targetFilterResolver,
    );
    result.changedZones = diffZones(state, after);
    result.gameOverAfter = after.gameOver ?? null;
  } catch (err) {
    result.threw = true;
    result.errorMessage = err instanceof Error ? err.message : String(err);
  }
  return { result, before: state, after };
}

/* ──────────────────────── classificação heurística ──────────────── */

const ENGINE_HINT = /\bengine\/|matchStore|server\/|socketBridge|viewState|goldenMaster|\bgolden\b/i;
const CONTENT_PATH_HINT =
  /(content\/(?:st0\d|predicates|deferred|index)\.ts|fixtures\/\w+(?:Deck)?\.ts|\bpredicates\.ts\b)/gi;
const NON_DETERMINISTIC_HINT =
  /(às vezes|as vezes|intermitente|aleat[óo]ri|\brandom\b|\bsometimes\b|\bflaky\b|de vez em quando|nem sempre|n[ãa]o[- ]determin)/i;
const CARD_CODE = /\bST0\d-\d{3}\b/gi;

export function deriveCandidatePaths(report) {
  const haystack = [report.note ?? "", ...(Array.isArray(report.cardsInvolved) ? report.cardsInvolved : [])].join("\n");
  const paths = new Set();

  const normalize = (p) => {
    const clean = p.replace(/\\/g, "/").replace(/^\.\//, "");
    return clean.startsWith("src/") ? clean : `src/modules/simulator/${clean}`;
  };

  for (const m of haystack.matchAll(CONTENT_PATH_HINT)) paths.add(normalize(m[1]));

  const codes = new Set();
  for (const m of haystack.matchAll(CARD_CODE)) codes.add(m[0].toUpperCase());
  for (const c of Array.isArray(report.cardsInvolved) ? report.cardsInvolved : []) {
    const mm = String(c).match(/ST0\d-\d{3}/i);
    if (mm) codes.add(mm[0].toUpperCase());
  }
  for (const code of codes) {
    const set = code.slice(0, 4).toLowerCase(); // st01..st04
    paths.add(normalize(`content/${set}.ts`));
  }

  return { paths: [...paths], cardCodes: [...codes] };
}

export function classifyHeuristic(report, repro) {
  const reasons = [];
  const { paths: candidatePaths, cardCodes } = deriveCandidatePaths(report);
  const noteBlob = `${report.note ?? ""}`;

  const touchesEngine = ENGINE_HINT.test(noteBlob);
  const nonDeterministic = NON_DETERMINISTIC_HINT.test(noteBlob);
  const hydrateFailed = repro.hydrated === false;
  const noRepro = !repro.hasLastAction;
  const changesGolden = /\bgolden\b/i.test(noteBlob);

  // teste estável só quando: hidratou + tem lastAction + (motor lança HOJE OU
  // muda zona HOJE). "Lança hoje" é o Red mais limpo possível pro fix.
  const deterministicRepro =
    repro.hydrated === true && repro.hasLastAction && (repro.threw || repro.changedZones.length > 0);

  if (touchesEngine) reasons.push("note aponta engine/server/matchStore/golden");
  if (changesGolden) reasons.push("note menciona golden-master (muda hash canônico)");
  if (nonDeterministic) reasons.push("note descreve comportamento não-determinístico");
  if (hydrateFailed) reasons.push(`hydrateMatch falhou: ${repro.hydrateError}`);
  if (noRepro) reasons.push("report sem lastAction — repro de uma única ação não é possível");
  if (!deterministicRepro && !hydrateFailed && !noRepro) {
    reasons.push("repro não falha de forma isolável (motor não lança nem muda estado hoje)");
  }
  if (candidatePaths.length === 0) reasons.push("nenhum path de content/fixtures/predicates inferível do note");
  if (candidatePaths.length > 3) reasons.push(`${candidatePaths.length} arquivos-alvo (> 3)`);

  const hardComplex = touchesEngine || changesGolden || nonDeterministic;

  const isRapido =
    !hardComplex &&
    !hydrateFailed &&
    !noRepro &&
    deterministicRepro &&
    candidatePaths.length >= 1 &&
    candidatePaths.length <= 3;

  return {
    complexity: isRapido ? "rapido" : "complexo",
    hardComplex,
    signals: { touchesEngine, changesGolden, nonDeterministic, hydrateFailed, noRepro, deterministicRepro },
    deterministicRepro,
    candidatePaths,
    cardCodes,
    reasons: isRapido
      ? ["repro isolavel + fix so em content/fixtures/predicates + engine intacto + <= 3 arquivos"]
      : reasons,
  };
}

/* ─────────────────────────── repro test file ────────────────────── */

export function reproTestSource({ shortCode, report, repro, classification }) {
  const testId = shortCode.replace(/[^A-Za-z0-9_-]/g, "_");
  const fixtureName = `${testId}.fixture.json`;
  const note = (report.note ?? "(sem note)").replace(/\*\//g, "* /");
  const action = JSON.stringify(report.lastAction ?? null);
  const stable = classification.deterministicRepro;

  const header = `/*
 * Repro de ${shortCode} — GERADO por scripts/gundam-triage.mjs (docs/44 Fase 3 §5.2).
 * NÃO editar à mão a não ser pra apertar o \`expect\` no comportamento CORRETO.
 *
 * seat: ${report.seat}   lastAction: ${action}
 * classificação: ${classification.complexity}
 * note do report:
 *   ${note.split("\n").join("\n *   ")}
 */`;

  const preamble = `import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hydrateMatch } from "@/modules/simulator/server/hydrateMatch";
import { applyPlayerAction, type PlayerAction } from "@/modules/simulator/engine/actions";
import {
  ALL_EFFECT_SPECS,
  defaultPredicateResolver,
  defaultTargetFilterResolver,
} from "@/modules/simulator/content";

const report = JSON.parse(
  readFileSync(fileURLToPath(new URL("./${fixtureName}", import.meta.url)), "utf8"),
) as { seat: "A" | "B"; gameState: unknown; lastAction: PlayerAction | null };

function apply() {
  const state = hydrateMatch(report.gameState);
  if (report.lastAction === null) throw new Error("report sem lastAction");
  return applyPlayerAction(
    state,
    report.seat,
    report.lastAction,
    ALL_EFFECT_SPECS,
    defaultPredicateResolver,
    defaultTargetFilterResolver,
  );
}`;

  let body;
  if (!stable) {
    body = `describe("${shortCode}", () => {
  // Triagem não conseguiu um Red determinístico (ver header). Preencha a
  // asserção do comportamento CORRETO e remova o \`.skip\` — ou trate como COMPLEXO.
  it.skip("reproduz ${shortCode} e valida o comportamento correto", () => {
    const next = apply();
    expect(next).toBeDefined();
  });
});`;
  } else if (repro.threw) {
    body = `describe("${shortCode}", () => {
  // Red HOJE: o motor lança "${(repro.errorMessage ?? "").replace(/"/g, "'")}".
  // Green: depois do fix a ação é legal e não lança.
  it("aplica ${report.lastAction?.kind} sem lançar (comportamento correto)", () => {
    expect(() => apply()).not.toThrow();
  });
});`;
  } else {
    const changed = repro.changedZones.map((c) => ` *   ${c}`).join("\n");
    body = `describe("${shortCode}", () => {
  // Hoje a ação NÃO lança e muda o estado assim:
${changed}
  // Aperte a asserção abaixo pro que DEVERIA acontecer (hoje isto passa —
  // é ponto de partida, não o Red final).
  it("reproduz ${shortCode} — ajustar expect pro comportamento correto", () => {
    const next = apply();
    expect(next).toBeDefined();
  });
});`;
  }

  return `${header}\n\n${preamble}\n\n${body}\n`;
}

export function writeReproArtifacts({ shortCode, report, repro, classification, reproDir }) {
  const dir = reproDir ?? DEFAULT_REPRO_DIR;
  fs.mkdirSync(dir, { recursive: true });
  const testId = shortCode.replace(/[^A-Za-z0-9_-]/g, "_");

  const fixturePath = path.join(dir, `${testId}.fixture.json`);
  fs.writeFileSync(
    fixturePath,
    `${JSON.stringify({ seat: report.seat, lastAction: report.lastAction ?? null, gameState: report.gameState }, null, 2)}\n`,
  );

  const testPath = path.join(dir, `${testId}.test.ts`);
  fs.writeFileSync(testPath, reproTestSource({ shortCode, report, repro, classification }));

  return { fixturePath, testPath };
}

/* ─────────────────────── Claude Agent SDK (opcional) ────────────── */

async function loadAgentSdk() {
  try {
    return await import("@anthropic-ai/claude-agent-sdk");
  } catch {
    return null;
  }
}

/**
 * Segunda opinião + repro test mais rico via Claude Agent SDK headless.
 * Ferramentas restritas: Read/Grep/Glob em qualquer lugar (só leitura) e
 * Write/Edit SOMENTE no diretório `repro/`. Nunca toca engine/content.
 * Retorna `null` em qualquer falha (a heurística já cobre o caso).
 */
export async function agentTriage({ shortCode, report, repro, heuristic, reproDir, mode }) {
  if (mode === "off") return null;
  if (!process.env.ANTHROPIC_API_KEY) {
    if (mode === "on") console.warn("[triage] --agent pedido mas ANTHROPIC_API_KEY não está setado — usando heurística.");
    return null;
  }
  const sdk = await loadAgentSdk();
  if (!sdk?.query) {
    console.warn("[triage] @anthropic-ai/claude-agent-sdk indisponível — usando heurística.");
    return null;
  }

  const dir = reproDir ?? DEFAULT_REPRO_DIR;
  const testId = shortCode.replace(/[^A-Za-z0-9_-]/g, "_");
  const prompt = [
    `Você é o agente de TRIAGEM de um bug do motor de TCG (docs/44 Fase 3 §5.2).`,
    `O repro base já foi gerado em \`${path.join(dir, `${testId}.test.ts`)}\` com o fixture ao lado.`,
    ``,
    `Bug report ${shortCode} (seat ${report.seat}):`,
    `note: ${report.note ?? "(sem note)"}`,
    `cardsInvolved: ${JSON.stringify(report.cardsInvolved ?? [])}`,
    `lastAction: ${JSON.stringify(report.lastAction ?? null)}`,
    `repro hoje: ${JSON.stringify(repro.result ?? repro)}`,
    `heurística: ${JSON.stringify(heuristic)}`,
    ``,
    `Tarefas:`,
    `1. Leia (só leitura) o engine/content relevante pra entender o comportamento esperado.`,
    `2. Aperte o \`expect\` do teste em ${testId}.test.ts pro comportamento CORRETO (que deve falhar HOJE). Se não der um teste estável/determinístico, deixe \`.skip\` e diga complexity=complex.`,
    `3. Responda a ÚLTIMA linha como JSON puro: {"complexity":"rapido"|"complexo","reason":"...","confidence":0..1}`,
    ``,
    `REGRA DURA: qualquer fix que precise tocar engine/** = complexo. Você NÃO pode editar nada fora de ${dir}.`,
  ].join("\n");

  try {
    const iterator = sdk.query({
      prompt,
      options: {
        cwd: ROOT,
        maxTurns: 24,
        permissionMode: "acceptEdits",
        allowedTools: ["Read", "Grep", "Glob", "Write", "Edit"],
        disallowedTools: ["Bash", "WebFetch", "WebSearch", "Task"],
        additionalDirectories: [dir],
      },
    });

    let lastText = "";
    for await (const message of iterator) {
      if (message?.type === "assistant") {
        for (const block of message.message?.content ?? []) {
          if (block?.type === "text" && block.text.trim()) lastText = block.text.trim();
        }
      } else if (message?.type === "result" && typeof message.result === "string" && message.result.trim()) {
        lastText = message.result.trim();
      }
    }

    const jsonLine = lastText.split("\n").reverse().find((l) => l.trim().startsWith("{"));
    if (!jsonLine) return { raw: lastText, complexity: null };
    const parsed = JSON.parse(jsonLine);
    return {
      complexity: parsed.complexity === "rapido" ? "rapido" : parsed.complexity === "complexo" ? "complexo" : null,
      reason: parsed.reason ?? null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
      raw: lastText,
    };
  } catch (err) {
    console.warn(`[triage] Agent SDK falhou (${err instanceof Error ? err.message : err}) — usando heurística.`);
    return null;
  }
}

/* ─────────────────────────────── run ────────────────────────────── */

export async function runTriage(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  const report = args.file
    ? loadReportFromFile(args.file)
    : await loadReportFromApi(args.shortCode ?? "", {
        url: process.env.ADMIN_API_URL,
        token: process.env.ADMIN_API_TOKEN,
      });

  if (!args.shortCode) args.shortCode = report.shortCode;
  const shortCode = report.shortCode ?? args.shortCode ?? "BUG-UNKNOWN";

  const reproRun = await reproduce(report);
  const heuristic = classifyHeuristic(report, reproRun.result);

  const artifacts = writeReproArtifacts({
    shortCode,
    report,
    repro: reproRun.result,
    classification: heuristic,
    reproDir: args.reproDir,
  });

  const agent = await agentTriage({
    shortCode,
    report,
    repro: reproRun,
    heuristic,
    reproDir: args.reproDir,
    mode: args.agent,
  });

  // veredito final: engine/golden/não-determinístico é COMPLEXO mesmo que o
  // agente discorde; fora disso, se o agente rebaixou pra complexo, respeita.
  let complexity = heuristic.complexity;
  if (agent?.complexity === "complexo") complexity = "complexo";
  if (heuristic.hardComplex) complexity = "complexo";

  const triage = {
    shortCode,
    classifiedAt: new Date().toISOString(),
    complexity,
    heuristic,
    agent: agent ?? { skipped: true },
    repro: reproRun.result,
    artifacts: {
      test: path.relative(ROOT, artifacts.testPath).replace(/\\/g, "/"),
      fixture: path.relative(ROOT, artifacts.fixturePath).replace(/\\/g, "/"),
    },
    nextStep:
      complexity === "rapido"
        ? "pnpm gundam:fix " + shortCode
        : "revisão humana — postar plano + repro, PR draft com label autofix:complexo needs-approval",
  };

  const outDir = args.outDir ?? args.reproDir ?? DEFAULT_REPRO_DIR;
  fs.mkdirSync(outDir, { recursive: true });
  const triagePath = path.join(outDir, `${shortCode.replace(/[^A-Za-z0-9_-]/g, "_")}.triage.json`);
  fs.writeFileSync(triagePath, `${JSON.stringify(triage, null, 2)}\n`);

  if (args.json) {
    process.stdout.write(`${JSON.stringify(triage, null, 2)}\n`);
  } else {
    console.log(`\n[triage] ${shortCode} → ${complexity.toUpperCase()}`);
    console.log(`[triage] repro: ${triage.artifacts.test}`);
    console.log(`[triage] motivos:`);
    for (const r of heuristic.reasons) console.log(`  - ${r}`);
    if (agent) console.log(`[triage] agente: ${JSON.stringify({ complexity: agent.complexity, reason: agent.reason })}`);
    console.log(`[triage] triage.json: ${path.relative(ROOT, triagePath).replace(/\\/g, "/")}`);
    console.log(`[triage] próximo passo: ${triage.nextStep}\n`);
  }

  return triage;
}

const isMain = (() => {
  try {
    return pathToFileURL(process.argv[1]).href === import.meta.url;
  } catch {
    return false;
  }
})();

if (isMain) {
  runTriage().catch((err) => {
    console.error(`[triage] ERRO: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
}
