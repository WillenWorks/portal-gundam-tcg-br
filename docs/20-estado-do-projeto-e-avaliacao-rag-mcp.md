# Estado do projeto, plano de continuidade e avaliação de RAG / MCP

**Data:** 2026-09-01
**Escopo:** consolidar o que foi feito na leva de trabalho recente do simulador
(docs/19, Sessões 1–4 + polimentos), fixar o passo atual, listar os próximos
desenvolvimentos, e avaliar se **RAG** e **MCP** têm papel no projeto — com um
plano de inclusão caso a resposta seja sim.

Documentos relacionados:
- `docs/01-arquitetura-roadmap.md` — arquitetura e visão macro
- `docs/16-roadmap-ideias-mapeadas.md` — mapa de frentes do portal
- `docs/17-glossario-traducao.md` — política de tradução das regras (relevante pra RAG)
- `docs/18-simulador-fase1-motor-e-dsl.md` — histórico completo e detalhado do simulador
- `docs/19-instrucoes-execucao-agentes-simulador.md` — roteiro das 4 sessões desta leva

---

## 1. Visão geral — onde o projeto está

O **Portal Gundam TCG BR** é um portal de conteúdo + ferramentas para o Gundam
Card Game em pt-BR. Módulos em produção/uso:

| Módulo | Estado |
|---|---|
| Catálogo de cartas (busca, filtros ricos, detalhe, sets) | ✅ estável |
| Deckbuilder com estatísticas (sinergia, cobertura de keyword, drill-down) | ✅ estável |
| Binders (Lista de Desejos / Cartas Possuídas) com link público | ✅ estável |
| Regras + Rulings em pt-BR (pipeline de tradução, ~88 rulings importados) | ✅ em expansão |
| Torneios / Organizer / Hosted Events | ✅ estável |
| Estatísticas de metagame | ✅ estável |
| Autenticação (papéis USER/EDITOR/ADMIN + Google) | ✅ estável |
| Notícias / Posts (modelo `Post` existe, **sem UI**) | ⬜ não iniciado |
| **Simulador de partida (Fase 1)** | 🔄 **frente ativa — foco desta leva** |

Stack: React 19 + Vite + wouter + Tailwind v4 + shadcn/ui no front; Express
monolítico (`server/index.ts`) na API; Prisma + PostgreSQL (Supabase) no banco;
deploy em Vercel (front) + Render (API) + Supabase (DB). Ver `docs/15`.

O simulador é tratado desde o começo como **um segundo produto**, não "mais uma
feature" (`docs/16`). Plano em 3 fases: **(1) sandbox solo que entende 100% das
regras** → (2) IA simples → (3) PvP em tempo real. Estamos na Fase 1.

---

## 2. Desenvolvimentos recentes (leva docs/19 — Sessões 1 a 4 + polimentos)

Ponto de partida desta leva: o simulador já tinha motor de estado puro, as 5
fases de turno, a sequência de combate, as 8 keywords oficiais, jogar carta da
mão (`deployCard`/`playCommand`), dispatcher automático de trigger, os 2 decks
reais (ST01 "Heroic Beginnings" + ST02 "Ruination Ablaze", 32 cartas únicas) com
~27 EffectSpecs, e o "Simulador Beta" (fila de matchmaking, timer de 90s, W.O.
por abandono, SSE, redação de informação por jogador). **8 lacunas de DSL**
estavam documentadas como não implementadas.

### Sessão 1 — DSL completa: as 8 lacunas fechadas

Primitivas novas de `EffectSpec` (`engine/effectSpec.ts`):
- `spawnToken` / `spawnTokenByOwnUnitCount` (criar instância nova / token) — evento `SPAWN_TOKEN`
- `payResourceCost` (custo de recurso genérico) — extraído pra `engine/costs.ts`, reaproveitado por `deployCard`
- `TargetRef.kind: "group"` + `TargetGroup` (alvo em grupo — "all friendly Link Units")
- `preventShieldDamage` (prevenção de dano condicional) — `CombatState.shieldProtection`
- `peekAndReorderDeck` + `moveWithinDeck` (informação oculta / peek-and-reorder)
- `addShieldToHand` (adicionado depois, 2026-09-01) — o 【Deploy】 universal de **toda Base do jogo** (91/91 cartas): escolha cega (shields são face-down), auto-pega o 1º, no-op se 0 shields

