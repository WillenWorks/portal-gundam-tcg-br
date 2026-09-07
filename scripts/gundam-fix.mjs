/*
 * gundam:fix — agente de CORREÇÃO autônoma de bug report do simulador
 * (docs/44 Fase 3 §5.3 / §10.1, Lane 3A).
 *
 * Só roda quando `gundam:triage` classificou o bug como RÁPIDO. Fluxo TDD:
 *   1. Lê o `BUG-XXXX.triage.json` (ou re-roda a triagem).
 *   2. Confirma o Red: o `repro/BUG-XXXX.test.ts` tem que FALHAR agora.
 *   3. Claude Agent SDK headless implementa o fix — escopo TRAVADO em
 *      `content/*.ts`, `fixtures/*.ts`, `content/predicates.ts` e `repro/`.
 *      NUNCA `engine/**`. Sem `ANTHROPIC_API_KEY` → imprime o TODO e para.
 *   4. Green: o mesmo teste tem que passar.
 *   5. Gates completos: test + check:types + build + gundam:golden +
 *      gundam:fuzz --games=100 + catalog:coverage:gate. Qualquer vermelho →
 *      reverte pra COMPLEXO (marca o triage) e para.
 *   6. Commit `fix(simulator): BUG-XXXX <resumo>` + IMPRIME o comando de PR pra
 *      `dev` (ou roda `gh` com `--open-pr`). NUNCA `git push` direto pra dev/main.
 *
 * 1 tentativa autônoma por BUG-XXXX (marca `repro/BUG-XXXX.fix-attempt.json`).
 *
 * Uso:
 *   node scripts/gundam-fix.mjs BUG-AB12CD
 *   node scripts/gundam-fix.mjs --file ./report.json --open-pr
 *   node scripts/gundam-fix.mjs BUG-AB12CD --triage ./repro/BUG-AB12CD.triage.json
 *
 * Env: ANTHROPIC_API_KEY (Agent SDK) · ADMIN_API_URL / ADMIN_API_TOKEN (triagem via API)
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  loadReportFromApi,
  loadReportFromFile,
  parseArgs as parseTriageArgs,
  runTriage,
} from "./gundam-triage.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_REPRO_DIR = path.join(ROOT, "src/modules/simulator/repro");

/* editável pelo fix — QUALQUER coisa fora disto = COMPLEXO */
const FIX_ALLOWED_GLOBS = [
  "src/modules/simulator/content/st01.ts",
  "src/modules/simulator/content/st02.ts",
  "src/modules/simulator/content/st03.ts",
  "src/modules/simulator/content/st04.ts",
  "src/modules/simulator/content/predicates.ts",
  "src/modules/simulator/fixtures/",
  "src/modules/simulator/repro/",
];

function parseArgs(argv) {
  const base = parseTriageArgs(argv);
  return {
    ...base,
    triagePath: argv.includes("--triage") ? argv[argv.indexOf("--triage") + 1] : null,
    openPr: argv.includes("--open-pr"),
    baseBranch: argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "dev",
  };
}

const IS_WIN = process.platform === "win32";

function sh(cmd, args, opts = {}) {
  // No Windows, execFileSync bloqueia `.cmd` sem shell:true (mitigação de CVE).
  // `pnpm` é `.cmd`; `git`/`gh` são exes reais. Nenhum arg dos gates tem espaço.
  const isCmd = cmd.endsWith(".cmd") || cmd.endsWith(".bat");
  return execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "pipe",
    shell: isCmd && IS_WIN,
    ...opts,
  });
}

function trySh(cmd, args, opts = {}) {
  try {
    return { ok: true, out: sh(cmd, args, opts) };
  } catch (err) {
    return { ok: false, out: `${err.stdout ?? ""}${err.stderr ?? ""}`, code: err.status ?? 1 };
  }
}

const PNPM = IS_WIN ? "pnpm.cmd" : "pnpm";

/* ─────────────────────────── triage load ────────────────────────── */

