# Execução — Frente 2: Pipeline de tradução PT-BR (Doc 42)

> Branch `dev`. Registra a implementação do pipeline descrito em `docs/40`.
> Regra de vocabulário: `docs/17-glossario-traducao.md` + `AI_GUIDE.md` seção 1.

## O que foi entregue

### `scripts/translate-card-effects.mjs`
Script Node ESM puro. Fluxo por carta:

1. **Fonte** — `data/gcg-official-cards.json` (`cards[]`), filtro `/^ST0[1234]-/`.
   64 cartas; 52 com texto de efeito real, 12 com `effect === "-"` (sem efeito —
   entram no JSON com `effectPt: null` e `status: "OK"`).
2. **Tokenizer léxico** (`tokenize`) — protege, virando placeholders `§N§`, na ordem:
   - gatilhos `【...】` (inteiros, inclui `【Activate･Main】`, `【When Paired･(White Base Team) Pilot】`);
   - referências de carta `[...]`;
   - blocos de stat de ficha `((Trait)･APx･HPx[･<...>])`;
   - keywords `<...>`;
   - custos circulados `①..⑳`;
   - traits/nomes próprios entre `( )` — só quando 1-3 palavras capitalizadas sem
     verbo (`(Zeon)`, `(Neo Zeon)`, `(White Base Team)`, `(OZ)`); texto explicativo
     entre parênteses (`(This Unit can't be blocked.)`) **é traduzido**;
   - estatísticas soltas: `AP`/`HP` (com valor colado: `AP+1`, `AP-3`, `HP3`),
     `Lv.1..Lv.9`, e `Rest`/`Active`/`Cost`/`Shield` (case-sensitive).
3. **Grounding RAG leve** (`GLOSSARY_GROUNDING`) — resumo das regras do `docs/17` +
   tabela de termos preservados + guia gramatical pt-BR (imperativo: "Compre 1
   carta", "Escolha 1 Unidade inimiga", "Cause X de dano a ela", …) embutido no prompt.
4. **Motor** — Google Gemini REST (`gemini-3.6-flash`, `temperature 0.15`), 1
   request/carta, timeout 60s, retry 3x com backoff exponencial em 429/5xx/timeout.
   Chave lida de `.spartan/ai.env` (`GEMINI_API_KEY`).
5. **Restaurador** (`restore`) — troca `§N§` de volta pelos tokens originais.
6. **Validador de integridade** (`validate`) — REJEITA se: sobra placeholder `§N§`;
   um token protegido sumiu ou foi traduzido; multiset EN≠PT (duplicou/sumiu);
   sobrou `【...】`/`<...>`/`[...]`/estatística não reconhecida no texto (indica
   token traduzido tipo `【Implantar】` ou `<Bloqueador>`).
7. **Saída** — `data/translations-st01-04.json`: array de
   `{ code, name, set, effectEn, effectPt, status, motivo?, tokens[] }` + sumário no stdout.

### Modos
| Comando | Efeito |
|---|---|
| `node scripts/translate-card-effects.mjs` | roda o lote real (chama Gemini) e grava o JSON |
| `node scripts/translate-card-effects.mjs --resume` | mantém as cartas já resolvidas no JSON e só re-traduz as pendentes/rejeitadas (retoma de onde parou quando a quota reseta) |
| `node scripts/translate-card-effects.mjs --dry-run` | tokenizer + validador com tradução identidade (não chama API) |
| `node scripts/translate-card-effects.mjs --apply` | lê o JSON e imprime os `UPDATE` SQL das traduções OK (não conecta no banco) |

Env: `GEMINI_MODEL` (default `gemini-3.6-flash`), `TRANSLATE_DELAY_MS` (pausa entre
cartas, default 500 — subir p/ ~15000 no free tier). Gravação é **incremental**
(reescreve o JSON a cada carta), então quota estourando no meio não perde progresso.
O script também aborta sozinho após 3 falhas seguidas de quota.

## Status da execução (05/set/2026)

Pipeline validado ponta a ponta:
- `--dry-run`: 64/64 cartas OK (tokenizer + restore + validador batem em todas).
- 14 testes unitários verdes (`scripts/translate-card-effects.test.mjs`).
- 1 tradução real concluída e validada antes da quota estourar
  (**ST01-010 Amuro Ray**) — serve de amostra e faz o `--apply` funcionar.

**Bloqueio:** a chave em `.spartan/ai.env` é do **free tier** do Gemini
(`generate_content_free_tier_requests`, limite baixíssimo). Depois de ~1 request a
API passou a responder `429 RESOURCE_EXHAUSTED` de forma persistente. As 51 cartas
com efeito ficaram `status: "REJEITADO"` com o motivo da quota registrado no JSON.

**Para fechar a tradução:** usar uma chave Gemini com billing (ou esperar o reset
da quota / rodar espaçado ao longo de vários dias) e rodar
`node scripts/translate-card-effects.mjs --resume` — ele retoma só as 51 pendentes.
Depois `--apply` gera o SQL e o Willen aplica no Postgres.

O `--apply` emite `UPDATE "CardModel"` **e** `UPDATE "Card"` (prints) por carta,
entre `BEGIN;`/`COMMIT;`, seguindo o padrão do `prisma/extract-keyword-effects.mjs`
(escrever só num nível quebra buscas que consultam o outro).

### `scripts/translate-card-effects.test.mjs`
Vitest (`scripts/**/*.test.mjs` já está no `vitest.config`). Cobre tokenizer,
`isProperNounParen`, `restore`, `validate` (aceita tradução boa; rejeita token
traduzido / sumido / duplicado / placeholder solto / keyword `<...>` traduzida) e
`buildPrompt`.

### Exibição no simulador
`CardInspectorModal.tsx` e `CardInspectorPanel.tsx` ganharam props `effectPt` /
`effectEn` (além do `effectText` legado, mantido por compat). Componente
compartilhado `CardEffectText` (exportado do Modal): mostra `effectPt` por padrão;
quando `effectPt` **e** `effectEn` chegam e diferem, renderiza um toggle PT/EN.
O `CardInspectorPanel` passou a exibir um bloco "Efeito" (antes só mostrava badges
de keyword).

## Follow-up fora do escopo desta frente
`src/pages/SimulatorMatchPage.tsx` hoje resolve `cardText[code] = effectPt || effectEn`
e passa só `effectText={cardText[...]}`. Para habilitar o toggle PT/EN em jogo,
falta um ajuste de 1-2 linhas nessa página (passar `effectPt`/`effectEn` separados,
e passar as props ao `CardInspectorPanel`). Arquivo em `src/pages/**` — deixado
para o dono daquela frente.