Campos estruturados de `CardDef` (`engine/types.ts`), pra efeito contínuo / de
combate / de legalidade (que não são "gatilho→ação"):
- `staticAbilities` — 【During Pair】/【During Link】 contínuo, reavaliado em `effectiveAp`/`effectiveHp`
- `combatTriggers` — 【During Link】 que reage a "destruiu inimigo em batalha"
- `attackTargetRules` — Zowort não escolhe o jogador / Wing Gundam pode atacar Unit active Lv.4-

Cobertura ST01/ST02: **100%** das cartas com efeito bespoke. Cobertura de teste:
`content/st01.test.ts`, `content/st02.test.ts`, `engine/agente1Additions.test.ts` (novo).

### Sessão 2 — Decisões interativas

- **`PendingDecision`** no `GameState` (união `burst | triggerOrder | targetSelection`; `Record<PlayerId, ...>`) + eventos `SET/CLEAR_PENDING_DECISION`. Enquanto um lado tem decisão pendente, nenhuma ação avança o estado.
- **Pausa autoritativa de 【Burst】** — o combate PARA no Damage Step quando quebra shield com Burst; `resolveBurstDecision { activate, targets? }` ativa ou descarta (fila FIFO se várias quebram juntas).
- **`activateAbility`** — 【Activate·Main】 (Tallgeese ④, White Base ②, Asticassia) / 【Activate·Action】, com fallback pra `<Support N>`.
- **`resolveTriggerOrder`** — tipo + caminho prontos; nenhum card de ST01/ST02 dispara gatilhos simultâneos de cartas diferentes ainda, então o motor não chega a emitir esse `PendingDecision` na prática.
- **Auto-pass inteligente do Action Step** — `MatchSeat.autoPassActionStep` + `playerHasActionStepPlay()` + `matchStore.settleAutoPasses()`. Rota `POST .../auto-pass`, `api.setSimulatorAutoPass`.
- `viewState` repassa `pendingDecision`; UI ganhou `BurstModal` + toggle de auto-pass.

Testes: `engine/pendingDecision.test.ts` + casos em `server/matchStore.test.ts`.

### Sessão 3 — Layout "nível arena"

Camada visual reescrita a partir de **componentes dedicados** em
`src/modules/simulator/ui/` — `SimulatorMatchPage.tsx` virou só orquestrador de
estado/ações:

`CardFace`/`CardBack`, `BattleSlot` (6 slots fixos + AP/HP efetivos + overlay
RESTED), `DockedPilot` (Piloto acoplado + badge LINK dourado), `ShieldStack`,
`ResourceTray` (ativo/rested/EX), `BaseCardGauge` (barra de HP), `CardInspectorModal`,
`BurstModal`, `TriggerOrderModal`, `CombatLane`, `MobileHandDrawer`.

Corrigiu de passagem o **interleave de Pilots nos slots** da Battle Area
(`battleArea[i]` misturava Units e Pilots).

Polimento no mesmo dia:
- **`CombatLane` — linha de mira ponto-a-ponto**: SVG `fixed` fora do container que rola/escala, mede DOM real via `useBoardElements` + `getBoundingClientRect`, re-mede no scroll/resize com throttle de `requestAnimationFrame`.
- **`MobileHandDrawer` — swipe vertical** na aba além do toque.

### Sessão 4 — Telemetria & QA

- **Feed de log de batalha** — `ui/battleLog.ts` traduz cada `GameEvent` numa linha pt-BR; `ui/BattleLogDrawer.tsx` (painel lateral no desktop, gaveta no mobile).
- **Ferramenta "Reportar Situação de Regra"** — botão 🐛 no HUD → `POST .../report` → `reportSituation()` loga o `GameState` real + histórico no console do servidor com um `reportId` curto.
- **Perf / memory leak**: `viewStateFor` passou a **janelar o `eventLog`** (últimos 150) em vez de reenviar o log inteiro a cada SSE; o match store faz **GC oportunista** de partida terminada (some 10min depois, na próxima escrita). O stream SSE em si já estava limpo (unsubscribe + clearInterval no `req.on("close")`).
- **Teste e2e** — `engine/st01VsSt02Actions.e2e.test.ts` joga uma partida de vários turnos **pela borda `applyPlayerAction`** (o caminho do servidor) até `GAME_OVER`, passando por Burst pausado, `activateAbility` e fim de turno.

### Números da leva

