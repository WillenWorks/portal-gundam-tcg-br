/**
 * Auditoria cláusula a cláusula da cobertura de efeitos (plano "simulador até GD05", W0.2).
 *
 * O gate antigo só perguntava "existe ALGUM spec pra carta?" — e deixou passar Burst de
 * piloto que não faz nada (GD01-087) e Command 【Main】/【Action】 sem o 【Main】 (GD01-099,
 * GD02-102). Aqui o texto oficial vira cláusulas, e cada cláusula tem que ser coberta:
 * keyword do motor, 【Pilot】[X], spec com o mesmo texto E todos os gatilhos da cláusula,
 * campo estruturado do CardDef, ou deferimento/aproximação registrado.
 *
 * Puro (sem `fs`): `content/` também vai pro bundle do navegador. Quem lê o catálogo
 * (`scripts/gundam-coverage.mjs`, `server/deckCoverageGate.ts`) passa o texto.
 */
import type { CardDef } from "../../engine/types";
import type { EffectSpec } from "../../engine/effectSpec";
import type { DeferredClause } from "../deferred";

export type ClauseKind = "keyword" | "pilotMode" | "bespoke";

export interface Clause {
  index: number;
  /** linha oficial normalizada (com os marcadores) */
  text: string;
  /** texto depois da cadeia de marcadores 【…】 do início */
  body: string;
  kind: ClauseKind;
  /** gatilhos de timing (Burst, Deploy, Main, Action, Activate·Main, …) — vazio = efeito contínuo */
  triggers: string[];
  /** During Pair / During Link / Once per Turn / "(Newtype) Pilot" / "Development 2" … */
  qualifiers: string[];
  keywords: string[];
  pilotName?: string;
}

export type ClauseResolutionKind = "keyword" | "pilotMode" | "spec" | "structured" | "deferred" | "approximated" | "missing";

export interface ClauseResolution extends Clause {
  by: ClauseResolutionKind;
  /** ids dos specs / nome do campo / blockedBy que cobrem a cláusula */
  refs: string[];
  /** gatilhos da cláusula sem spec correspondente (só quando `by === "missing"` por isso) */
  missingTriggers?: string[];
}

export type CardAuditStatus = "vanilla" | "full" | "partial" | "missing";

export interface CardAudit {
  code: string;
  status: CardAuditStatus;
  clauses: ClauseResolution[];
  /** orphanSpec / keywordMismatch / pilotModeMismatch / unknownCode — quebram o gate */
  errors: string[];
}

export interface CardAuditInput {
  code: string;
  effect: string;
  def: CardDef | undefined;
  specs: readonly EffectSpec[];
  deferrals?: readonly DeferredClause[];
}

/** Campos do CardDef que implementam efeito sem EffectSpec — lista ÚNICA (script de cobertura e gate de runtime). */
export const STRUCTURED_FIELDS = [
  "staticAbilities",
  "combatTriggers",
  "allyCombatTriggers",
  "attackTargetRules",
  "dynamicCost",
  "onSupportUsed",
  "innateStatReductionImmunity",
  "innateDamageProtection",
  "innateEffectDamageProtection",
  "onApReducedByEnemy",
  "onEffectDamageReceived",
  "onExResourcePlaced",
  "onSelfHeal",
  "alternateDeploySacrifice",
  "onAnyPairing",
  "nameAliases",
] as const satisfies ReadonlyArray<keyof CardDef>;

const TIMING_TRIGGERS = new Set([
  "Burst",
  "Deploy",
  "Main",
  "Action",
  "Attack",
  "Destroyed",
  "When Paired",
  "When Linked",
  "Activate·Main",
  "Activate·Action",
]);
const QUALIFIERS = new Set(["During Pair", "During Link", "Once per Turn"]);

/** separadores e espaços do texto oficial (`･`/`・`/`·`, `：`, aspas curvas, "won' t") numa forma só */
export function normalizeClause(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[･・·]/g, "·")
    .replace(/：/g, ":")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/(\w)' (\w)/g, "$1'$2")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** "Activate: Main" / "Activate･Main" → "Activate·Main"; o resto passa como está */
function canonicalTrigger(t: string): string {
  return normalizeClause(t).replace(/^Activate\s*[:·]\s*/, "Activate·");
}

/** só o texto-lembrete entre parênteses que começa com maiúscula e termina em ponto — preserva traits como `(Titans)` */
const REMINDER = /\((?=[A-Z])[^()]*(?:\([^()]*\)[^()]*)*\.\)/g;