async function resolveTriage(args) {
  if (args.triagePath && fs.existsSync(args.triagePath)) {
    return JSON.parse(fs.readFileSync(args.triagePath, "utf8"));
  }

  const report = args.file
    ? loadReportFromFile(args.file)
    : await loadReportFromApi(args.shortCode ?? "", {
        url: process.env.ADMIN_API_URL,
        token: process.env.ADMIN_API_TOKEN,
      });
  const shortCode = report.shortCode ?? args.shortCode;
  const reproDir = args.reproDir ?? DEFAULT_REPRO_DIR;
  const guess = path.join(reproDir, `${shortCode.replace(/[^A-Za-z0-9_-]/g, "_")}.triage.json`);
  if (fs.existsSync(guess)) return JSON.parse(fs.readFileSync(guess, "utf8"));

  console.log("[fix] sem triage.json — rodando gundam:triage primeiro…");
  return runTriage(args.file ? ["--file", args.file] : [shortCode]);
}

/* ─────────────────────────── agent fix ──────────────────────────── */

async function agentFix({ shortCode, triage, testPath, reproDir }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ran: false, reason: "ANTHROPIC_API_KEY não setado" };
  }
  let sdk;
  try {
    sdk = await import("@anthropic-ai/claude-agent-sdk");
  } catch {
    return { ran: false, reason: "@anthropic-ai/claude-agent-sdk indisponível" };
  }
  if (!sdk?.query) return { ran: false, reason: "SDK sem query()" };

  const prompt = [
    `Você é o agente de CORREÇÃO de um bug do motor de TCG (docs/44 Fase 3 §5.3). TDD.`,
    ``,
    `Bug ${shortCode}. Triagem: ${JSON.stringify(triage.heuristic ?? {})}.`,
    `Repro (Red agora): ${path.relative(ROOT, testPath).replace(/\\/g, "/")}.`,
    `Paths candidatos: ${JSON.stringify(triage.heuristic?.candidatePaths ?? [])}.`,
    ``,
    `Faça:`,
    `1. Rode o teste do repro e confirme que falha.`,
    `2. Ache a causa raiz e conserte — SOMENTE nestes arquivos: ${FIX_ALLOWED_GLOBS.join(", ")}.`,
    `   É PROIBIDO editar engine/**, server/**, prisma/**. Se o fix exigir isso, PARE e responda complexity=complexo.`,
    `3. Rode o teste de novo e confirme verde. Rode \`pnpm gundam:golden\` — se o hash mudar, PARE (complexo).`,
    `4. Responda a ÚLTIMA linha como JSON puro: {"fixed":true|false,"summary":"<=72 chars","files":["..."],"complexity":"rapido"|"complexo"}`,
  ].join("\n");

  try {
    const iterator = sdk.query({
      prompt,
      options: {
        cwd: ROOT,
        maxTurns: 60,
        permissionMode: "acceptEdits",
        allowedTools: ["Read", "Grep", "Glob", "Edit", "Write", "Bash"],
        disallowedTools: ["WebFetch", "WebSearch", "Task"],
        additionalDirectories: [reproDir],
      },
    });
    let lastText = "";
    for await (const message of iterator) {
      if (message?.type === "assistant") {
        for (const block of message.message?.content ?? []) {
          if (block?.type === "text" && block.text.trim()) lastText = block.text.trim();
        }
      } else if (message?.type === "result" && typeof message.result === "string") {
        if (message.result.trim()) lastText = message.result.trim();
      }
    }
    const jsonLine = lastText.split("\n").reverse().find((l) => l.trim().startsWith("{"));
    const parsed = jsonLine ? JSON.parse(jsonLine) : {};
    return { ran: true, raw: lastText, ...parsed };
  } catch (err) {
    return { ran: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/* ─────────────────────── git scope guard ────────────────────────── */

function changedFiles() {
  const out = trySh("git", ["status", "--porcelain"]).out ?? "";
  return out
    .split("\n")
    .map((l) => l.slice(3).trim())
    .filter(Boolean);
}

function outOfScope(files) {
  return files.filter((f) => !FIX_ALLOWED_GLOBS.some((g) => (g.endsWith("/") ? f.startsWith(g) : f === g)));
}

/* ─────────────────────────────── run ────────────────────────────── */

async function run() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const triage = await resolveTriage(args);
  const shortCode = triage.shortCode ?? args.shortCode ?? "BUG-UNKNOWN";
  const testId = shortCode.replace(/[^A-Za-z0-9_-]/g, "_");
  const reproDir = args.reproDir ?? DEFAULT_REPRO_DIR;
  const testPath = path.join(reproDir, `${testId}.test.ts`);
  const attemptPath = path.join(reproDir, `${testId}.fix-attempt.json`);

  if (triage.complexity !== "rapido") {
    console.error(`[fix] ${shortCode} está classificado como ${triage.complexity?.toUpperCase()} — fix autônomo não roda. Revisão humana.`);
    process.exit(2);
  }
  if (fs.existsSync(attemptPath)) {
    console.error(`[fix] ${shortCode} já teve 1 tentativa autônoma (${path.relative(ROOT, attemptPath)}). Revisão humana.`);
    process.exit(2);
  }
  if (!fs.existsSync(testPath)) {
    console.error(`[fix] repro ausente: ${testPath}. Rode \`pnpm gundam:triage ${shortCode}\` primeiro.`);
    process.exit(1);
  }

  const relTest = path.relative(ROOT, testPath).replace(/\\/g, "/");
  const record = { shortCode, startedAt: new Date().toISOString(), steps: {} };

  // 1. Red
  const red = trySh(PNPM, ["exec", "vitest", "run", relTest]);
  record.steps.red = { failedAsExpected: !red.ok };
  if (red.ok) {
    console.error(`[fix] o repro ${relTest} JÁ PASSA — não há Red. Nada a corrigir (ou o repro precisa apertar o expect).`);
    fs.writeFileSync(attemptPath, `${JSON.stringify({ ...record, aborted: "repro já verde" }, null, 2)}\n`);
    process.exit(2);
  }
  console.log(`[fix] Red confirmado em ${relTest}`);

  // 2. Agent fix
  const fix = await agentFix({ shortCode, triage, testPath, reproDir });
  record.steps.agent = fix;
  if (!fix.ran) {
    console.log(`\n[fix] Agent SDK não rodou (${fix.reason}).`);
    console.log(`[fix] TODO manual — implemente o fix SÓ em:`);
    for (const g of FIX_ALLOWED_GLOBS) console.log(`        ${g}`);
    console.log(`[fix] depois: pnpm exec vitest run ${relTest}  →  pnpm test && pnpm check:types && pnpm build && pnpm gundam:golden && pnpm gundam:fuzz -- --games=100 && pnpm catalog:coverage:gate`);
    fs.writeFileSync(attemptPath, `${JSON.stringify({ ...record, aborted: "sem Agent SDK" }, null, 2)}\n`);
    process.exit(3);
  }
  if (fix.complexity === "complexo" || fix.fixed === false) {
    console.error(`[fix] agente reclassificou como COMPLEXO: ${fix.summary ?? fix.raw ?? ""}`);
    markTriageComplex(args, triage, reproDir, "agente de fix reclassificou");
    fs.writeFileSync(attemptPath, `${JSON.stringify({ ...record, aborted: "reclassificado complexo" }, null, 2)}\n`);
    process.exit(2);
  }

  // 3. scope guard
  const outScope = outOfScope(changedFiles());
  if (outScope.length) {
    console.error(`[fix] fix tocou arquivos FORA do escopo permitido: ${outScope.join(", ")}`);
    console.error(`[fix] revertendo. Isto é COMPLEXO.`);
    trySh("git", ["checkout", "--", "."]);
    markTriageComplex(args, triage, reproDir, `fix fora de escopo: ${outScope.join(", ")}`);
    fs.writeFileSync(attemptPath, `${JSON.stringify({ ...record, aborted: "fora de escopo", outScope }, null, 2)}\n`);
    process.exit(2);
  }

  // 4. Green + gates
  const gates = [
    ["Green (repro)", [PNPM, ["exec", "vitest", "run", relTest]]],
    ["pnpm test", [PNPM, ["test"]]],
    ["pnpm check:types", [PNPM, ["check:types"]]],
    ["pnpm build", [PNPM, ["build"]]],
    ["pnpm gundam:golden", [PNPM, ["gundam:golden"]]],
    ["pnpm gundam:fuzz --games=100", [PNPM, ["gundam:fuzz", "--", "--games=100"]]],
    ["pnpm catalog:coverage:gate", [PNPM, ["catalog:coverage:gate"]]],
  ];
  record.steps.gates = {};
  for (const [name, [cmd, cmdArgs]] of gates) {
    process.stdout.write(`[fix] gate: ${name} … `);
    const res = trySh(cmd, cmdArgs);
    record.steps.gates[name] = res.ok;
    console.log(res.ok ? "OK" : "FALHOU");
    if (!res.ok) {
      console.error(res.out.split("\n").slice(-25).join("\n"));
      console.error(`[fix] gate '${name}' vermelho — revertendo o fix. Isto vira COMPLEXO.`);
      trySh("git", ["checkout", "--", "."]);
      markTriageComplex(args, triage, reproDir, `gate vermelho: ${name}`);
      fs.writeFileSync(attemptPath, `${JSON.stringify({ ...record, aborted: `gate ${name}` }, null, 2)}\n`);
      process.exit(2);
    }
  }

  // 5. commit + PR command
  const summary = (fix.summary ?? `repro ${shortCode}`).replace(/\s+/g, " ").trim().slice(0, 72);
  const branch = `fix/simulator-${testId.toLowerCase()}`;
  const reportUrl = process.env.ADMIN_API_URL
    ? `${process.env.ADMIN_API_URL.replace(/\/+$/, "")}/api/simulator/bug-reports/${shortCode}`
    : `(bug report ${shortCode})`;

  fs.writeFileSync(
    attemptPath,
    `${JSON.stringify({ ...record, finishedAt: new Date().toISOString(), summary, branch }, null, 2)}\n`,
  );

  const current = trySh("git", ["rev-parse", "--abbrev-ref", "HEAD"]).out?.trim() ?? "";
  if (current === "dev" || current === "main") {
    trySh("git", ["checkout", "-b", branch]);
  }
  trySh("git", ["add", "-A"]);
  const commitMsg = [
    `fix(simulator): ${shortCode} ${summary}`,
    ``,
    `Repro: ${relTest}`,
    `Bug report: ${reportUrl}`,
    `Triagem: RÁPIDO (${(triage.heuristic?.candidatePaths ?? []).join(", ")})`,
    ``,
    `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`,
    `Claude-Session: https://claude.ai/code/session_012wmzrD5gXFAFtu8qzqWSd3`,
  ].join("\n");
  const committed = trySh("git", ["commit", "-m", commitMsg]);
  console.log(committed.ok ? `[fix] commit criado` : `[fix] git commit falhou:\n${committed.out}`);

  const prBody = `Fix autônomo de ${shortCode} (docs/44 Fase 3 §5.3).\n\n- Repro: \`${relTest}\`\n- Bug report: ${reportUrl}\n- Gates: test / check:types / build / gundam:golden / gundam:fuzz --games=100 / catalog:coverage:gate — todos verdes.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\nhttps://claude.ai/code/session_012wmzrD5gXFAFtu8qzqWSd3`;

  if (args.openPr && trySh("gh", ["--version"]).ok) {
    trySh("git", ["push", "-u", "origin", branch]);
    const pr = trySh("gh", [
      "pr",
      "create",
      "--base",
      args.baseBranch,
      "--head",
      branch,
      "--title",
      `fix(simulator): ${shortCode} ${summary}`,
      "--body",
      prBody,
      "--label",
      "autofix:rapido",
    ]);
    console.log(pr.ok ? `[fix] PR aberto:\n${pr.out}` : `[fix] gh pr create falhou:\n${pr.out}`);
  } else {
    console.log(`\n[fix] pronto. Abra o PR pra \`${args.baseBranch}\` (NUNCA push direto pra dev/main):`);
    console.log(`\n  git push -u origin ${branch}`);
    console.log(`  gh pr create --base ${args.baseBranch} --head ${branch} \\`);
    console.log(`    --title "fix(simulator): ${shortCode} ${summary}" \\`);
    console.log(`    --label autofix:rapido --body "<ver ${path.relative(ROOT, attemptPath).replace(/\\/g, "/")}>"\n`);
  }
}

function markTriageComplex(args, triage, reproDir, why) {
  try {
    const p = path.join(reproDir, `${(triage.shortCode ?? "BUG").replace(/[^A-Za-z0-9_-]/g, "_")}.triage.json`);
    const next = { ...triage, complexity: "complexo", downgradedBy: "gundam:fix", downgradeReason: why };
    fs.writeFileSync(p, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`[fix] triage.json marcado COMPLEXO: ${path.relative(ROOT, p).replace(/\\/g, "/")}`);
  } catch (err) {
    console.warn(`[fix] não deu pra marcar o triage.json: ${err instanceof Error ? err.message : err}`);
  }
}

const isMain = (() => {
  try {
    return pathToFileURL(process.argv[1]).href === import.meta.url;
  } catch {
    return false;
  }
})();

if (isMain) {
  run().catch((err) => {
    console.error(`[fix] ERRO: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
}

export { parseArgs, outOfScope, FIX_ALLOWED_GLOBS };