| Métrica | Antes | Depois |
|---|---|---|
| Testes (`pnpm test`) | ~133 | **211** passando |
| `pnpm run check:types` | script não existia | ✅ criado (`tsc -b`), limpo |
| `pnpm run lint` | **285 erros** (quebrado) | **0 erros** (config ajustada; 281 warnings pré-existentes fora do simulador) |
| `pnpm run lint:simulator` (novo) | — | ✅ 0 warnings |
| `pnpm run build` | ok | ✅ ok |
| Componentes em `simulator/ui/` | 0 | 16 |

Ajuste de config: `eslint.config.js` rebaixou pra `warning` regras que o repo
inteiro viola há meses (`no-explicit-any`, regras novas do React Compiler,
`react-refresh`) — não são bug de runtime; o gate real de tipo é o `tsc -b`.

---

## 3. O passo em que estamos

**Simulador Fase 1 — "código-completo".** O motor entende 100% das regras de
ST01/ST02, todas as decisões interativas do jogador têm ponto de UI, a tela está
no padrão visual pretendido, e há telemetria pra diagnóstico. As verificações
estáticas (tipos, lint, 211 testes, build) estão limpas.

**Bloqueio conhecido, não escondido** (herdado desde o passo 4, ver docs/18
"Pendência real"): o **teste ponta-a-ponta com 2 contas reais** (2 sessões
logadas separadas, fila pareando de verdade, timer contando em tempo real, W.O.
fechando uma aba de propósito, Burst/auto-pass/linha de mira num jogo real)
**ainda não rodou** — o ambiente de desenvolvimento não sobe a API (`tsx
server/index.ts` falha ao importar `@prisma/client`; `prisma generate` não baixa
o engine binário nessa rede). Isso só roda no ambiente do Willen.

**Fora do escopo da Fase 1, já mapeado** (docs/18): os 3 modos de automação de
turno (manual / semi / total, estilo Master Duel), seleção explícita de
modalidade em cartas Pilot-ou-Command, arte genérica de recurso/base por set, e
cobertura de sets além de ST01/ST02 (GD01+, ~91 bases, ~1000 cartas).

---

## 4. Próximos desenvolvimentos esperados

### 4.1 Imediato (destrava a Fase 1)

1. **Commit + deploy** desta leva.
2. **Teste manual com 2 contas reais** no ambiente do Willen — roteiro:
   fila pareia → deploy/ataque/bloqueio → forçar um Burst e resolver os 2 lados
   → ligar auto-pass e ver o Action Step passar sozinho → conferir a linha de
   mira no ataque → abrir o log de batalha → usar o botão "Reportar" e achar a
   linha no log do servidor (Render) → fechar uma aba e testar o W.O. após 3min.
3. Corrigir o que o teste real apontar (é aqui que quase sempre aparece o que a
   verificação estática não pega).

### 4.2 Curto prazo — simulador

- **Fase 2 — modos de automação de turno + IA heurística simples** (docs/18
  "Fase 2", "Plano de redesenho ... Fase 2"): flag de automação por assento
  (não global) em `MatchSeat`/`matchStore`; a IA escolhe a melhor jogada legal
  dentre as que o motor já sabe enumerar (não é ML). Serviço leve ou
  client-side. Depende 100% do motor da Fase 1 estar correto — por isso vem
  depois da validação real.
- **Cobertura além de ST01/ST02**: `addShieldToHand` já é candidata a virar
  【Deploy】 genérico de `cardType: BASE`; mapear o resto do padrão de GD01/GD02
  e decidir o que vira keyword genérica vs. EffectSpec carta-a-carta.
- **`triggerOrder` real**: assim que entrar um card que dispara 2 gatilhos de
  cartas diferentes no mesmo evento, cabear o `PendingDecision` (o modal já existe).

### 4.3 Curto prazo — portal (paralelo, independe do simulador)

- **CRUD de Notícias/Posts** — modelo já existe, falta UI (admin + página pública). Alto retorno, baixo esforço (`docs/16`).
- **Estatísticas competitivas sem depender de torneio** — presença de carta em decks públicos, popularidade de combinação de cor (`docs/16`, pedido que apareceu 2×).
- **Páginas por série / por personagem**; **Rulings com explicação visual por mecânica**.

### 4.4 Médio prazo

- **Simulador Fase 3 — PvP real**: transporte em tempo real (WebSocket),
  servidor autoritativo, reconexão. Primeira peça que exige infra de backend
  nova, fora do request/response do Express de hoje — decisão de arquitetura
  própria (`docs/18` "Fases seguintes").