export function splitClauses(effect: string): Clause[] {
  const lines = normalizeClause(effect ?? "")
    .split("\n")
    .map((l) => l.trim());
  const merged: string[] = [];
  for (const line of lines) {
    if (line.startsWith("■") && merged.length > 0) merged[merged.length - 1] += `\n${line}`;
    else merged.push(line);
  }
  const clauses: Clause[] = [];
  for (const raw of merged) {
    const text = raw.replace(REMINDER, " ").replace(/[ \t]+/g, " ").trim();
    if (!text || text === "-") continue;
    let rest = text;
    const triggers: string[] = [];
    const qualifiers: string[] = [];
    let pilotName: string | undefined;
    // cadeia de marcadores do início: 【A】【B】 ou 【Main】/【Action】
    for (;;) {
      const m = rest.match(/^【([^】]+)】\s*(\/\s*)?/);
      if (!m) break;
      rest = rest.slice(m[0].length);
      const inner = canonicalTrigger(m[1]);
      if (inner === "Pilot") {
        const name = rest.match(/^\[([^\]]+)\]/);
        if (name) {
          pilotName = name[1].trim();
          rest = rest.slice(name[0].length).trim();
        }
        continue;
      }
      // "When Paired·(Newtype) Pilot", "Deploy·Development 2", "During Pair·Purple Pilot"
      const [head, ...mods] = inner.split("·").map((p) => p.trim());
      const joinedHead = head === "Activate" && mods.length ? `Activate·${mods.shift()}` : head;
      if (TIMING_TRIGGERS.has(joinedHead)) triggers.push(joinedHead);
      else qualifiers.push(joinedHead);
      qualifiers.push(...mods);
    }
    const body = rest.trim();
    const keywords = [...body.matchAll(/<([A-Za-z][A-Za-z -]*?)(?:\s+\d+)?>/g)].map((k) => k[1].trim());
    let kind: ClauseKind = "bespoke";
    if (pilotName && !body) kind = "pilotMode";
    else if (keywords.length && !body.replace(/<[^>]+>/g, "").replace(/[\s.,]/g, "") && !qualifiers.some((q) => q !== "Once per Turn")) {
      // keyword pura; com During Pair/Link ou condição de piloto é regra condicional (bespoke)
      kind = "keyword";
    }
    clauses.push({ index: clauses.length, text, body, kind, triggers, qualifiers, keywords, pilotName });
  }
  return clauses;
}

/** corpo do texto de um spec (sem a cadeia de marcadores), normalizado */
function specBody(spec: EffectSpec): string {
  let s = normalizeClause(spec.sourceText ?? "").replace(REMINDER, " ");
  for (;;) {
    const m = s.match(/^【[^】]+】\s*(\/\s*)?/);
    if (!m) break;
    s = s.slice(m[0].length);
  }
  return s.replace(/[ \t]+/g, " ").trim();
}

const compact = (s: string) => s.replace(/\s+/g, " ").trim();

/** fração dos caracteres (sem espaço) de `body` coberta pelos trechos dados */
function coveredFraction(body: string, parts: string[]): number {
  if (!body) return 1;
  const mask = new Array<boolean>(body.length).fill(false);
  for (const p of parts) {
    if (!p) continue;
    let from = 0;
    for (;;) {
      const at = body.indexOf(p, from);
      if (at < 0) break;
      for (let i = at; i < at + p.length; i++) mask[i] = true;
      from = at + 1;
    }
  }
  let total = 0;
  let covered = 0;
  for (let i = 0; i < body.length; i++) {
    if (/\s/.test(body[i])) continue;
    total++;
    if (mask[i]) covered++;
  }
  return total === 0 ? 1 : covered / total;
}

const FULL_COVERAGE = 0.97;

