# `repro/` — repros de bug report do simulador

Diretório-alvo dos agentes de **triagem** e **correção** de bug report
(docs/44 Fase 3 §5.2 / §5.3, Lane 3A).

## O que cai aqui

| Arquivo | Quem escreve | O que é |
|---|---|---|
| `BUG-XXXX.test.ts` | `pnpm gundam:triage` | teste vitest determinístico: hidrata o `gameState` congelado, aplica o `lastAction` e faz `expect` do comportamento **correto** (que hoje falha — é o **Red** do TDD) |
| `BUG-XXXX.fixture.json` | `pnpm gundam:triage` | `{ seat, lastAction, gameState }` do report — lido pelo teste em runtime (sem `resolveJsonModule`) |
| `BUG-XXXX.triage.json` | `pnpm gundam:triage` | veredito **RÁPIDO** vs **COMPLEXO** + motivos + resultado do repro |
| `BUG-XXXX.fix-attempt.json` | `pnpm gundam:fix` | marca que o bug já teve **1 tentativa autônoma** (não repete) |
| `__fixtures__/synthetic-report.json` | commitado | report sintético usado por `scripts/gundam-triage.test.mjs` |

## Rodar manual (fallback sem GitHub Actions)

```bash
# 1. triagem — busca o report na API ADMIN…
ADMIN_API_URL=https://portal.example.com ADMIN_API_TOKEN=<jwt-admin> \
  pnpm gundam:triage BUG-AB12CD

# …ou de um arquivo local
pnpm gundam:triage --file ./report.json

# 2. correção autônoma (só se a triagem deu RÁPIDO)
ANTHROPIC_API_KEY=<key> pnpm gundam:fix BUG-AB12CD
```

Sem `ANTHROPIC_API_KEY` a triagem cai na **heurística** (paths do `note` +
`cardsInvolved` + resultado do repro) e o `gundam:fix` só imprime o TODO
manual — nenhum passo autônomo.

## Regras duras

- **Qualquer** fix que precise tocar `engine/**` = **COMPLEXO**. O `gundam:fix`
  reverte e reclassifica se o patch sair de `content/*.ts`, `fixtures/*.ts`,
  `content/predicates.ts` ou `repro/`.
- `dev` = PR automático quando o CI fica verde. `main` = **sempre** autorização
  do Willen. Nenhum caminho autônomo toca `main` (docs/47 §6).
- Os `BUG-XXXX.*` são gerados; commite-os junto com o fix quando o PR for real.
