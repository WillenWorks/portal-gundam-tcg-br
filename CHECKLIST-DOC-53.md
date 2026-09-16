# Checklist — docs/53 (Imagens e Traduções PT-BR de ST05 e GD01)

Status de execução das 5 sessões descritas em `docs/53-instrucoes-imagens-e-traducoes-st05-gd01.md`.
Todas as 5 sessões foram concluídas e validadas integralmente.

---

## Sessão 1 — Banco de Dados: Promoção de Prints Primários e Limpeza de Fantasmas

- [x] Script `prisma/cleanup-phantom-prints.mjs` expandido com migração de integridade relacional para `DeckItem` e `CardBinderItem`.
- [x] Resolução dos 6 prints fantasmas com `imageUrl: null`:
  - `GD01-001` (Gundam): referências em `DeckItem` migradas para o print real com imagem CDN; print real promovido a `isPrimaryPrint: true`; fantasma removido.
  - `GD01-090` (Duo Maxwell): referências em `DeckItem` migradas para o print real com imagem CDN; print real promovido a `isPrimaryPrint: true`; fantasma removido.
  - `GD01-099` (Intercept Orders): print real promovido a `isPrimaryPrint: true`; fantasma removido.
  - `GD01-129` (Kusanagi): print real promovido a `isPrimaryPrint: true`; fantasma removido.
  - `R-002` (Resource): print real promovido a `isPrimaryPrint: true`; fantasma removido.
  - `T-011` (Fatum-00): print real promovido a `isPrimaryPrint: true`; fantasma removido.
- [x] Execução com flag de aplicação: `node prisma/cleanup-phantom-prints.mjs --apply`.
- [x] Validação direta no banco PostgreSQL:
  - 100% dos 130 CardModels numerados de GD01 (`GD01-001` a `GD01-130`) possuem print primário ativo (`isPrimaryPrint: true`) com `imageUrl` válido apontando para o CDN oficial do TCGPlayer.
  - Cartas de ST05 confirmadas com 100% de imagens válidas no banco.

**Status: ✅ Completo**

---

## Sessão 2 — Pipeline de Tradução pt-BR de GD01 (108 cartas pendentes)

- [x] Pipeline incremental executado com modelo `gemini-3.5-flash-lite` via `scripts/translate-card-effects.mjs --sets=GD01 --resume`.
- [x] Alinhamento estrito ao glossário oficial da Bandai TCG e regras de estilo (`docs/17` e `docs/51`):
  - `"Rest it."` $\to$ `"Coloque-a em Rest."`
  - `"Rest this Unit:"` $\to$ `"Coloque esta Unidade em Rest："`
  - `"Rest this Base:"` $\to$ `"Coloque esta Base em Rest："`
  - `"Deploy this card."` $\to$ `"Faça o Deploy desta carta."`
  - `"Deixe-a em Active."`, `"à sua mão"`, `"área de escudos"`, `"Recurso em Rest"`, `"Unidade em Rest"`.
  - Preservação integral dos tokens protegidos `§N§` (`【...】`, `<...>`, `[Nome]`, `(Traits)`, `AP`, `HP`, `Lv.X`).
  - Palavras-chave congeladas mantidas intactas (Deploy, Burst, When Paired, During Pair, During Link, Once per Turn, Blocker, Breach, Repair, First Strike, High-Maneuver, Suppression, etc.).
- [x] Validação estrutural de multiset de tokens:
  - `node scripts/translate-card-effects.mjs --sets=GD01 --revalidate`
  - Resultado: **130 cartas analisadas: 130 OK (110 com texto traduzido + 20 vanillas), 0 REJEITADAS**.
- [x] Persistência no PostgreSQL:
  - `node --env-file=.env scripts/translate-card-effects.mjs --sets=GD01 --push`
  - Atualização confirmada de **110 registros em `CardModel`** e **236 registros em `Card` (prints)** sem corrupção de encoding UTF-8 no Windows.

**Status: ✅ Completo**

---

## Sessão 3 — Integração no Frontend do Simulador (`SimulatorMatchPage.tsx`)

- [x] Atualizado `ART_SET_CODES` para incluir `"ST05"` e `"GD01"`:
  ```ts
  const ART_SET_CODES = ["ST01", "ST02", "ST03", "ST04", "ST05", "GD01"];
  const GENERIC_ART_SET_CODES: string[] = [];
  ```
- [x] Mapeamento de aliases de recursos atualizado em `ART_CODE_ALIASES`:
  - `"ST03-RESOURCE": "R-001"`
  - `"ST04-RESOURCE": "R-001"`
  - `"ST05-RESOURCE": "R-001"`
  - `"RESOURCE-01": "R-001"`
