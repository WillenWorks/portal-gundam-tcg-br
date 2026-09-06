# 37 — Limpeza de arquivos, docs legado e tradução Ruling → Regras

**Branch:** `dev` + `main`. 2026-09-04. Pedido do Willen depois de aprovar o
tutorial v1.0 (PDF + screenshots reais, ver `tutoriais/`): limpar o que não
serve mais, organizar os `.md` soltos na raiz numa pasta, e traduzir
"Ruling" pra "Regras" na interface.

## Limpeza

- **Screenshots de bug report no root** (`Captura1-5.jpeg`) — nunca
  versionados, evidência das correções já feitas e documentadas em
  `docs/35`/`docs/36`. Removidos.
- **`LEIA-ME.md` / `INSTRUCOES_ATUALIZACAO.md`** — notas de "substitua o
  arquivo X pelo incluído neste pacote", de um patch já mergeado há muito
  tempo. Sem valor de referência (não descrevem decisão nem arquitetura,
  só uma instrução de aplicação já consumida). Removidos.
- **Código morto em `src/modules/core/types.ts`** — `AppRoute`,
  `DeckRecord`, `TournamentDeckUsage`, `TournamentRecord`,
  `DashboardMetric`, `AdminQueueItem`: zero `import` em qualquer lugar do
  projeto (checado com grep por tipo, um a um). Resquício do protótipo
  inicial do portal (README menciona essa fase, antes do Prisma real).
  Mantidos só `CardColor`/`CardType`/`CardRecord`/`DeckEntry`/`RuleEntry`
  — esses sim importados de verdade (`api.ts`, `BinderPage.tsx`,
  `DeckbuilderPage.tsx`, `RulesPage.tsx`).
- **`tutoriais/assets/`** — removidos os 11 screenshots de tentativas/
  debug que o agente gerador manteve "por segurança" mas nunca entraram
  no PDF final (`05b-apos-cadastro-debug.png` e outros). Só os 19
  realmente referenciados no HTML seguem versionados.

## Organização — `docs/legado/`

Os `.md` de planejamento do redesenho visual "Nível Arena" (já 100%
implementado e narrado, sessão a sessão, em `docs/18` a `docs/36`) e da
carga inicial do catálogo viraram clutter na raiz. Movidos (git mv,
histórico preservado) pra `docs/legado/`, com um `README.md` indexando o
que é cada um:
- `PLANO_REDESENHO_VISUAL_SIMULADOR.md`, `PLANO_REFINAMENTO_ARENA_3D.md`,
  `implementation_plan.md`, `ROTEIRO_ORQUESTRACAO_CLAUDE_CODE.md` — plano
  original do pivot visual (pré-`docs/30`).
- `PLANO_CORRECAO_ARTE_EFEITOS.md`, `PLANO_CORRECAO_EFEITOS_UX_LIFECYCLE.md`,
  `PLANO_ESPELHAMENTO_HUD_FIMDEJOGO.md` — rodadas intermediárias.
- `INSTRUCOES_AGENTES_SIMULADOR.md` — guia operacional de uma rodada
  específica (referencia um artifact externo).
- `INSTRUCOES_APITCG.md`, `INSTRUCOES_CATALOGO_ADMIN.md`,
  `INSTRUCOES_TAXONOMIAS.md` — carga inicial do catálogo de cartas.

`README.md` e `CHANGELOG.md` continuam no root — o segundo é importado
direto por `ChangelogPage.tsx` (`?raw` do Vite), mover quebraria a página
pública `/novidades`. Um comentário em `SimulatorMatchPage.tsx` que
referenciava `PLANO_CORRECAO_ARTE_EFEITOS.md` (§1.3) foi atualizado pro
novo caminho.

## Tradução: "Ruling" → "Regras"

Levantamento completo (grep case-insensitive em todo `src/`) separando
texto visível ao usuário de identificador de código. Traduzido:

- Nav pública (`AppTopNav.tsx`) e nav admin (`PortalShell.tsx`, label +
  breadcrumb) — o item que aparecia como "RULINGS" no menu (inconsistente
  com o resto, já em PT-BR) agora é "Regras".
- `AdminPage.tsx` — label da seção, card de contagem, formulário ("Nova
  regra"/"Salvar regra"/toast "Regra criada."), lista de recursos que
  falharam ao carregar.
- `RulingDetailPage.tsx` — breadcrumb, "Regra individual", mensagens de
  loading/erro, "Mais regras relacionadas", tooltips de link por keyword.
- `CardDetailPage.tsx`, `RulesPage.tsx`, `CollectionsPage.tsx`,
  `AuthPage.tsx`, `Home.tsx` — textos descritivos/copy que mencionavam
  "rulings" soltos no meio da frase.

**Mantido como está** (não é texto visível, mudar seria um refactor bem
maior e não foi pedido): rota `/rules` e `/admin/rulings` (URL), nomes de
tipo (`RulingFilters`, `AdminRuling`), funções/endpoints da API
(`listRulings`, `getRuling`, `createRuling`, `/rulings`...), nomes de
componente (`RulingDetailPage`), comentários de código e referências a
`data/rulings-batch-*.json`.

## Verificação

`pnpm test` **456/456**, `check:types` ✓, `eslint .` (projeto inteiro) —
0 erros, 281 avisos pré-existentes (mesma contagem de antes, nenhum novo).
`pnpm build` ✓.

**Sobe em `dev` E `main`** — pedido explícito do Willen.