export function auditCard(input: CardAuditInput): CardAudit {
  const { code, def, specs } = input;
  const deferrals = input.deferrals ?? [];
  const clauses = splitClauses(input.effect);
  const errors: string[] = [];
  if (!def) errors.push("unknownCode");

  const bodies = specs.map((s) => compact(specBody(s)));
  const usedSpecs = new Set<number>();
  const structuredFields = def ? STRUCTURED_FIELDS.filter((f) => hasValue(def[f])) : [];

  const resolutions: ClauseResolution[] = clauses.map((clause) => {
    const body = compact(clause.body);
    if (clause.kind === "keyword") {
      const known = new Set([...(def?.effectKeywords ?? []), ...(def?.keywordTags ?? []).map((t) => t.replace(/\s+\d+$/, ""))]);
      const absent = clause.keywords.filter((k) => !known.has(k));
      if (def && absent.length) errors.push(`keywordMismatch: ${absent.join(", ")}`);
      return { ...clause, by: "keyword", refs: clause.keywords };
    }
    if (clause.kind === "pilotMode") {
      if (def && def.pilotMode?.pilotName !== clause.pilotName) errors.push(`pilotModeMismatch: ${clause.pilotName}`);
      return { ...clause, by: "pilotMode", refs: clause.pilotName ? [clause.pilotName] : [] };
    }

    // specs cujo texto contém a cláusula inteira, ou trechos dela
    const matching: number[] = [];
    bodies.forEach((b, i) => {
      if (!b) return;
      if (b.includes(body) || body.includes(b)) matching.push(i);
    });
    const covered = coveredFraction(
      body,
      matching.map((i) => (bodies[i].includes(body) ? body : bodies[i])),
    );
    if (matching.length && covered >= FULL_COVERAGE) {
      matching.forEach((i) => usedSpecs.add(i));
      const specTriggers = new Set(matching.map((i) => canonicalTrigger(specs[i].trigger)));
      const missingTriggers = clause.triggers.filter((t) => !specTriggers.has(t));
      if (missingTriggers.length === 0) return { ...clause, by: "spec", refs: matching.map((i) => specs[i].id) };
      const deferred = deferralFor(clause, deferrals);
      if (deferred) return { ...clause, by: deferred.kind, refs: [deferred.blockedBy] };
      return { ...clause, by: "missing", refs: matching.map((i) => specs[i].id), missingTriggers };
    }
    matching.forEach((i) => usedSpecs.add(i));

    const deferred = deferralFor(clause, deferrals);
    if (deferred) return { ...clause, by: deferred.kind, refs: [deferred.blockedBy] };

    // campo estruturado: anotado com o texto exato, ou (legado, sem anotação) só pra efeito contínuo
    const annotated = structuredFields.find((f) => structuredSourceTexts(def, f).some((t) => compact(normalizeClause(t)).includes(body)));
    if (annotated) return { ...clause, by: "structured", refs: [annotated] };
    if (clause.triggers.length === 0 && structuredFields.length) return { ...clause, by: "structured", refs: [...structuredFields] };

    return { ...clause, by: "missing", refs: [], missingTriggers: clause.triggers.length ? clause.triggers : undefined };
  });

  specs.forEach((s, i) => {
    if (!usedSpecs.has(i)) errors.push(`orphanSpec: ${s.id}`);
    // texto de 2+ cláusulas num spec só (cópia da carta inteira): as ações quase sempre fazem uma delas só
    const swallowed = clauses.filter((c) => c.kind === "bespoke" && compact(c.body) && bodies[i].includes(compact(c.body)));
    if (swallowed.length > 1) errors.push(`multiClauseSpec: ${s.id}`);
  });

  let status: CardAuditStatus;
  const bespoke = resolutions.filter((r) => r.kind === "bespoke");
  if (bespoke.length === 0) status = "vanilla";
  else if (bespoke.some((r) => r.by === "missing")) status = "missing";
  else if (bespoke.some((r) => r.by === "deferred" || r.by === "approximated")) status = "partial";
  else status = "full";

  return { code, status, clauses: resolutions, errors };
}

/**
 * `true` se o texto oficial tem regra além de keyword automática / 【Pilot】[X] / lembrete / vazio.
 * Critério do gate por carta (legado): script de cobertura e gate de runtime usam ESTA função.
 */
export function hasBespokeText(effect: string): boolean {
  if (!effect || effect.trim() === "-" || effect.trim() === "") return false;
  let s = effect
    .replace(/【Pilot】\s*\[[^\]]*\]/g, " ")
    .replace(/【[^】]*】/g, " ")
    .replace(/<[^>]+>/g, " ");
  let prev: string;
  do {
    prev = s;
    s = s.replace(/\([^()]*\)/g, " ");
  } while (s !== prev);
  return s.replace(/[［］[\]･・、。.,\s]+/g, " ").trim().length > 0;
}

export type LegacyCoverageStatus = "vanilla" | "implementada" | "implementada*" | "deferida" | "faltando";

/** o status por carta de antes da auditoria por cláusula ("existe spec ou campo estruturado?") */
export function legacyCoverageStatus(input: Omit<CardAuditInput, "code">): LegacyCoverageStatus {
  const deferrals = input.deferrals ?? [];
  if (!hasBespokeText(input.effect)) return "vanilla";
  const structured = input.def ? STRUCTURED_FIELDS.some((f) => hasValue(input.def?.[f])) : false;
  if (input.specs.length > 0 || structured) return deferrals.length ? "implementada*" : "implementada";
  return deferrals.length ? "deferida" : "faltando";
}

/** jogável no motor: nada faltando e o CardDef existe (deferido/aproximado entra, como o `implementada*` antigo) */
export function isPlayable(audit: CardAudit): boolean {
  return audit.status !== "missing" && !audit.errors.includes("unknownCode");
}

function hasValue(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && v !== false;
}

/** `sourceText` opcional nas entradas de campos estruturados (anotação nova, W0.2) */
function structuredSourceTexts(def: CardDef | undefined, field: (typeof STRUCTURED_FIELDS)[number]): string[] {
  if (!def) return [];
  const value = def[field] as unknown;
  const entries = Array.isArray(value) ? value : [value];
  const texts: string[] = [];
  for (const e of entries) {
    const t = (e as { sourceText?: unknown } | null)?.sourceText;
    if (typeof t === "string") texts.push(t);
  }
  const extra = (def as { structuredSourceText?: Partial<Record<string, string>> }).structuredSourceText?.[field];
  if (extra) texts.push(extra);
  return texts;
}

function deferralFor(clause: Clause, deferrals: readonly DeferredClause[]): { kind: "deferred" | "approximated"; blockedBy: string } | null {
  const text = compact(clause.text);
  for (const d of deferrals) {
    if (text.includes(compact(normalizeClause(d.clause)))) {
      return { kind: (d as { kind?: string }).kind === "approximation" ? "approximated" : "deferred", blockedBy: d.blockedBy };
    }
  }
  return null;
}