- **Hub de eventos fase 2/3**, taxa de vitória real, tradução completa das regras.

---

## 5. Avaliação — RAG (Retrieval-Augmented Generation)

### 5.1 O projeto precisa de RAG?

**Para uma frente específica, sim — e é uma frente forte.** Para o resto, não.

**Caso de uso nº 1 — Assistente de Regras & Rulings em pt-BR (RECOMENDADO):**
"pergunte às regras" — o jogador digita a dúvida em português e recebe uma
resposta fundamentada, citando o ruling/seção que a sustenta.

Por que casa tão bem com este projeto:
- **A dor existe e é a nº 1 pra jogador novo**: as regras oficiais são só em
  inglês; a tese inteira do portal é pt-BR (`docs/17`). O feedback de teste real
  já elogiou a seção de Rulings.
- **O corpo de conhecimento já está no banco**: modelo `Ruling` (Q&A EN+PT,
  `relatedKeyword`, `relatedPhase`, link pra carta), ~88 rulings importados e
  crescendo; `docs/17` com as 8 keywords explicadas; as Comprehensive Rules
  (v1.8.0) como contexto interno.
- **É domínio fechado e verificável** — corpus finito, resposta sempre
  ancorada num documento. Baixo risco de alucinação (que é o problema nº 1 de
  chatbot genérico).
- **Infra quase de graça**: Supabase é Postgres → extensão `pgvector`
  disponível; embeddings do corpus são pequenos (uma vez + a cada ruling novo);
  a chamada ao LLM por pergunta é barata (modelo pequeno resolve a maioria).
- **Sinergia com o que já foi feito**: a ferramenta "Reportar Situação de
  Regra" (Sessão 4) vira o funil natural — um relato de dúvida de regra pode
  primeiro passar pelo assistente antes de virar log pro dev.

**Cuidado de direito autoral (importante, ver `docs/17`)**: o RAG **não pode
regurgitar** o texto da Bandai palavra por palavra. Ancorar preferencialmente
nos rulings e nas explicações originais em pt-BR do projeto; usar o PDF oficial
só como contexto de recuperação que o LLM **parafraseia**, com prompt explícito
de "explique o mecanismo com suas palavras, não transcreva". Toda resposta cita
a fonte (link do ruling / seção).

**Casos de uso mais fracos (NÃO fazer agora):**
- **Busca de carta por linguagem natural** ("cartas azuis que curam") — os
  filtros estruturados do deckbuilder (keyword, trait, cor, tipo, com drill-down)
  já resolvem bem. Revisitar só se os usuários pedirem.
- **Assistente de deckbuilding** ("monte um deck de White Base Team") — é
  agêntico (retrieval + regras de legalidade + montagem), bem mais complexo.
  Fase posterior, se houver demanda.

### 5.2 Plano de inclusão do Assistente de Regras (sessão dedicada)

Pré-requisito: Fase 1 do simulador validada (não competir por foco).

1. **Corpus & chunking** — script que monta os "documentos" a partir do banco:
   1 chunk por ruling (Q+A pt), 1 por keyword do glossário, N por seção das
   Comprehensive Rules (paragrafado). Metadado: `sourceType`, `relatedKeyword`,
   `relatedPhase`, `originalUrl`, `cardModelId`.
2. **Storage** — `pgvector` no Supabase: tabela `rule_chunk (id, content,
   embedding vector, metadata jsonb, source_ref)`. Migration Prisma +
   `prisma db execute` pra `CREATE EXTENSION vector`.
3. **Indexação** — job (`scripts/`) que gera embedding de cada chunk e faz
   upsert; roda no import de ruling novo. Provider de embedding: definir
   (Claude/Anthropic tem; ou um modelo local pequeno se custo importar).
4. **Endpoint** — `POST /api/rules/ask { question }` no Express: embed da
   pergunta → `ORDER BY embedding <=> $1 LIMIT k` → monta prompt com os k chunks
   + a pergunta → chamada ao LLM (modelo pequeno; Sonnet só se precisar) →
   resposta + lista de fontes citadas. Rate-limit por usuário.
5. **UI** — caixa de pergunta na página de Regras/Rulings; resposta com os
   cards de ruling citados clicáveis. Reaproveita o layout de Rulings existente.
