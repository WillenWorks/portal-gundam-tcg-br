/* Vigia de `undefined` dentro de `where` no Prisma.
 *
 * No Prisma, `where: { userId: undefined }` some do filtro: a consulta passa a alcançar todas as linhas
 * (foi o que abriu o C1, token de convidado lendo dados de todo mundo). O `strictUndefinedChecks` resolveria,
 * mas vale para `data` também, e a API usa muito `data: { campo: body.campo }` como "não mexe".
 * Aqui só o `where` (inclusive os aninhados em include/select) é vigiado.
 *
 * Modo "report" (padrão): avisa uma vez por modelo+operação+caminho, no console e no Sentry, e deixa a consulta seguir.
 * Modo "throw" (PRISMA_WHERE_UNDEFINED=throw): recusa a consulta. Há filtros opcionais legítimos
 * (`where: { formato: query.formato }`), então o bloqueio só entra depois de ler os relatos. */
import { Prisma } from "@prisma/client";

export type WhereGuardMode = "report" | "throw" | "off";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Caminhos (ex.: `where.userId`, `include.decks.where.OR[0].id`) em que um `where` tem valor `undefined`. */
export function findUndefinedInWhere(args: unknown): string[] {
  const found: string[] = [];
  const walk = (value: unknown, path: string, inWhere: boolean) => {
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`, inWhere));
      return;
    }
    if (!isPlainObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      const childInWhere = inWhere || key === "where";
      if (child === undefined) {
        if (childInWhere) found.push(childPath);
        continue;
      }
      walk(child, childPath, childInWhere);
    }
  };
  walk(args, "", false);
  return found;
}

export function whereGuardMode(env: NodeJS.ProcessEnv): WhereGuardMode {
  const raw = env.PRISMA_WHERE_UNDEFINED?.trim().toLowerCase();
  return raw === "throw" || raw === "off" ? raw : "report";
}

type GuardOptions = {
  mode: WhereGuardMode;
  report: (message: string) => void;
};

export function createWhereGuard({ mode, report }: GuardOptions) {
  const seen = new Set<string>();
  return function check(model: string | undefined, operation: string, args: unknown) {
    if (mode === "off") return;
    const paths = findUndefinedInWhere(args);
    if (paths.length === 0) return;
    const message = `[prisma] undefined no where: ${model ?? "?"}.${operation} (${paths.join(", ")})`;
    if (mode === "throw") throw new Error(`${message} — o filtro seria ignorado.`);
    const key = `${model}.${operation}:${paths.join(",")}`;
    if (seen.has(key)) return;
    seen.add(key);
    report(message);
  };
}

export function prismaWhereGuardExtension(options: GuardOptions) {
  const check = createWhereGuard(options);
  return Prisma.defineExtension({
    name: "where-undefined-guard",
    query: {
      $allOperations({ model, operation, args, query }) {
        check(model, operation, args);
        return query(args);
      },
    },
  });
}
