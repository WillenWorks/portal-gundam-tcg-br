# Manual de Desenvolvimento — Portal Gundam TCG BR

> **Compilado em:** 2026-09-14
> Este documento consolida o conteúdo de arquivos de processo/sessão (transcrições
> de debate multi-agente, planos de implementação avulsos na raiz do repo) que
> foram removidos do controle de versão nesta mesma data — eles continuam
> existindo no ambiente local do autor, mas o git só guarda esta versão
> compilada. Ver [§7](#7-nota-de-manutenção) para os detalhes da remoção.

## Sumário

1. [Visão do produto](#1-visão-do-produto)
2. [Linha do tempo](#2-linha-do-tempo)
3. [Arquitetura do motor do simulador](#3-arquitetura-do-motor-do-simulador)
4. [Processos de desenvolvimento](#4-processos-de-desenvolvimento)
5. [Estado atual e pendências conhecidas](#5-estado-atual-e-pendências-conhecidas)
6. [Planos consolidados](#6-planos-consolidados)
7. [Nota de manutenção](#7-nota-de-manutenção)

---

## 1. Visão do produto

O **Portal Gundam TCG BR** é um ecossistema brasileiro unificado para o
**Gundam Card Game**: portal de conteúdo + utilitário competitivo + base de
consulta traduzida, evoluindo para uma plataforma completa com deckbuilder,
analytics, torneios, conteúdo editorial e simulador. O diferencial não é só
"ter informação" — é reduzir a fricção de entrada do jogador brasileiro:
entender regras/rulings em pt-BR, montar decks dentro das regras oficiais,
interpretar estatísticas competitivas, e (cada vez mais) treinar/jogar contra
IA ou outros jogadores.

Identidade visual/temática atual: **Anaheim Hub** — laboratório tático e
engenharia de combate. O deckbuilder é o "Hangar da OZ", o simulador é a
"Arena Asticassia", as estatísticas são o "Sistema VEDA", o catálogo é o
"Arquivo Central Anaheim".

### Stack tecnológica

| Camada | Tecnologia | Hospedagem |
|---|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, wouter | Vercel (`main`) |
| Backend & API | Node.js 20, Express 5, Socket.IO, Prisma ORM | Render (`render.yaml`, Web Service) |
| Banco de dados | PostgreSQL 16 | Supabase (Session Pooler, porta 5432) |
| Storage de imagens | Supabase Storage (bucket `card-images`) | Supabase |
| Autenticação | JWT nativo + Google OAuth (GIS/One Tap) | — |

O servidor Express no Render é um **processo real, não serverless** — decisão
tomada cedo (docs/15) justamente porque o simulador ia precisar de WebSocket/
estado de longa duração, algo que uma função serverless não sustenta bem. O
mesmo processo web também roda o runner assíncrono do bot de treino solo, sem
precisar de um worker/container adicional (embora `render.yaml` já preveja um
Background Worker opcional, caso a concorrência exija).

### Módulos do produto

- **Catálogo & Regras**: catálogo completo dos Starter Sets + Boosters/Promos,
  textos de efeito traduzidos pra pt-BR preservando keywords oficiais em
  inglês, rulings/FAQ indexados, curadoria de vínculos Unidade↔Piloto.
- **Deckbuilder Tático**: criação/validação de deck conforme regras oficiais
  (50 cartas principais + 10 recursos, máx. 2 cores, máx. 4 cópias por carta),
  análise estatística completa (curva de custo, distribuição de nível/tipo/
  cor), cálculo hipergeométrico de mão inicial, capas customizadas, export/
  compartilhamento público.
- **Coleção pessoal**: pastas (binders) com drag-and-drop e galeria.
- **Torneios e eventos**: cadastro de torneios/eventos hospedados, rodadas,
  confrontos, participantes; Power Rankings e Matriz de Confrontos (VEDA).
- **Simulador de partidas em tempo real**: motor autoritativo 100%
  server-side, com Fila Online, Convite Direto (link) e Treino Solo contra
  bot (heurística ou MCTS). Ver [§3](#3-arquitetura-do-motor-do-simulador).
- **Conta e administração**: login email/senha ou Google, painel admin
  completo (cartas, coleções, rulings, traits, temporadas, eventos).
- **Pipeline de Machine Learning** (em desenvolvimento): extração de dataset
  a partir dos logs reais de partida (`SimulatorMatchLog`), treino via
  TensorFlow.js. Em produção o bot roda **estritamente heurística
  determinística**; o modelo neural só é ativado em `dev` sob flag.

---

## 2. Linha do tempo

### Antes do versionamento formal (pré `v0.3.0`)
Protótipo navegável inicial do portal, sem persistência real.

### v0.3.0 → v0.4.1 — Fundações
- **v0.3.0**: persistência local no navegador alinhada à modelagem do Prisma
  (pra facilitar a troca futura por backend real), CRUD do admin pra cartas/
  rulings/eventos.
- **v0.4.0**: primeiro backend/API real (Prisma em runtime), autenticação com
  papéis, múltiplos decks por usuário.
- **v0.4.1**: correção do seed do Prisma em ambiente ESM.

### v0.9.0 (2026-09-04) — Primeira versão numerada
Marco grande: simulador jogável ponta a ponta pela primeira vez.
- Motor de regras cobrindo ST01+ST02 completo: 5 fases de turno, 5 etapas de
  combate, as 8 keywords oficiais, pareamento de Piloto, Burst, efeitos
  【Deploy】/【Attack】/【When Paired】/【During Pair】/【Activate】, dano em Base/
  Shield, deck-out.
- Mulligan interativo, jogo remoto entre 2 jogadores com fila de pareamento,
  timer de turno, W.O. por abandono, reconexão automática e **persistência
  real** (a partida sobrevive a queda de conexão/restart/deploy).
- Visual "Nível Arena": tabuleiro 3D espelhado, ações no canto da carta,
  inspetor lateral, log de batalha.
- Catálogo com 1.800+ cartas / 1.000+ modelos únicos em 22 coleções; 90
  rulings oficiais traduzidas.
- Torneios/eventos hospedados; login email/Google; painel admin completo.

Este período (docs/18 a docs/37) documenta uma sequência intensa de sprints de
V&V (Verificação e Validação) rumo ao 1.0 — vale destacar porque estabeleceu
padrões que se mantêm até hoje:
- **docs/25-29 (Sprints V0-V4)**: legalidade de alvo genérica (fim de filtro
  hardcoded no cliente pra 1 carta só), auditoria carta a carta ST01+ST02
  contra o texto oficial, mecânicas centrais revalidadas contra as 88 rulings
  oficiais importadas, auditoria de integridade server-authoritative (toda
  `PlayerAction` — ownership, fase/turno, custo), e o checklist de "processo
  de carta nova" que ainda orienta a inclusão de cada carta hoje.
- **docs/30-36 (rodadas de ajuste visual)**: uma sequência longa de correções
  de dimensionamento dinâmico da arena a partir de prints reais em várias
  resoluções (widescreen, notebook 14", mobile paisagem/retrato) — motor e
  servidor sempre intocados, só CSS/layout.
- **docs/37**: limpeza de arquivos soltos na raiz, organização de `.md` legado
  numa pasta própria (`docs/legado/`), tradução de "Ruling" → "Regras" na UI.

### v1.0.0 (2026-09-06) — Primeiro release numerado
- Curva de nível das Units no deckbuilder, mão inicial com garantia de Unit
  de nível baixo.
- Textos de efeito de ST01-ST04 traduzidos pra pt-BR.
- **ST03 "Zeon's Fangs" e ST04 "Aile of Justice" jogáveis** (32 cartas
  únicas): revelar topo do deck, deploy gratuito da mão, 【Destroyed】 (dentro
  e fora de combate), concessão temporária de alvo, prevenção de ataque/dano
  condicional.
- Visual sem scroll em qualquer resolução, inspetor por clique no corpo da
  carta, microinterações de setup/deploy/ataque.
- Rede em tempo real via **Socket.io** rodando ao lado do SSE, com Convite
  Direto por link (`GC-####`).
- Limitações conhecidas registradas nesse release: Socket.io ainda não
  promovido a produção (SSE era o caminho padrão), matchmaking ranqueado
  aceito no protocolo mas sem fila própria, dano-a-múltiplos-alvos das
  coleções GD/EB no backlog.

### v1.1.0 (2026-09-08) — Modo Solo + Telemetria
- **Treino Solo contra bot** (`/simulador/treino`), Starters ST01-ST04, 3
  níveis: Fácil (regras básicas), Normal (heurística determinística
  completa), Difícil (MCTS — Monte Carlo Tree Search).
- **Telemetria de partidas** (`SimulatorMatchLog`): toda partida (amistosa,
  rankeada ou treino) grava turnos/ações/deck/resultado — base para
  estatísticas de metagame futuras.
- Pipeline de ML inicial: extração de dataset (`train:dataset-from-logs`),
  com salvaguarda de produção (heurística só; ML fica em `dev`).
- Otimização do backend no Render (runner assíncrono embutido pro bot).
- Ajustes: preview de layout liberado em produção via `?preview=1`, simulador
  no mobile sem cortar lateral, animações de setup no tamanho real da carta.

Entre v1.1.0 e v1.2.0 (docs/48, docs/49) houve ainda uma auditoria completa de
efeitos condicionais e escolha de alvo nas 64 cartas únicas de ST01-ST04
(mergeada em `dev`/`main`) e o fechamento formal do Modo Solo com telemetria e
alinhamento de infraestrutura Render — a base que sustentou tudo que veio
depois em GD01.

### v1.2.0 (2026-09-09) — Identidade Anaheim Hub
Reformulação temática completa do portal (nomes/copy de cada módulo — ver
[§1](#1-visão-do-produto)), navegação modernizada.

### Pós-v1.2.0 — Wave GD01 e consolidação (2026-09-10 a 2026-09-14)
Esta é a fase mais recente e mais densa, ainda não refletida no
CHANGELOG.md/README.md publicados (ver [§7](#7-nota-de-manutenção)):

- **2026-09-10 a 2026-09-13**: implementação faseada da coleção **GD01**
  (130 cartas) no motor do simulador — trabalho coordenado por uma série de 7
  debates técnicos multi-agente (Gemini↔Claude) mais uma sessão de debate
  registrada em `.debate/`, todos condensados em [§4.3](#43-debates-técnicos-multi-agente-gemini↔claude).
  Nessa janela: correção de dados/gaps de motor em lotes sucessivos (Lote 1 a
  5), criação do gate de cobertura server-side (`deckCoverageGate.ts`), o
  split de `gd01.ts` (2647 linhas) em `content/gd01/` por faixa de cor
  (`unitsBlue/Green/Red/White.ts`, `pilots.ts`, `commands.ts`, `bases.ts`),
  fuzzing extensivo (heurística vs. randomLegal, heurística vs. heurística) e
  merge de `feature/wave-gd01` → `dev` (commit `b22b4b3`).
- **2026-09-14, sessão 1**: correção de 9 erros de TypeScript que quebravam o
  build de produção na Vercel (`b5c3077`); ampliação do simulador para
  **ST01 + 4 decks de teste GD01 + deck do próprio jogador** em todas as
  modalidades (Fila Online, Convite Direto, Treino Solo), com gate de
  cobertura reaproveitado também pro deck salvo do usuário e indicador
  verde/vermelho na UI (`8fa9216`).
- **2026-09-14, sessão 2**: dois ajustes finais — o seletor de decks tinha
  ficado restrito demais (só ST01 + GD01, faltando ST02/03/04) e 8 cartas de
  GD01 com `hasBurst: true` nunca ativavam de fato o Burst por falta de
  `EffectSpec` de trigger `"Burst"` cadastrado (achado ao investigar
  especificamente **Banagher Links**, GD01-088) — ambos corrigidos, com golden
  master e specs-signatures regenerados (`d645608`). Este manual e a limpeza
  de arquivos de processo do git também são desta sessão.

Fora da wave GD01 propriamente, no mesmo período: modernização visual do
Database de Cards/Coleções (banners parallax, grid de alta densidade — ver
[§6.1](#61-modernização-visual-database-de-cards-e-coleções)), central de
eventos/torneios com Power Rankings e Matriz de Confrontos (ver
[§6.3](#63-metagame-torneios-e-telemetria-veda)), e atualização de
dependências (zerando 102 vulnerabilidades do audit).

---

## 3. Arquitetura do motor do simulador

O simulador é, de longe, o subsistema mais complexo do produto. A regra de
ferro desde o início (repetida em quase todo doc de UI/visual do simulador):
**o motor de regras roda só no servidor; o cliente nunca decide o resultado
de uma jogada, só manda a intenção e desenha o que o servidor manda de
volta.**

### Camadas

```
Cliente (React)                      Servidor (Node/Express)
──────────────────                   ─────────────────────────
Páginas (Sandbox/Training/          REST (`/api/simulator/*`) +
Multiplayer/MatchPage)         ←──  Socket.io (queue/challenge/match)
      │                                     │
Intenção de UI                        matchStore.ts (estado das
(deployIntent/abilityIntent            partidas em memória + Prisma
— heurística de clique)               como persistência)
                                             │
                                       applyPlayerAction (borda)
                                             │
                              ┌──────────────┴──────────────┐
                              │      ENGINE PURO (src/modules/simulator/engine/)
                              │  types · setup · phases · combat · deploy ·
                              │  actions · dispatcher · abilityDispatch ·
                              │  effectSpec · events · keywords
                              └──────────────┬──────────────┘
                                             │
                              content/ (dados de cada coleção: CardDef +
                              EffectSpec — st01.ts..st04.ts, gd01/*)
```

- **Engine puro** (`src/modules/simulator/engine/`): funções puras
  `(GameState, Action) → GameState`, sem I/O, sem React, sem Prisma. É o
  único lugar que decide o que é legal e o que acontece. Testado por
  cima de milhares de casos (vitest) e por fuzzing (self-play
  heurística-vs-heurística e heurística-vs-randomLegal).
- **`server/matchStore.ts`**: estado das partidas em memória (Map), fila de
  matchmaking, presença/reconexão, persistência assíncrona pro Postgres
  (a partida sobrevive a restart/deploy), e a "redação" da visão de cada
  jogador (`viewStateFor`) — cada lado só vê a própria mão, o resto vem
  oculto.
- **Transporte**: REST + SSE (`/api/simulator/matches/:id/stream`) desde o
  v0.9, com Socket.io adicionado depois (rooms por partida/assento,
  reconexão com backoff, broadcast de `match:view_update`). Fila Online,
  Convite Direto e o próprio treino solo passam por ambos os caminhos
  dependendo do fluxo.
- **`server/deckCoverageGate.ts`**: gate de segurança server-only (usa
  `node:fs` pra ler `data/gcg-official-cards.json`, por isso nunca é
  importado por código de cliente). Antes de qualquer deck — preset ou
  montado pelo jogador — entrar numa partida, roda `validateDeckPayload`
  carta a carta: se o texto oficial tem "cláusula bespoke" (regra própria,
  não coberta por keyword automática) e a carta não tem `EffectSpec`
  registrado nem campo estruturado (`staticAbilities`/`combatTriggers`/
  `attackTargetRules`), o deck é rejeitado com a lista exata de códigos sem
  cobertura. Reaproveitado também pra sinalizar verde/vermelho os decks do
  próprio jogador na tela de escolha (`GET /api/simulator/my-decks`).

### `EffectSpec` — a DSL declarativa de efeitos

Cada habilidade de carta é um `EffectSpec`: `{ id, cardCode, trigger, actions,
targetScope?, targetFilter?, condition?, sourceText }`. `trigger` é o rótulo
oficial (`"Deploy"`, `"Attack"`, `"Burst"`, `"When Paired"`, `"Activate·Main"`
etc.); `actions` é uma lista de `PrimitiveCall` (`moveZone`, `damageUnit`,
`modifyStat`, `deployThisCard`, `draw`, ...) que o motor sabe resolver pra
`GameEvent`s. Novas mecânicas viram novas primitivas em `effectSpec.ts`, nunca
duplicando uma primitiva parecida — há um arquivo de governança
(`primitives-claims.json`) que registra o vocabulário oficial do motor e um
gate que falha se aparecer uma primitiva/filtro não-registrado.

O **dispatcher** (`dispatcher.ts`/`abilityDispatch.ts`) é quem decide, depois
de qualquer evento, quais `EffectSpec`s disparam em cascata (um 【Deploy】 que
provoca um 【Destroyed】 que provoca outro gatilho, etc.), com dois guards
anti-loop-infinito: `MAX_CASCADE_DEPTH` (profundidade de recursão) e
`MAX_QUEUE_BREADTH` (largura da fila FIFO numa única ação) — se estourar, em
teste lança `TriggerLoopException` com os últimos 20 eventos anexados; em
partida real, resolve em empate determinístico (`reason: "trigger_loop_guard"`)
em vez de travar o processo.

### Decks disponíveis (todas as modalidades)

Desde 2026-09-14, o seletor de deck (Fila Online, Convite Direto, Treino
Solo) mostra:
- **ST01, ST02, ST03, ST04** — os 4 starters oficiais.
- **4 decks de teste GD01** (Federation Vanguard, Zeon Legion, Newtype Corps,
  Sleeves Uprising) — montados só com cartas com cobertura real no motor.
- **Qualquer deck salvo do próprio jogador** no Hangar, com indicador
  verde/vermelho de cobertura (`useMySimulatorDecks`/`SimulatorDeckCoverageNotice`)
  — se o jogador insiste num deck vermelho, aparece a mensagem na tela com o
  motivo exato antes de tentar entrar em fila.
O servidor (`SIMULATOR_DECKS` em `server/index.ts`) não tem mais kill-switch
por env var — os presets GD01 estavam antes atrás de `ENABLE_GD01_ONLINE`
(canário de 72h sem exceção real, ver [§4.3](#43-debates-técnicos-multi-agente-gemini↔claude)),
removido depois que o canário passou.

---

## 4. Processos de desenvolvimento

### 4.1 Workflow de Git

Convenção de commit `<tipo>(<escopo>): <resumo>` (`feat`/`fix`/`refactor`/
`style`/`docs`/`chore`/`test`), branches `main` (produção, protegida — Render
e Vercel só observam essa branch) e `dev` (integração/teste). Regra prática:
cada commit deve responder "o que mudou" e "por que" numa linha, e nunca
misturar 5 assuntos num commit genérico tipo "update"/"ajustes". `git diff`
antes de comitar, push depois de um conjunto coeso de commits.

### 4.2 Specs, planos e skills (Spartan)

O projeto usa o **Spartan AI Toolkit** (comandos/agentes em `.claude/`) como
camada de workflow estruturado por cima do Claude Code — `/spartan:spec` →
`/spartan:plan` → `/spartan:build` pra features de tamanho médio/grande,
`/spartan:epic` pra lotes maiores. Tarefas pequenas (<30min, ≤3 arquivos) vão
direto sem passar por spec formal. Regras específicas do domínio (Kotlin não
se aplica aqui — o backend é Node/Express — mas os princípios de "sempre TDD",
"nunca senha genérica de commit", "push só depois de validar" valem).

### 4.3 Debates técnicos multi-agente (Gemini↔Claude)

Para decisões arquiteturais grandes (não pra bugs pequenos), o projeto usou
um padrão de **debate estruturado entre 2 modelos** (Gemini como Propositor,
Claude como Auditor, ou vice-versa) até atingir um score de consenso alto
(ex.: 94%), registrado em Markdown (`docs/debates/`) ou JSON
(`.debate/last-session.json`). Um modelo propõe uma arquitetura/plano
detalhado, o outro contesta pontos fracos com base no estado REAL do
repositório (nunca especulação), e o documento final é um plano sequenciado
com checklist acionável. Esse padrão foi usado 8 vezes entre 12 e 13/09/2026,
todas em torno da wave GD01 — decisões-chave, condensadas:

1. **Governança multi-wave** (12/09, 1º debate): tabela de dualidade
   causa-efeito entre primitivas (`emitsState`/`readsState`) resolvida em
   build-time por script determinístico (não LLM/embeddings) para o RAG de
   autoria; fatiamento de conteúdo por **faixa de ID de carta** (não por
   mecânica) como padrão pra toda wave futura.
2. **Divisão de trabalho e prompts-gatilho** (12/09, 2º debate): papéis
   Gemini (amplitude/ingestão) vs. Claude (profundidade/rigor mecânico) e um
   checklist repetível por wave (setup → ingestão → resolução mecânica → RAG
   + QA em paralelo → merge).
3. **Arquitetura da wave GD01 no motor** (12/09, 3º debate): novas
   primitivas sem alterar as existentes, pipeline de auras/layers,
   ordenação APNAP (jogador ativo primeiro) com fila FIFO, Golden Master
   como critério de "carta pronta".
4. **3 requisitos de resiliência** (13/09, 4º debate): `MAX_CASCADE_DEPTH=12`
   + `MAX_QUEUE_BREADTH=150` (em vez de 1 valor único) fecham o risco de loop
   infinito matematicamente; `TriggerLoopException` em teste, empate
   determinístico em produção; `primitives-claims.json` como gate obrigatório
   de CI.
5. **Levantamento completo do estado do projeto** (13/09, 5º debate, o mais
   longo — 874 linhas): auditoria em 3 partes (funcional / pendências /
   carta-a-carta), com plano de continuidade faseado (Fase 0 hardening → Fase
   1 canário online com kill-switch `ENABLE_GD01_ONLINE` → Fase 2 gaps de
   motor → Fase 3 próximas coleções → Fase 4 evolução de produto). Origem do
   kill-switch que foi removido em 14/09 (canário concluído sem incidente).
6. **Validação do commit `df7c851` + split de arquivo** (13/09, 6º debate):
   aprovação da divisão de `gd01.ts` (2647 linhas, 3.3x o teto de ~800
   linhas/arquivo) em `content/gd01/` por cor, ANTES de continuar autorando
   as cartas restantes (pra não re-fatiar um arquivo ainda maior depois).
7. **Verificação da Fase 0/1 + próximos passos** (13/09, 7º debate): aprovação
   do `gd01.manifest.json`/`AI_GUIDE.md`, alerta arquitetural sobre lifecycle
   de auras de Piloto (precisam cessar imediatamente se o Piloto for
   destruído/desparado — não só quando a Unit some), checklist final de
   pré-merge.
8. **Sessão `.debate/last-session.json`** (94% de consenso, formato JSON):
   validação final do commit `df7c851` com as 3 prioridades explícitas do
   usuário (A: correções pendentes, B: robustez sem "arquivo carregado", C:
   terminar as 130 cartas) — resultou no plano de 4 fases que de fato foi
   executado (Fase 1 cleanup+split → Fase 2/3 lotes de gaps de motor → Fase 4
   validação total + merge), fechado em `5f8b4b2`/`b22b4b3`.

### 4.4 Testes, cobertura e Golden Master

```bash
pnpm test                              # suíte Vitest completa
pnpm check:types                       # tsc -b, estrito
pnpm gundam:coverage --sets=GD01       # dashboard de cobertura de efeitos por coleção
pnpm gundam:coverage:gate              # mesma coisa, mas falha o processo se achar "faltando"
pnpm gundam:golden                     # confere o hash do estado final de cada par de decks
pnpm gundam:golden:update              # regrava os hashes — só depois de confirmar que a mudança é intencional
pnpm gundam:index                      # regenera specs-signatures.json (RAG de autoria por similaridade)
```

O **Golden Master** (`src/modules/simulator/engine/__golden__/`) roda uma
partida determinística (seed fixa) pra cada par de decks relevante e compara
o hash do `GameState` final contra um valor gravado. Ele existe justamente
pra pegar mudanças de comportamento não-intencionais no motor — quando muda
de propósito (como o fix do Burst em 14/09), o próprio erro instrui a rodar
`gundam:golden:update`.

O gate de cobertura (`catalog:coverage:gate`/`gundam:coverage:gate`) e o
`deckCoverageGate.ts` (server-only) são a mesma ideia em dois pontos
diferentes do pipeline: um audita o conteúdo em CI, o outro protege a
partida real em runtime — nenhuma carta "quase pronta" chega ao jogador.

---

## 5. Estado atual e pendências conhecidas

### 5.1 Cobertura de GD01 (130 cartas)

Situação em 2026-09-14 (`pnpm gundam:coverage --sets=GD01`): **95 implementada
+ 2 implementada\* + 28 vanilla + 0 deferida + 5 faltando**.

As **5 cartas ainda sem cobertura nenhuma** (nem `EffectSpec`, nem campo
estruturado, nem entrada em `deferred.ts`) — bloqueadas automaticamente pelo
gate se um jogador tentar usá-las num deck próprio:

| Código | Carta | Tipo |
|---|---|---|
| GD01-016 | Jegan | Unit |
| GD01-046 | Buster Gundam | Unit |
| GD01-070 | Gundam Aerial | Unit |
| GD01-090 | Duo Maxwell | Pilot |
| GD01-091 | Chang Wufei | Pilot |

### 5.2 Cláusulas deferidas (`src/modules/simulator/content/deferred.ts`)

Cada entrada é uma aproximação DELIBERADA e testada, não um bug esquecido —
6 cláusulas ativas hoje:

| Carta | Cláusula (resumo) | Motivo |
|---|---|---|
| ST02-015 | Reordenar topo do deck via 【Deploy】 encadeado por Burst | O caminho Burst→Deploy encadeado não passa pela camada de decisão; auto-decidir a ordem mid-combat seria pior que pular. |
| ST03-001 (Sinanju) | `<High-Maneuver>` condicional a 【During Pair】 | Modelado como keyword fixa — `hasKeyword` é consultado sem `state` em ~9 pontos do motor; Sinanju quase sempre ataca pareada. |
| ST03-001 (Sinanju) | Dano extra ao destruir shield em batalha, com escolha de alvo | Auto-mira a 1ª Unit inimiga legal — não existe sistema de escolha de alvo durante combate. |
| `*` (transversal) | Piloto pareado seguir a Unit destruída por dano/destroy de EFEITO (fora de combate) | `damageUnit`/`destroy` só emitem `DESTROY_CARD` da Unit; só `combat.ts` emite o "follow" do Piloto. Nenhuma carta ST01-04 produz o caso, mas GD/EB produzem. |
| GD01-001 (Gundam) | Aura contínua "todas as Units (White Base Team) ganham `<Repair 1>`" | Depende de um pipeline de Layers/Auras que ainda não existe. |
| GD01-066 (Justice Gundam) | Conceder "pode atacar no turno em que foi deployado" a um token escolhido | Fora da regra nativa de Link Unit; não existe primitiva pra exceção pontual desse tipo. |

### 5.3 Outras lacunas conhecidas (fora de GD01)

- **Matchmaking ranqueado**: aceito no protocolo desde o v1.0, sem fila
  própria implementada.
- **Arena Multiplayer (4P — 2x2/Battle Royale)**: rota `/simulador/multiplayer`
  existe só como mock visual bloqueado ("em fase de modelagem de rede") — sem
  motor real de 4 jogadores.
- **Pipeline de ML do bot**: dataset e treino existem, mas o modelo neural
  nunca foi validado/promovido pra produção — heurística determinística segue
  sendo o único bot em produção.
- **Coleções alem de GD01**: GD02-05, EB01, ST05-10 seguem inteiramente fora
  de escopo (decisão explícita registrada em vários dos debates do §4.3).
- **Ranking/temporadas competitivas** e **comunidade/social** (perfis
  públicos, decks favoritos) seguem no "radar" do CHANGELOG, sem trabalho
  iniciado.

---

## 6. Planos consolidados

Resumo do que 3 planos de implementação avulsos (removidos do git, ver §7)
propunham — e o que de fato aconteceu.

### 6.1 Modernização visual (Database de Cards e Coleções)

Propôs banners cinematográficos com parallax e fade inferior (Blueprint
Técnico Unicorn Gundam pra `/cards`, Hangar de Produção/Deploy pra `/sets`),
grid de alta densidade pro catálogo (4-6 colunas, carta maior, sem
custo/efeito/botão de abrir detalhe visíveis no grid) e importação das capas
reais de produto pra todas as coleções cadastradas via
`link-product-covers.mjs`. **Executado** — commits `861a1da` (modernização
visual) e `143cee0` (metadados de produto de todas as coleções) no git log
batem com o plano.

### 6.2 4 decks de teste GD01 + seletor do simulador

Plano original propunha 4 decks ("Wing Blockers", "OYW", "Unicorn Blockers",
"Newtype Ping") e substituir os botões de Starter por um `<Select>` agrupado.
**Executado com nomes diferentes** dos propostos — os 4 decks que de fato
foram pro código (`fixtures/gd01TestDecks.ts`) chamam-se **Federation
Vanguard, Zeon Legion, Newtype Corps e Sleeves Uprising**, cada um cobrindo um
par de cor adjacente do ciclo White→Blue→Green→Red→White. O seletor virou uma
lista curada compartilhada entre Sandbox/Treino/Multiplayer
(`simulatorDeckPresets.ts`), não um `<Select>` do shadcn como o plano sugeria
— optou-se por manter o padrão de grid de botões já existente, estendido.
O plano também previa uma "Fase 4" de desrepressão de cláusulas prioritárias
dos 4 decks (Wing Gundam Zero, Kshatriya, Duo Maxwell, Unicorn/Banshee) — hoje
todas essas já estão fora de `deferred.ts` **exceto** Duo Maxwell (GD01-090,
ver §5.1 — ainda "faltando", não apenas deferida).

### 6.3 Metagame, Torneios e Telemetria (VEDA)

Documento mais extenso dos 3 (165 linhas), propondo 3 fases: overhaul da
página de Torneios (abas táticas, busca com filtros, modal de detalhe com
VOD/gráficos), Power Rankings semanal na página de Estatísticas (#1-#10,
Meta Share%, Winrate%, ação rápida "Iniciar Build Básica"/"Explorar Núcleos"),
e Matriz de Confrontos (matchups, WR por turno de início, Dice WR). O
checklist do próprio documento está com todas as caixas `[ ]` desmarcadas,
mas o commit `afbd9c8` ("feat(torneios): central de eventos, power rankings e
matriz de confrontos") e os componentes já presentes no código
(`TournamentDetailDialog.tsx`, `PowerRankingsPanel.tsx`,
`MatchupMatrixPanel.tsx`) indicam que as 3 fases **foram implementadas** —
o checklist interno do plano simplesmente não foi atualizado depois do
trabalho.

---

## 7. Nota de manutenção

Em 2026-09-14, os seguintes arquivos-fonte de **processo/sessão** (não
produto) foram removidos do controle de versão (git) — via `.gitignore`, não
apagados do disco — porque documentavam decisões pontuais já tomadas e
condensadas aqui, não comportamento vivo do sistema:

- `docs/debates/*.md` (7 transcrições de debate multi-agente Gemini↔Claude)
- `.debate/last-session.json` (1 sessão de debate em formato JSON)
- `implementation_plan-9-11.md` (raiz — modernização visual de Cards/Coleções)
- `implementation_plan_GD01_deck_test.md` (raiz — 4 decks de teste + seletor)
- `PLANO_METAGAME_TORNEIOS_TELEMETRIA.md` (raiz — plano VEDA/Torneios)

Eles continuam existindo no ambiente local de quem os gerou, mas não são mais
parte do histórico do repositório compartilhado — o mesmo tratamento que já
existia pra `AI_GUIDE.md`, `PLANEJAMENTO.md`, `implementation_plan.md` e
outros artefatos de trabalho com IA (ver bloco correspondente do
`.gitignore`).

**Daqui pra frente, este manual (`docs/MANUAL_DESENVOLVIMENTO.md`) é a
referência que deve ser mantida atualizada no repositório** — a cada marco
relevante (nova coleção, mudança de arquitetura, decisão grande de produto),
soma-se uma entrada na linha do tempo (§2) e, se aplicável, atualiza-se §5
(pendências). Os docs numerados em `docs/00` a `docs/49` continuam existindo
como registro histórico detalhado sessão-a-sessão e não precisam ser
re-escritos — este manual é o ponto de entrada que resume e linka pra eles
quando fizer sentido, não uma substituição.