- [x] Validação do hook `useCardArtLookup()`:
  - Popula adequadamente o cache `art` com URLs de CDN de ST01 a ST05 e GD01.
  - Popula `cardText` com `{ pt, en }` para exibição bilíngue no inspetor.
  - Popula `cardByName` permitindo resolução de pilotos linkados de ST05 (Mikazuki Augus, Akihiro Altland, McGillis Fareed) e GD01.

**Status: ✅ Completo**

---

## Sessão 4 — Inspetor de Campo: Telemetria, Links de Piloto e Validação Visual

- [x] `CardInspectorModal.tsx` e `CardInspectorPanel.tsx` auditados e verificados em modo `inPlay={true}`:
  - **Resolução de Arte**: Carregamento da arte em alta resolução via CDN do TCGPlayer para todas as cartas de ST01 a ST05 e GD01.
  - **Tradução pt-BR por padrão**: Cartas com efeito exibem `effectPt` como visualização inicial padrão.
  - **Alternador Bilíngue**: Botão `[ PT | EN ]` funcional permitindo alternar instantaneamente entre o texto original em inglês e a tradução oficial.
  - **Retratos de Pilotos Linkados**: `resolveLinkedPilots` exibe avatar do piloto via `cardByName` com badges de disponibilidade ("Na mão" ou "Em campo").
  - **Estatísticas Dinâmicas em Jogo**: AP e HP refletem dano acumulado (`effectiveHp - damage`), bônus de piloto pareado e modificadores contínuos.
  - **Layout Limpo para Vanillas**: Cartas sem efeito (ex.: ST05-004, GD01-011) omitem a seção de efeito sem quebras ou blocos vazios.
- [x] Criação de suíte de testes de regressão automatizada em `src/modules/simulator/ui/CardInspectorModal.test.tsx`:
  - Teste 1: Renderização de ST05 (*Gundam Barbatos*) com link para *Mikazuki Augus* e alternância bilíngue PT/EN.
  - Teste 2: Renderização limpa de vanilla de GD01 (*Loto* GD01-011) sem bloco vazio de efeito.
  - Teste 3: Estatísticas dinâmicas em jogo (`inPlay={true}`) refletindo dano de combate recebido (ex.: HP 5 - 2 de dano = 3).

**Status: ✅ Completo**

---

## Sessão 5 — Testes Automatizados e Auditoria de Regressão

- [x] Checagem de tipos TypeScript estática:
  ```bash
  pnpm exec tsc -b
  ```
  - **Resultado**: Código de saída 0, **zero erros de compilação**.
- [x] Suíte de testes unitários do simulador:
  ```bash
  pnpm vitest run src/modules/simulator/ui
  ```
  - **Resultado**: **29 arquivos de teste passaram (29/29), 278 testes passaram (278/278), 0 falhas**.
- [x] Auditoria de catálogo:
  ```bash
  node scripts/gundam-audit-catalog.mjs
  ```
  - **Resultado**: **0 divergências** nas coleções locais ST01 a ST04.

**Status: ✅ Completo**

---

## Resumo Geral de Entregas

| Sessão | Escopo | Meta Planejada | Resultado Obtido |
|---|---|---|---|
| **Sessão 1** | Banco de Dados / Prisma | Limpeza de 6 fantasmas e promoção de primários | 100% dos 130 CardModels de GD01 com imagem CDN ativa |
| **Sessão 2** | Pipeline de Tradução | 108 cartas pendentes de GD01 traduzidas em pt-BR | 130/130 OK (110 com efeito, 20 vanillas), 0 rejeitadas, push no Postgres |
| **Sessão 3** | Integração Frontend | ST05 e GD01 no lookup de arte e aliases de recursos | `ART_SET_CODES` e `ART_CODE_ALIASES` atualizados em `SimulatorMatchPage.tsx` |
| **Sessão 4** | Inspetor de Campo | Imagens CDN, PT/EN toggle, links de pilotos e stats | Validação visual e 3 novos testes em `CardInspectorModal.test.tsx` |
| **Sessão 5** | QA / DevOps | `tsc -b`, Vitest e Auditoria de Catálogo | `tsc -b` (0 erros), Vitest (278/278 passed), Auditoria (0 divergências ST01-04) |

**Todos os objetivos do plano `docs/53-instrucoes-imagens-e-traducoes-st05-gd01.md` foram concluídos e validados.**
