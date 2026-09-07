# Auditoria de higiene do catálogo

> Gerado por `pnpm catalog:audit` (scripts/gundam-audit-catalog.mjs) em 2026-09-07T00:08:05.281Z.
>
> Correção automática: nenhuma. ST01–ST04 nos arquivos `data/*.json` locais devem ser corrigidos à mão.
> GD/EB e Postgres: apenas registrados — aplicar exige confirmação do Willen.

**12** divergência(s). Postgres não consultado (DATABASE_URL ausente ou pacote `pg` indisponível). Nada foi lido nem escrito no banco.

## ST01–ST04 (arquivos locais) — 0

Nenhuma divergência. `effectEn` bate com o EN oficial e `effectPt` está em paridade estrutural.

## Outros conjuntos (GD/EB/ST05+ — só relato) — 12

### EB01 — 6

| code | campo | problema | valor atual | sugestão |
|---|---|---|---|---|
| EB01-008 | effect (EN oficial) | separador de gatilho ・ (U+30FB) | `・` | `･ (U+FF65, padrão do restante do dataset)` |
| EB01-010 | effect (EN oficial) | separador de gatilho ・ (U+30FB) | `・` | `･ (U+FF65, padrão do restante do dataset)` |
| EB01-025 | effect (EN oficial) | separador de gatilho ・ (U+30FB) | `・` | `･ (U+FF65, padrão do restante do dataset)` |
| EB01-027 | effect (EN oficial) | separador de gatilho ・ (U+30FB) | `・` | `･ (U+FF65, padrão do restante do dataset)` |
| EB01-047 | effect (EN oficial) | separador de gatilho ・ (U+30FB) | `・` | `･ (U+FF65, padrão do restante do dataset)` |
| EB01-060 | effect (EN oficial) | separador de gatilho ・ (U+30FB) | `・` | `･ (U+FF65, padrão do restante do dataset)` |

### GD02 — 1

| code | campo | problema | valor atual | sugestão |
|---|---|---|---|---|
| GD02-053 | effect (EN oficial) | keyword fora do padrão <X> | `[Suppression]` | `<Suppression>` |

### GD04 — 1

| code | campo | problema | valor atual | sugestão |
|---|---|---|---|---|
| GD04-017 | effect (EN oficial) | separador de gatilho ・ (U+30FB) | `・` | `･ (U+FF65, padrão do restante do dataset)` |

### GD05 — 1

| code | campo | problema | valor atual | sugestão |
|---|---|---|---|---|
| GD05-089 | effect (EN oficial) | separador de gatilho ・ (U+30FB) | `・` | `･ (U+FF65, padrão do restante do dataset)` |

### ST10 — 3

| code | campo | problema | valor atual | sugestão |
|---|---|---|---|---|
| ST10-002 | effect (EN oficial) | separador de gatilho ・ (U+30FB) | `・` | `･ (U+FF65, padrão do restante do dataset)` |
| ST10-007 | effect (EN oficial) | separador de gatilho ・ (U+30FB) | `・` | `･ (U+FF65, padrão do restante do dataset)` |
| ST10-008 | effect (EN oficial) | separador de gatilho ・ (U+30FB) | `・` | `･ (U+FF65, padrão do restante do dataset)` |