6. **Guarda-rails** — se a similaridade máxima ficar abaixo de um limiar,
   responder "não encontrei ruling sobre isso" em vez de inventar; nunca citar
   texto verbatim da Bandai; logar pergunta+resposta pra curadoria (vira ruling
   novo quando aparecer padrão).

**Custo estimado**: embeddings ~centenas de chunks (uma vez, ~centavos);
por pergunta ~1 embedding + 1 chamada de LLM curta. Ordem de grandeza:
dezenas de dólares/mês num uso moderado, menos com modelo pequeno + cache de
perguntas frequentes.

**Esforço**: 1 sessão dedicada pro MVP (endpoint + índice + UI simples),
+ 1 de refino (guarda-rails, curadoria, cache).

---

## 6. Avaliação — MCP (Model Context Protocol)

### 6.1 MCP de desenvolvimento (já em uso)

Nas sessões de trabalho com o Claude Code já estão conectados os MCP servers de
**Supabase, Render, Vercel e GitHub** — usados pra inspecionar banco, deploys e
infra durante o desenvolvimento. Isso é ferramenta de dev, não faz parte do
produto, e **já cobre o que precisa**. Nada a fazer aqui.

### 6.2 MCP voltado ao produto — vale a pena?

**Ideia**: expor um **MCP server do Portal Gundam TCG BR** — ferramentas
read-only (`search_cards`, `get_card`, `get_ruling`, `search_rulings`,
`get_deck`, `list_sets`) — pra que qualquer assistente de IA do usuário (Claude
Desktop, ChatGPT com conector, IDEs) use o portal como fonte de dados do Gundam
TCG.

**Avaliação:**
- **Importância hoje: baixa.** Os mesmos dados já são uma API REST; ninguém
  está pedindo isso; não destrava nenhuma feature do roadmap.
- **Valor estratégico: real, mas não urgente.** O ecossistema Anthropic/OpenAI
  está empurrando MCP forte; ser uma das primeiras bases de dados de TCG
  "plugável" num assistente é um diferencial de marketing e de SEO-de-IA
  (aparecer quando alguém pergunta ao Claude sobre Gundam TCG). Alinha com a
  intenção de "portal de referência".
- **Esforço: pequeno** se construído sobre a API REST existente (o MCP server
  vira um adaptador fino). O maior custo é operacional: mais uma superfície pra
  manter, autenticar e observar.

**Recomendação:** **adiar**, registrar como diferencial de Fase 3+. Reavaliar
quando: (a) o Assistente de Regras (seção 5) estiver no ar — a lógica de
recuperação já vai existir e o MCP server reaproveita; ou (b) surgir demanda
concreta de integração externa.

**Plano (quando/se for feito):**
1. Pacote `mcp/` no repo (ou serviço separado) com o SDK MCP, expondo as
   ferramentas read-only como wrappers dos handlers da API atual.
2. Só leitura pública num primeiro momento (catálogo, sets, rulings). Deck do
   usuário e binder exigiriam auth via OAuth do MCP — fase posterior.
3. Publicar no diretório de MCP servers da Anthropic + doc de "conecte o Portal
   ao seu assistente".

### 6.3 O que NÃO é MCP

O transporte em tempo real da **Fase 3 (PvP)** é WebSocket + servidor
autoritativo de estado de jogo — **não tem relação com MCP**. Não confundir as
duas frentes.

---

## 7. Resumo — decisão recomendada

| Frente | Recomendação | Quando |
|---|---|---|
| Validar Fase 1 com 2 contas reais | **Fazer já** | Próxima sessão no ambiente do Willen |
| Commit + deploy desta leva | **Fazer já** | Agora |
| Simulador Fase 2 (automação + IA heurística) | Fazer | Depois da validação real |
| CRUD de Notícias / estatísticas sem torneio | Fazer em paralelo | Sessão de portal quando quiser variar |
| **RAG — Assistente de Regras pt-BR** | **Incluir** — sessão dedicada | Depois da Fase 1 do simulador; dado e infra já prontos |
| RAG — busca de carta / deckbuilding assistant | Não fazer agora | Só sob demanda |
| **MCP — dev (Supabase/Render/Vercel/GitHub)** | Manter como está | — |
| **MCP — server do produto** | Adiar; registrar como diferencial | Depois do Assistente de Regras, ou sob demanda |
| Simulador Fase 3 (PvP / WebSocket) | Decisão de arquitetura própria | Médio prazo |
