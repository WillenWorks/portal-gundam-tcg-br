# docs/51: Tradução pt-BR — ST05 (completo) e GD01 (parcial, bloqueado por cota)

Data: 2026-09-14
Status: ST05 concluído e aplicado no Postgres. GD01 parcial (2/130) — bloqueado pela cota diária gratuita do Gemini, retomar com `--resume`.

---

## 1. Escopo

Estender o pipeline de tradução pt-BR (`scripts/translate-card-effects.mjs`, docs/40, docs/17) — até agora só ST01-04 — pra cobrir **ST05** (15 cartas) e **GD01** (130 cartas), no mesmo padrão: tokenizer que protege gatilhos/keywords/nomes/stats, Gemini (`gemini-3.6-flash`, temperature 0.15), validação de multiset de tokens EN×PT, revisão humana, aplicação no Postgres (`CardModel.effectPt` / `Card.effectPt`).

## 2. Generalização do script (multi-set)

O script era hardcoded pra ST01-04 (`SET_CODE_REGEX = /^ST0[1234]-/`, `OUTPUT_PATH = data/translations-st01-04.json`). Adicionado suporte a `--sets=<lista>`:

```
node scripts/translate-card-effects.mjs --sets=ST05           # lote ST05
node scripts/translate-card-effects.mjs --sets=GD01           # lote GD01
node scripts/translate-card-effects.mjs --sets=ST05 --dry-run # valida tokenizer sem gastar API
node scripts/translate-card-effects.mjs --sets=ST05 --push    # aplica no Postgres
```

Sem `--sets=`, o comportamento é 100% igual ao anterior (lote ST01-04, mesmo arquivo `data/translations-st01-04.json` — nunca mistura lotes já revisados). Cada lote novo grava em `data/translations-<sets>.json` próprio. `--apply`/`--push`/`--revalidate` também respeitam `--sets=`.

**Como rodar a API key**: o script lê `process.env.GEMINI_API_KEY` primeiro, senão `.spartan/ai.env`. Como não usamos `.spartan/ai.env` neste projeto (a chave já estava em `.env`), rodamos com `node --env-file=.env scripts/translate-card-effects.mjs ...` (Node 20.6+).

## 3. Validação de tokenizer (`--dry-run`, sem custo de API)

Rodado ANTES de qualquer chamada real, pra pegar buraco de tokenização sem gastar cota:

- **ST05** (15 cartas): 15 OK, 0 REJEITADAS.
- **GD01** (130 cartas): 130 OK, 0 REJEITADAS.

Glossário (`docs/17`) e `PROTECTED_TERMS` já cobriam tudo — nenhum termo novo precisou ser adicionado.

## 4. Lote real — ST05 (concluído)

15/15 cartas com `status: OK` (12 com texto traduzido, 3 sem efeito — nada a traduzir).

Durante o lote real, 4 cartas bateram em erro **503 (modelo sobrecarregado, transitório)** — `--resume` resolveu 2 delas; as outras 2 bateram em **429 (cota diária esgotada)** e, como a cota não resetou na janela desta sessão, foram **traduzidas manualmente** seguindo o mesmo glossário/estilo (ST05-007, ST05-010).

### Revisão humana — 1 inconsistência de estilo corrigida

O Gemini traduziu a keyword protegida "Rest" com sintaxe verbal solta ("Rest ela.", "Rest esta Unidade:", "Implante esta carta.") em 5 cartas. O padrão já estabelecido em ST01-04 (`data/translations-st01-04.json`) é diferente:

| Inglês | Gemini (rejeitado no review) | Padrão ST01-04 (aplicado) |
|---|---|---|
| "Rest it." | "Rest ela." | "Coloque-a em Rest." |
| "Rest this Unit:" | "Rest esta Unidade:" | "Coloque esta Unidade em Rest：" |
| "Rest this Base:" | "Rest esta Base:" | "Coloque esta Base em Rest：" |
| "Deploy this card." | "Implante esta carta." | "Faça o Deploy desta carta." |

Corrigido manualmente em `data/translations-st05.json` (ST05-003, 005, 008, 012, 015) e revalidado (`--revalidate`, token integrity OK). **Lição pro próximo lote (GD01 e além)**: revisar toda ocorrência de "Rest"/"Deploy" nas traduções geradas antes de aplicar — o Gemini não é consistente entre chamadas sobre a fraseologia oficial já fixada.

**Aplicado no Postgres**: `--push` → 12 `CardModel` + 40 `Card` (prints) atualizados. Confirmado via `mcp__gundam__gundam_get_card ST05-001` (`effectPt` populado).

## 5. Lote real — GD01 (parcial, bloqueado por cota)

130 cartas é um lote MUITO maior que qualquer um já rodado (ST01-04 = 64 cartas no total, feito em múltiplas sessões). Na 1ª tentativa desta sessão:

```
[OK] GD01-001, GD01-002
[REJ] GD01-003, GD01-004, ... (HTTP 429 — cota esgotada)
Abortando: 3 falhas seguidas de quota (free tier esgotado).
```

O `QUOTA_ABORT_THRESHOLD=3` funcionou como projetado — parou o lote em vez de queimar 128 tentativas fadadas ao erro. **22 OK (2 com texto real + 20 vanilla sem efeito), 108 pendentes** (marcadas `motivo: "não processada -- lote abortado por quota (rode --resume)"`).

Aplicado no Postgres só o que é real: `--push` → 2 `CardModel` + 8 `Card` atualizados (GD01-001, GD01-002).

### Continuação (fora desta sessão)

Quando a cota do Gemini resetar (diária, no free tier — normalmente meia-noite Pacific Time):

```bash
node --env-file=.env scripts/translate-card-effects.mjs --sets=GD01 --resume
```

Repetir até `0 REJEITADAS` (provavelmente precisa de várias rodadas em dias diferentes, dado o tamanho do lote vs. limite do free tier). Depois de cada rodada:
1. Revisar REJEITADAS reais (não-quota) manualmente.
2. Checar especificamente ocorrências de "Rest"/"Deploy" contra a tabela do §4 antes de aceitar.
3. `--revalidate` se editar manualmente.
4. `--push`.

Considerar subir pra um plano pago do Gemini (ou usar `TRANSLATE_DELAY_MS` bem alto) se o free tier continuar sendo o gargalo — 130 cartas × múltiplos dias não é um workflow sustentável pro tamanho dos próximos sets (GD02-GD05 têm ~130 cartas cada também).

## 6. Auditoria de consistência (`gundam-audit-catalog.mjs`)

O script de auditoria (compara `data/translations-*.json` contra `data/gcg-official-cards.json`) ainda está hardcoded pro arquivo `translations-st01-04.json`. Extensão pra cobrir `translations-st05.json`/`translations-gd01.json` fica como próximo passo (não bloqueia o que já foi aplicado, mas deveria rodar antes do PUSH de qualquer lote futuro).

## 7. Resultado

| Set | Cartas | OK | Com texto | Pendente | Aplicado no Postgres |
|---|---|---|---|---|---|
| ST05 | 15 | 15 | 12 | 0 | Sim (12 `CardModel`, 40 `Card`) |
| GD01 | 130 | 22 | 2 | 108 | Parcial (2 `CardModel`, 8 `Card`) |
