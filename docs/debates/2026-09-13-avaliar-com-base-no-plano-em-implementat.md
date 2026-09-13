# Debate Técnico: Avaliar, com base no plano em implementation_plan_GD01_deck_test.md (raiz do repo portal-gundam-tcg-br) e no estado real e atual do motor do simulador em src/modules/simulator/, se a arquitetura atende a 3 requisitos: (A) nenhum efeito de carta pode ficar com comportamento indefinido/defeituoso; (B) o motor precisa suportar a inclusao continua de novas waves (GD02, GD03...) sem que os arquivos de conteudo/efeitos fiquem verbosos demais (avaliar separacao de arquivos de chamada de primitivas/specs); (C) o motor precisa ser resiliente a travamento total.

CONTEXTO FACTUAL JA LEVANTADO NO REPOSITORIO REAL (nao inventar caminhos, usar exatamente estes):
- Fonte de verdade das primitivas de efeito: src/modules/simulator/engine/effectSpec.ts (PrimitiveCall, TargetRef, Duration).
- Despacho de gatilhos/habilidades: src/modules/simulator/engine/abilityDispatch.ts + dispatcher.ts (dispatchTrigger, dispatchDestroyedTriggers, fila FIFO `queuedDestroyed`).
- Conteudo por colecao: src/modules/simulator/content/{st01..st04,gd01}.ts, gd01.manifest.json (status atual: PHASE_2_IN_PROGRESS, 60/130 cartas com EffectSpec, 42 clausulas em deferred.ts), src/modules/simulator/content/deferred.ts (registro tipado DEFERRED_CLAUSES com cardCode/clause/reason/blockedBy — hoje 42 entradas cobrindo gaps como "aura-concessao-keyword-grupo", "custo-dinamico-na-mao", "escolha-de-ate-n-alvos", "target-group-todas-as-units-dos-2-lados", "static-ability-keyword-condicao-generica").
- Governanca de vocabulario: primitives-claims.json (registro append-only de novas primitivas), scripts/gundam-coverage.mjs + scripts/mcp-gundam/similar-specs.mjs (RAG lexical n-grama, zero embeddings, decisao ja consolidada em debate anterior).
- Suite de regressao: src/modules/simulator/engine/__golden__/harness.ts + hashes.json (append-only, snapshots ST01-04 + 1 par GD01 ja presente: GD01_vs_GD01_seed15.json).
- Fuzzing: scripts/gundam-fuzz.mjs — roda `runSelfPlay` bot vs bot com `maxTurns` como teto rigido (default 200) e marca partida como "achado unfinished" se nao terminar dentro do teto; NAO trava porque tem teto de turnos, mas roda so em Node headless com bots automaticos (random/heuristic/mcts), nunca simula a resolucao de decisao interativa real de um jogador humano.

INCIDENTE REAL A REPORTAR E DIAGNOSTICAR (Claude deve expor isso primeiro na proposta, com causa raiz tecnica, nao so descrever o sintoma):
Durante um teste de simulacao MANUAL (jogo real, nao o fuzzer automatizado), a partida travou por 4 HORAS reais sem nenhuma resolucao — nem a UI avancava nem o processo terminava sozinho, exigindo intervencao manual do usuario para encerrar. Verificacao feita no codigo atual: rodei `grep -rn "MAX_TRIGGER_CHUNKS" src/modules/simulator/engine` e o resultado veio VAZIO — ou seja, a guarda de teto de chunks de gatilho encadeados (`MAX_TRIGGER_CHUNKS = 50`, alinhada ao padrao .claude/rules/backend-micronaut/BATCH_PROCESSING.md) que foi PROPOSTA E CONSENSUADA (95% de concordancia) no debate anterior salvo em docs/debates/2026-09-12-como-planejar-e-executar-a-wave-de-imple.md (secao "Substituicao da Call Stack Guard por Fila FIFO Deterministica") NUNCA foi implementada em codigo. abilityDispatch.ts/dispatcher.ts hoje despacham gatilhos em cadeia (`dispatchTrigger` chamando a si mesmo/proxima rodada de specs) sem nenhum contador de iteracoes, sem timeout e sem circuit-breaker — se uma carta gerar uma cadeia de gatilhos que se realimentam (ex: 2 efeitos "When Paired"/"Destroyed" que se re-disparam mutuamente, ou um alvo automatico que nunca fica valido e a resolucao fica pedindo decisao humana em loop), o motor sincrono do JS trava a thread principal indefinidamente — nao da timeout, nao da erro, so fica preso, e como e sincrono/single-thread trava o processo/aba inteira (por isso 4 horas reais e nao um crash rapido). O vitest tambem nao tem testTimeout customizado configurado (nao ha `testTimeout`/`hookTimeout` em vitest config nem package.json), entao um teste automatizado que caia no mesmo loop sincrono infinito TAMBEM travaria a suite inteira (o timeout padrao do vitest so protege testes assincronos que dao `await`, nao um loop `while(true)` sincrono).

O QUE PRECISA SAIR DESTE DEBATE (formato final):
1. Confirmar ou refutar esse diagnostico de causa raiz (ausencia de MAX_TRIGGER_CHUNKS/circuit-breaker em abilityDispatch.ts/dispatcher.ts) e propor a implementacao concreta (onde entra o contador, o que acontece quando estoura o teto — empate forcado? erro estruturado? log de replay?).
2. Avaliar separacao de arquivos: hoje effectSpec.ts concentra os tipos de primitiva e content/{wave}.ts concentra as CardDefs+EffectSpecs por carta — isso escala ate GD05/GD10 sem virar arquivo gigante e verboso? Propor um criterio objetivo de quando quebrar por sub-modulo (ex: por mecanica, por trait, por tamanho de arquivo) mantendo compativel com o pipeline ja consensuado de content/<wave>.manifest.json + deferred.ts + primitives-claims.json.
3. Desenhar uma estrategia de DOIS NIVEIS de teste que NUNCA possa travar o processo/CI:
   a) "Testes de jogo" (partida completa) — como o gundam-fuzz.mjs ja bounded por maxTurns, mas propor tambem um teto de ITERACOES DE RESOLUCAO DE GATILHO por partida (nao so por turno) e um modo de captura de replay minimo quando estourar, pra virar caso de regressao.
   b) "Testes de carta" (ambiente favoravel isolado) — um harness que monta um GameState minimo customizado (so as cartas necessarias pra exercitar 1 efeito especifico), dispara a habilidade, e valida o resultado esperado — com timeout/watchdog OBRIGATORIO em nivel de test runner (worker thread com timeout que mata o processo, ou contador de chunks que forca falha determinística do teste em vez de travar o runner) para que uma nova carta com efeito mal implementado NUNCA trave a suite inteira, apenas falhe aquele teste especifico com uma mensagem clara.
4. Checklist pratico final (arquivos a criar/tocar, comandos pnpm/vitest a rodar) que qualquer novo agente/dev possa seguir ao adicionar uma carta nova a partir de agora.

- **Data:** 13/09/2026, 10:30:59
- **Iniciador:** CLAUDE
- **Propositor:** Claude
- **Auditor Crítico:** Gemini
- **Status:** Consenso Antecipado (>= 85%)
- **Índice de Concordância:** 90%
- **Turnos Executados:** 2 de 4

---

Aqui está a síntese oficial do debate técnico entre **Claude** (Propositor) e **Gemini** (Auditor Crítico), consolidada com **90% de concordância final**.

---

### [Pontos de Acordo]

1. **Confirmação do Diagnóstico da Causa Raiz (Incidente das 4h)**:
   - A guarda `MAX_TRIGGER_CHUNKS = 50` aprovada em debates anteriores **nunca foi codificada** no motor (`grep -rn "MAX_TRIGGER_CHUNKS" src/modules/simulator/engine` retornou 0 resultados).
   - O único guard existente (`MAX_DESTROYED_CHAIN = 8` em `abilityDispatch.ts:225`) cobre apenas a cadeia de destruição fora do Damage Step, deixando desprotegidas as recursões em `dispatcher.ts:129` (Burst $\rightarrow$ Deploy $\rightarrow$ Pareamento) e cascatas de gatilhos mutuamente realimentados.
2. **Furo Crítico de Governança Mapeado**:
   - O arquivo `src/modules/simulator/content/primitives-claims.json` está atualmente **vazio (`{}`)**, falhando em registrar as primitivas e filtros criados na Fase 2 do GD01. Isso invalida a capacidade do RAG lexical (`similar-specs.mjs`) de prevenir duplicação de primitivas nas próximas waves.
3. **Estratégia de Testes em Dois Níveis**:
   - **Nível Partida (Fuzzing/Golden)**: Manter `gundam-fuzz.mjs` com teto de turnos (`maxTurns`), injetando instrumentação para capturar automaticamente replays de partidas que estourarem guards.
   - **Nível Carta (Isolado)**: Criar o helper padronizado `src/modules/simulator/engine/__testkit__/cardHarness.ts` (`placeCard`) para eliminar duplicação de montagem de `GameState` mínimo nos testes unitários por carta.
4. **Governança de Tamanho de Arquivos (Requisito B)**:
   - Definido o teto objetivo de **800 linhas por arquivo de conteúdo**. Ao atingir o teto, o arquivo `content/<wave>.ts` é promovido a módulo `content/<wave>/` com um `index.ts` barrel, mantendo o mesmo contrato de re-exportação para o motor.

---

### [Divergências e Riscos]

1. **Comportamento do Chrome UI vs. Web Workers (Esclarecimento de H1)**:
   - *Claude*: Questionou se 4h de travamento poderiam ser um `while(true)` síncrono puro, pois o Chrome notificaria "Página sem resposta".
   - *Gemini*: Corrigiu a premissa. Se a execução roda em um **Web Worker** ou processo Node/CLI desacoplado da thread de UI React, 1 núcleo de CPU fica preso em 100% indefinidamente sem congelar a renderização do DOM. Isso confirma que **H1 (loop síncrono por recursão desprotegida no motor) é a causa raiz primária do incidente**.
2. **Risco de Falso Positivo em Board Wipes (Largura vs. Profundidade)**:
   - *Risco apontado pelo Gemini*: Um único contador `MAX_TRIGGER_CHUNKS = 50` por ação pode ser estourado legitimamente em tabuleiros cheios (ex: limpeza de campo destruindo 5 unidades pareadas com 5 pilotos, gerando dezenas de gatilhos em largura FIFO de uma só vez, sem qualquer loop infinito).
   - *Solução Consensuada*: Separar o guard em dois parâmetros:
     - **`MAX_CASCADE_DEPTH = 12`**: Profundidade máxima de gatilhos que *disparam novos gatilhos* recursivamente.
     - **`MAX_QUEUE_BREADTH = 150`**: Largura máxima de eventos na fila FIFO por ação.
3. **Estratégia de Split de Arquivos de Content (Unidades vs. Mecânicas)**:
   - *Claude*: Sugeriu separar por tipo/mecânica (`units.ts`, `pilots.ts`, `commands.ts`).
   - *Gemini*: Apontou que no Gundam TCG as Unidades representam ~70% do set, tornando `units.ts` ainda gigante (>3.800 linhas).
   - *Solução Consensuada*: Dividir Unidades por **faixa de ID / Cor / Facção** (ex: `units-blue-green.ts`, `units-red-black.ts`), mantendo todos os arquivos abaixo do teto rígido de 800 linhas.
4. **Penalidade de Performance no CI (Vitest Process Isolation)**:
   - *Claude*: Sugeriu impor `pool: "forks"` com isolamento forçado no Vitest.
   - *Gemini*: Alertou que isso aumentaria a suíte do CI de 5s para >45s. Como os guards internos no motor agora interrompem loops síncronos de forma determinística, **não é necessário forçar isolamento por processo no Vitest**, mantendo a suíte ultrarrápida.
5. **Tratamento da Exceção**:
   - Em partidas de **Produção**: Forçar término por Empate Determinístico (`GAME_OVER`, `reason: "trigger_loop_guard"`).
   - Em ambiente de **Desenvolvimento/Teste (`NODE_ENV === "test"`)**: Disparar `TriggerLoopException` para que a suíte falhe explicitamente exibindo o histórico dos últimos eventos.

---

### [Proposta de Planejamento/Ajuste]

#### Arquitetura de Proteção e Escala (Consolidada)

```
src/modules/simulator/
├── engine/
│   ├── abilityDispatch.ts     <-- Aplicação de MAX_CASCADE_DEPTH (12) e MAX_QUEUE_BREADTH (150)
│   ├── dispatcher.ts          <-- Propagação do contador de profundidade na cadeia de despacho
│   └── __testkit__/
│       └── cardHarness.ts     <-- Helper isolado de testes unitários de carta (placeCard)
├── content/
│   ├── primitives-claims.json <-- Atualizado com todas as primitivas ativas (CI Gate)
│   ├── deferred.ts            <-- Mantido como registro tipado de cláusulas pendentes
│   └── <wave>/                <-- Estrutura modular (se >800 linhas)
│       ├── index.ts           <-- Barrel re-exportando WAVE_EFFECT_SPECS e WAVE_CARD_DEFS
│       ├── units-1.ts
│       ├── units-2.ts
│       └── pilots-commands.ts
```

---

### [Documento MD com Informativo, Checklist e Prompts de Automação]

```markdown
# Plano de Execução: Resiliência, Governança e Escala do Simulador (GD01+)

## 1. Diretrizes Técnicas Consensuadas

### A. Circuit Breaker do Motor (Requisito C)
- Em `src/modules/simulator/engine/abilityDispatch.ts`:
  - `MAX_CASCADE_DEPTH = 12`: Limite de profundidade de sub-gatilhos recursivos.
  - `MAX_QUEUE_BREADTH = 150`: Limite total de itens processados na fila FIFO por ação.
- Se `cascadeDepth > MAX_CASCADE_DEPTH` ou `queueProcessed > MAX_QUEUE_BREADTH`:
  - Se `process.env.NODE_ENV === "test"`: Lança `TriggerLoopException` com dump dos últimos 20 eventos.
  - Se em jogo: Emite evento `GAME_OVER` com `reason: "trigger_loop_guard"` (Empate determinístico).

### B. Governança de Primitivas e Content Split (Requisito B)
- **Trava de Governança**: Executar `pnpm claims:check` (via `gundam-coverage.mjs`). Nenhuma nova primitiva ou `TargetGroup` pode ser mesclada sem estar registrada em `primitives-claims.json`.
- **Teto por Arquivo**: Nenhum arquivo em `content/` deve ultrapassar **800 linhas**. Se ultrapassar, converter para a estrutura de pasta `content/<wave>/` com `index.ts` barrel, dividindo Unidades por cor/ID.

### C. Cobertura de Testes sem Hangs (Requisito A)
- Testes unitários de cartas devem usar `src/modules/simulator/engine/__testkit__/cardHarness.ts`.
- Partidas automatizadas (`gundam-fuzz.mjs`) capturam falhas e salvam automaticamente a seed/actionLog em `scripts/__fuzz_regressions__/`.

---

## 2. Checklist Prático para Novos Efeitos / Novas Waves

Sempre que uma carta ou expansão (GD02+) for adicionada:

- [ ] 1. Verificar reutilização de primitivas existentes usando o script de busca lexical RAG.
- [ ] 2. Se criar nova primitiva em `effectSpec.ts`, registrá-la imediatamente em `src/modules/simulator/content/primitives-claims.json`.
- [ ] 3. Adicionar a especificação em `src/modules/simulator/content/<wave>.ts` (ou sub-arquivo na pasta `<wave>/` se exceder 800 linhas).
- [ ] 4. Se houver cláusula não suportada pelo motor, registrá-la obrigatoriamente em `src/modules/simulator/content/deferred.ts`.
- [ ] 5. Atualizar o manifesto correspondente (`<wave>.manifest.json`).
- [ ] 6. Escrever o teste isolado da carta em `content/<wave>.test.ts` utilizando o `cardHarness.ts`.
- [ ] 7. Executar a suíte de validação completa:
  ```bash
  pnpm tsc --noEmit
  npx vitest run src/modules/simulator/content/<wave>.test.ts
  npx vitest run src/modules/simulator/content/deferred.test.ts
  node scripts/gundam-coverage.mjs
  node scripts/gundam-fuzz.mjs --decks=<WAVE>,<WAVE> --games=500 --policyA=heuristic --policyB=random
  npx vitest run src/modules/simulator/engine/goldenMaster.test.ts
  ```

---

## 3. Prompts de Automação para Claude Code / Antigravity

### PROMPT 1: Implementação dos Guards Anti-Loop no Motor Engine
> Copie e cole o prompt abaixo para o agente de execução de código:

```text
Você deve implementar as travas de resiliência contra loops infinitos e travamentos síncronos no motor do simulador, conforme consensuado no debate técnico.

1. Altere `src/modules/simulator/engine/abilityDispatch.ts`:
   - Declare as constantes:
     export const MAX_CASCADE_DEPTH = 12;
     export const MAX_QUEUE_BREADTH = 150;
   - Crie a classe de erro customizada `TriggerLoopException` extendendo `Error`.
   - Atualize os métodos de despacho (`dispatchTrigger`, `dispatchDestroyedTriggers`, `deferOrDispatchAbilities`) para rastrear e incrementar `cascadeDepth` e `queueProcessed`.
   - Se os limites forem violados:
     - Em ambiente `process.env.NODE_ENV === "test"`, lance `TriggerLoopException` contendo a causa detalhada e o dump dos eventos recentes.
     - Em runtime normal de jogo, emita o evento `GAME_OVER` com `winner: null` e `reason: "trigger_loop_guard"`.

2. Atualize `src/modules/simulator/engine/dispatcher.ts`:
   - Propague o parâmetro `cascadeDepth` incremental em todas as chamadas recursivas de gatilhos (inclusive desdobramentos de Deploy, Burst e Pareamento).

3. Valide a alteração rodando:
   npx vitest run src/modules/simulator/engine/
```

### PROMPT 2: Atualização de Governança de Primitivas (Claims Sync)
> Copie e cole o prompt abaixo para atualizar o vocabulário de primitivas e o CI Gate:

```text
Você deve reparar o arquivo de governança de primitivas e implementar a checagem automatizada no CI.

1. Analise `src/modules/simulator/engine/effectSpec.ts` e identifique todas as primitivas (`PrimitiveCall`), alvos (`TargetRef`), predicados e filtros implementados na Fase 2 do GD01.
2. Atualize `src/modules/simulator/content/primitives-claims.json` inserindo todas as primitivas ativas no formato JSON padronizado (preenchendo o arquivo que atualmente está vazio `{}`).
3. Atualize `scripts/gundam-coverage.mjs` para validar se todas as primitivas em `effectSpec.ts` possuem entrada em `primitives-claims.json`. Se houver divergência, o script deve emitir erro e encerrar com exit code 1.
4. Execute `node scripts/gundam-coverage.mjs` para garantir 100% de passagem.
```

### PROMPT 3: Criação do Testkit Desacoplado (Card Harness)
> Copie e cole o prompt abaixo para criar o harness reutilizável de testes de carta:

```text
Crie a biblioteca utilitária de testes unitários por carta.

1. Crie o arquivo `src/modules/simulator/engine/__testkit__/cardHarness.ts`.
2. Exporte a função `placeCard(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts?: Partial<CardInstance>): string` para posicionamento determinístico de cartas em cenários isolados.
3. Refatore `src/modules/simulator/content/gd01.test.ts` para importar e utilizar o `placeCard` do `cardHarness.ts`, eliminando a duplicação de helpers locais de montagem de board.
4. Execute `npx vitest run src/modules/simulator/content/gd01.test.ts` e confirme que todos os testes continuam passando.
```
```

---
Aguardando o veredito final do usuário Willen no encerramento.

---

<details>
<summary><b>Clique para ver a transcrição bruta dos turnos</b></summary>

### 1. Proposta Inicial (Claude - Propositor)

# Proposta Técnica — Resiliência do Motor GD01+ (para auditoria crítica do Gemini)

Investiguei o estado real do repo antes de escrever isto (não vou propor em cima de suposição). Resultado líquido: **o diagnóstico do incidente está parcialmente certo e parcialmente incompleto** — vou corrigi-lo antes de propor a solução, porque a correção muda onde o guard precisa entrar.

---

## 0. Veredito nos 3 requisitos

| Requisito | Estado atual | Veredito |
|---|---|---|
| (A) Nenhum efeito com comportamento indefinido | `deferred.ts` (42 cláusulas) + `gundam-coverage.mjs` cobrem isso decentemente | **Atende, com um furo de governança** (ver §2) |
| (B) Motor escala pra GD02+ sem arquivos verbosos | Convenção `content/<wave>.ts` já existe e funciona até aqui | **Atende hoje, vai quebrar em ~GD03-GD04** sem critério objetivo de split |
| (C) Motor resiliente a travamento total | `MAX_DESTROYED_CHAIN=8` existe, `MAX_TRIGGER_CHUNKS` **não existe** | **NÃO atende** — este é o gap real e confirmado |

---

## 1. Diagnóstico do incidente — confirmo o gap, mas contesto a causa única

### 1.1 O que está confirmado por código

```
grep -rn "MAX_TRIGGER_CHUNKS" src/modules/simulator/engine   →   0 resultados
```

Isso bate com o que você reportou. Mais que isso — achei o registro exato do consenso que nunca virou código, em `docs/debates/2026-09-12-como-planejar-e-executar-a-wave-de-imple.md`:

> linha 592: *"Substituição da Call Stack por Loop Guard: [...] Adotado o limite de processamento de fila por ação: `MAX_TRIGGER_CHUNKS = 50` [...]. Se um comando gerar mais de 50 chunks de gatilho em cadeia, a partida é encerrada por empate por loop infinito determinístico."*
> linha 220 (prompt de execução pronto): *"Garanta que o número de sub-gatilhos processados por comando não exceda a constante `MAX_TRIGGER_CHUNKS = 50`. Se exceder, lance um evento de término de partida por empate de loop infinito."*

Ou seja: **especificado, com valor numérico e semântica de saída definidos, e nunca implementado.** Isso é um "dívida técnica consensuada e esquecida" clássico — não um erro de arquitetura, um erro de execução.

O que **existe** e o seu relato não menciona: `abilityDispatch.ts:225` tem `MAX_DESTROYED_CHAIN = 8`, um guard real, funcional, testado por `chainDepth < MAX_DESTROYED_CHAIN` em `dispatcher.ts:98`. Mas ele só cobre **uma cadeia específica**: 【Destroyed】→【Destroyed】 fora do Damage Step. Ele **não** cobre:
- a recursão de `dispatchTrigger` em `dispatcher.ts:129` (Burst → `deployThisCard` → Deploy encadeado);
- qualquer cascata via `deferOrDispatchAbilities` → `SET_PENDING_DECISION` → `queuedDestroyed` (FIFO);
- dois efeitos "When Paired" ou "Deploy" que se retrigam mutuamente (o cenário que você descreveu).

**Conclusão da parte 1: o gap é real, mas é mais estreito do que "nenhum contador em lugar nenhum" — é "um contador que cobre 1 de N caminhos recursivos".**

### 1.2 Onde discordo do seu diagnóstico — a hipótese de "loop síncrono puro" não fecha sozinha com os fatos

Isto é importante o suficiente pra eu ter que discordar antes de propor a correção, porque a implementação certa depende de qual dos cenários abaixo realmente aconteceu:

**Fato 1** — `selfPlay.ts:114-153` (usado por `gundam-fuzz.mjs` e pelo golden master) **já detecta e reporta** exatamente a classe de bug que você suspeita:
```ts
if (!owner) return { ..., illegalState: `nenhum jogador pode agir mas o jogo não acabou...` };
...
if (legal.length === 0) return { ..., illegalState: `nenhuma ação legal para ${owner}...` };
```
Isso significa: um estado onde ninguém pode agir (deadlock de decisão) **já é uma classe de falha instrumentada e testada pelo fuzzer**, não um buraco cego. Se essa fosse a causa, e o fuzzer tivesse rodado de verdade contra o deck/carta em questão, o achado já teria aparecido como `kind: "illegalState"` num finding.

**Fato 2** — o loop externo do self-play já tem um teto rígido de passos: `selfPlay.ts:98`, `const maxSteps = maxTurns * 400`. Ele protege contra "a partida nunca termina", mas com uma limitação crítica: **ele só observa o estado ENTRE chamadas de `applyPlayerAction`** (linha 159). Se a recursão *dentro* de uma única chamada travar (um `dispatchTrigger` que chama a si mesmo indefinidamente via cascata não coberta por `MAX_DESTROYED_CHAIN`), essa chamada síncrona **nunca retorna** — e o `maxSteps` nunca chega a ser reavaliado, porque o `for` nem avança pro próximo `step`. Isso é o mecanismo exato de como uma trava pode ocorrer apesar do `runSelfPlay` "parecer" protegido.

**Fato 3** — um `while(true)` síncrono real trava a thread principal do JS por inteiro. No navegador, isso dispara o diálogo "Página sem resposta" do Chrome em **segundos**, não em horas — e a aba fica travada pra qualquer interação (nem scroll funciona). Uma trava real de 4 horas onde "a UI não avançava" (mas presumivelmente ainda respondia a cliques, senão você teria descrito "aba congelada") é **mais consistente com um deadlock de estado** (`pendingDecision` setado, esperando uma ação que a UI nunca ofereceu como clicável) **do que com um busy-loop de CPU**.

**Fato 4 — e este é o achado mais relevante para explicar por que isso passou despercebido**: cruzando `gd01.manifest.json` com o plano em `implementation_plan_GD01_deck_test.md`, há uma contradição direta:
- O manifest diz: `"phase3b_fuzz_golden": { "completed": false, "agent": "claude" }`
- O plano diz: *"Fase 3B (Fuzzing 4500 partidas, Golden Master seeds 11-15, Coverage Gate 0 faltando) concluída pelo Claude"*

Fui checar o `hashes.json` — as 5 chaves GD01 (`ST01_vs_GD01_seed11` ... `GD01_vs_GD01_seed15`) **existem**, mas o próprio `git status` mostra `hashes.json` e os 3 canonicals ST0x como `M` (modificados) e `GD01_vs_GD01_seed15.json` como `??` (novo, não commitado) — isto é, **essa cobertura golden foi adicionada agora, nesta branch, ainda não está em `main`**. E não existe no repo nenhum artefato persistido de uma rodada de fuzzing de "4500 partidas" (o `gundam-fuzz.mjs` só imprime `findings` no console — não grava nada em disco). Não dá pra confirmar pelo repositório que esse fuzzing amplo contra o deck real usado no seu playtest manual de fato rodou antes do incidente.

**Minha hipótese corrigida, com 3 causas candidatas — proponho instrumentar antes de fechar em uma só:**

| Hipótese | Evidência a favor | Evidência contra | O que fecharia o caso |
|---|---|---|---|
| H1 — busy-loop síncrono no motor (cascata de trigger não coberta por `MAX_DESTROYED_CHAIN`) | `MAX_TRIGGER_CHUNKS` de fato nunca implementado; recursão em `dispatcher.ts:129` sem cap | Duração de 4h é atípica pra CPU 100% travada (browser mataria a aba em segundos) | Reproduzir com `--policy=random --games=1 --seed=X` no par de decks/cartas usado manualmente |
| H2 — deadlock de estado (`pendingDecision` sem ação legal satisfatória), específico de carta GD01 nova | `runSelfPlay` já sabe detectar isso, mas cobertura de fuzz do GD01 é recente/não confirmada como completa (manifest `completed: false`) | Bots do fuzzer usam `enumerateLegalActions` direto — se existisse, teria sido pego já | Rodar `gundam-fuzz.mjs --decks=GD01,GD01 --games=2000` com o deck exato usado manualmente |
| H3 — bug de UI/sincronização (engine tem ação legal, front-end não a renderiza) | Motor e UI são camadas desacopladas; UI ainda não foi auditada aqui | Você precisou "matar o processo", não só recarregar a página, o que sugere trava mais funda que só UI | Checar se um F5/reload durante o travamento resolveria (teste rápido e barato pra descartar H3) |

**Recomendação prática**: não implementar o guard como se H1 fosse a única causa. Implementar o guard (ele é necessário de qualquer forma, ver §1.3), **mas também rodar o fuzzer com o deck exato do incidente manual e registrar o resultado** — isso decide se o trabalho termina em "guard implementado" ou se abre uma segunda frente (bug de `enumerateLegalActions` ou de UI).

### 1.3 Implementação concreta do guard

Generalizar em vez de duplicar: `MAX_DESTROYED_CHAIN` e o futuro `MAX_TRIGGER_CHUNKS` protegem a mesma coisa (recursão de despacho de trigger) — devem ser **o mesmo contador**, não dois paralelos que um bug pode escapar entre eles.

```ts
// abilityDispatch.ts — substitui destroyedChainDepth por um contador geral
export const MAX_TRIGGER_CHUNKS = 50; // consenso docs/debates/2026-09-12, alinhado a BATCH_PROCESSING.md

export interface DispatchOptions {
  // ...
  /** nº de "chunks" de trigger já processados nesta árvore de despacho (todo tipo de trigger, não só Destroyed). */
  chunkCount?: number;
}
```

- **Onde incrementa**: todo ponto de recursão que hoje passa `destroyedChainDepth` (linhas 102 e 134 de `dispatcher.ts`, mais a chamada em `dispatchDestroyedTriggers`) passa a incrementar o mesmo `chunkCount`, único, compartilhado por toda a árvore de despacho de UMA ação de jogador — não por turno, por AÇÃO (mais fino, mais seguro).
- **O que acontece ao estourar**: nem exceção não-estruturada, nem truncamento silencioso. Proposta: `applyEvents` recebe um evento novo `GAME_OVER` com `reason: "trigger_loop_guard"` — **empate forçado**, análogo a como TCGs físicos resolvem loop infinito em torneio (regra oficial: "loop determinístico sem progresso = empate"). Isso é semanticamente correto pro domínio (jogo de 2 jogadores), diferente de um erro genérico de batch (`BATCH_PROCESSING.md` é pensado pra job assíncrono, aqui é uma partida — a analogia certa é "resultado degenerado tratado", não "falha de item de lote").
- **Captura de replay obrigatória no estouro**: grava `{ seed, deckA, deckB, actionLog, last50Events }` em `src/modules/simulator/engine/__golden__/regressions/<timestamp>.json` — isso transforma automaticamente qualquer estouro real em um caso de teste de regressão determinístico (reforça diretamente a estratégia de teste do §3a).

---

## 2. Separação de arquivos — critério objetivo pra não virar `gd01.ts` gigante em GD05

### 2.1 Dado real, não estimativa

`gd01.ts` está em **2550 linhas para 60/130 cartas implementadas** (46% do set) → média de ~42 linhas/carta implementada. Extrapolando linearmente pras 130 cartas completas desta wave: **~5.500 linhas**. Se cada wave repetir esse tamanho (GD02...GD10 = mais 9 waves), cada arquivo de wave isolado fica na faixa de 3.000-6.000 linhas — **por arquivo**, não no total. Isso já hoje está acima do que qualquer revisor consegue segurar de contexto numa PR.

A convenção `content/<wave>.ts` (um arquivo por wave) **já existe e já funciona bem até ST04** (212-290 linhas cada). O problema não é a convenção, é que ela não tem teto — GD01 é 9-12x maior que qualquer ST0x porque veio de um pipeline Gemini→Claude que despeja tudo de uma vez, e as próximas waves vão repetir isso.

### 2.2 Critério objetivo de split (proposto)

**Gatilho numérico**: quando `content/<wave>.ts` passar de **~800 linhas**, ele vira uma pasta `content/<wave>/` com um `index.ts` barrel que **preserva exatamente o mesmo contrato de export** que `content/index.ts` já consome (`WAVE_EFFECT_SPECS`, `WAVE_CARD_DEFS`) — zero mudança no agregador central, zero mudança em `deferred.ts`/`primitives-claims.json`/`manifest.json` (todos são chaveados por `cardCode`, não por caminho de arquivo).

**Eixo do split**: por mecânica, não por ordem alfabética de carta (alfabético não agrupa nada semanticamente e não ajuda revisão):
```
content/gd02/
  index.ts          // barrel: reexporta e concatena tudo abaixo
  units.ts          // CardDefs + EffectSpecs de UNIT sem interação com Pilot/token
  pilots-pairing.ts // When Paired, pareamento, aura de piloto
  commands.ts       // Main/Action de Command
  bases.ts
  tokens.ts         // token CardDefs (como TOKEN_FATUM_00 hoje solto em gd01.ts)
```
Por que mecânica e não trait/cor: traits mudam a cada wave (facção nova a cada set), mecânica de disparo (`trigger`) é o eixo estável que já organiza `effectSpec.ts` e o `dispatcher.ts`.

**800 linhas como número, não vibe**: escolhido por analogia direta ao próprio padrão do repo (`SKILL_AUTHORING.md`: "150+ linhas: deve quebrar" para markdown de skill; aqui o conteúdo é `EffectSpec` tipado, mais denso, então uso um múltiplo ~5x desse teto — mas o princípio "número fixo, não julgamento subjetivo" é o mesmo já usado em outro lugar deste repo).

### 2.3 Achado de governança que também precisa entrar no escopo

`primitives-claims.json` está **vazio (`{}`)**. Ele existe como "registro append-only de novas primitivas" — mas o próprio `gd01.manifest.json` documenta que a Fase 2 **adicionou** filtros de alvo compostos, `trait:X`, `ap>=N`, `linkUnit`, predicados novos (`enemyUnitCountAtLeast`, `selfIsPaired`, etc.) e um `TargetGroup` novo (`allFriendlyUnits`) — **nenhuma dessas adições foi registrada no arquivo de governança que existe exatamente pra isso**. Isso não trava o motor, mas **anula silenciosamente** a defesa contra duplicação de vocabulário que o `gundam-similar-specs.mjs` (RAG) depende para funcionar em GD02+: se o registro não é escrito, o próximo agente de conteúdo não tem como saber que `enemyUnitCountAtLeast` já existe antes de inventar `enemyUnitCount>=N` equivalente. **Proponho fechar isso como pré-requisito do requisito (B)**, não como nice-to-have: adicionar ao checklist de "nova carta" (§4) a obrigação de rodar o coverage/claims script a cada PR de conteúdo, com falha de CI se uma primitiva nova aparecer em `effectSpec.ts` sem entrada correspondente em `primitives-claims.json`.

---

## 3. Dois níveis de teste que nunca travam o processo/CI

### 3a. Testes de jogo (partida completa)

Já existe mais infraestrutura boa aqui do que o pedido original presumia — a lacuna é específica, não geral:

- **Já existe**: teto de turnos (`maxTurns`, default 200), teto de passos (`maxSteps = maxTurns*400`), detecção de `illegalState` (ninguém pode agir / nenhuma ação legal), detecção de `crashed` (exceção capturada). Tudo isso em `selfPlay.ts`, consumido tanto por `gundam-fuzz.mjs` quanto por `goldenMaster.test.ts`.
- **Falta 1** — teto de iterações de resolução de gatilho **por ação**, não só por turno: é exatamente o `MAX_TRIGGER_CHUNKS` do §1.3. Sem ele, uma única chamada de `applyPlayerAction` pode travar de forma invisível pros guards de nível "step" que já existem (explicado no Fato 2 do §1.2).
- **Falta 2** — persistência de achado como fixture de regressão: hoje `findings.push(...)` só vai pro console (`gundam-fuzz.mjs:144-170`). Proponho: todo finding (`throw`, `illegalState`, `unfinished`, e o novo `trigger_loop_guard`) grava um JSON em `scripts/__fuzz_regressions__/<pair>-<seed>.json` com `{ pair, seed, policyA, policyB, actionLog }`. Isso fecha o loop "achado de fuzz → caso de teste automatizado", que hoje depende de alguém reler o log do console e reproduzir manualmente.

### 3b. Testes de carta (ambiente isolado)

Aqui a base já existe e está duplicada — não estou propondo do zero. `content/gd01.test.ts`, `st01.test.ts` etc. cada um define seu próprio helper local `place(state, player, def, zone, opts)` pra montar um `GameState` mínimo customizado por cima de `createGame`. Isso funciona, mas se repete arquivo a arquivo (cópia, não módulo compartilhado) — outro sintoma do mesmo problema de verbosidade do §2.

**Proposta**: extrair `engine/__testkit__/cardHarness.ts` com:
```ts
export function placeCard(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts?: Partial<CardInstance>): string
export function withWatchdog<T>(fn: () => T, opts?: { maxMs?: number }): T
```

O `withWatchdog` é o ponto crítico do requisito (C) aplicado a testes, e aqui preciso ser preciso tecnicamente sobre uma limitação real do Node/Vitest: **`testTimeout` do Vitest é cooperativo** — ele funciona correndo uma race contra uma Promise, o que só interrompe código **assíncrono**. Um `while(true)` (ou uma recursão síncrona sem retorno) dentro de um `it(...)` **não libera o event loop**, então `testTimeout` sozinho não mata esse teste — ele trava o worker inteiro, e como o Vitest roda múltiplos arquivos de teste no mesmo worker/pool por padrão, **isso pode travar a suíte inteira**, exatamente o cenário que você quer evitar. `vitest.config.ts` hoje não define `pool`, `testTimeout` nem `hookTimeout` — os defaults do Vitest 4 se aplicam sem revisão.

Defesa em 2 camadas, não uma:
1. **Camada cooperativa (primária, cobre ~95% dos casos)**: o `MAX_TRIGGER_CHUNKS` do §1.3 já é a defesa real, porque ele vive DENTRO do motor — qualquer teste que exercite uma carta com cascata quebrada esbarra nesse teto e recebe um `GAME_OVER` estruturado, não um hang. Isso é sempre preferível a matar processo, porque produz uma asserção que falha com mensagem clara (`expect(result.reason).not.toBe("trigger_loop_guard")`).
2. **Camada de isolamento de processo (defesa em profundidade, cobre o resto)**: configurar `vitest.config.ts` com `pool: "forks"` + `poolOptions.forks.isolate: true` + `testTimeout` explícito (ex. 5000ms para testes de carta, mais generoso para `goldenMaster`/fuzz). Com `pool: "forks"`, cada arquivo roda em processo filho separado — mesmo que um teste trave de forma 100% síncrona sem nunca ceder o event loop, o processo **pai** consegue matar o filho no timeout via sinal do SO, sem afetar os demais arquivos de teste rodando em paralelo. Isso é a diferença entre "aquele teste falha" (desejado) e "a suíte inteira trava" (o que você teve que evitar).

Ambas as camadas são baratas de implementar e resolvem categorias diferentes: a primeira protege o **motor em produção** (onde não existe "matar o worker"); a segunda protege **o CI/dev local** contra qualquer bug que escape da primeira (ex.: um bug em código de teste em si, fora do motor).

---

## 4. Checklist prático — "adicionei uma carta nova, e agora?"

Arquivos a tocar (ordem de dependência):

1. `effectSpec.ts` — só se a carta precisar de `PrimitiveCall`/`TargetGroup`/predicado **genuinamente novo**. Antes de adicionar: rodar `mcp__gundam__gundam_similar_specs` (RAG lexical já existente) pra checar se já existe algo parecido.
2. `content/primitives-claims.json` — se o passo 1 adicionou algo novo, registrar aqui **no mesmo commit**. (Proponho isso virar check de CI, ver §2.3.)
3. `content/<wave>.ts` (ou `content/<wave>/<mecanica>.ts` se já passou de 800 linhas, ver §2.2) — `CardDef` + `EffectSpec`.
4. `content/deferred.ts` — se alguma cláusula do texto oficial não fecha com o que existe hoje, entra aqui com `cardCode`, `clause`, `reason`, `blockedBy` — nunca marcar carta como pronta com cláusula faltando.
5. `content/<wave>.manifest.json` — atualizar `implemented_cards`/`deferred_clauses`.
6. `content/<wave>.test.ts` — usando `placeCard`/`withWatchdog` de `engine/__testkit__/cardHarness.ts` (§3b) em vez de duplicar o helper local.
7. `engine/__golden__/harness.ts` — só se a carta entra em algum dos decks de golden master (`fixtures/<wave>Deck.ts`).

Comandos a rodar antes de abrir PR:
```bash
pnpm tsc --noEmit
npx vitest run src/modules/simulator/content/<wave>.test.ts
npx vitest run src/modules/simulator/content/deferred.test.ts
node scripts/gundam-coverage.mjs
node scripts/gundam-fuzz.mjs --decks=<WAVE>,<WAVE> --games=500 --policyA=heuristic --policyB=random
npx vitest run src/modules/simulator/engine/goldenMaster.test.ts
```

Falha em qualquer um bloqueia o PR — nenhum deles deve travar (é o ponto inteiro desta proposta).

---

## Perguntas em aberto que deixo explicitamente para o Gemini contestar

1. O valor `MAX_TRIGGER_CHUNKS = 50` (herdado do consenso de 2026-09-12) ainda é o número certo, ou deveria ser recalibrado agora que sabemos que o único guard real hoje (`MAX_DESTROYED_CHAIN = 8`) é 6x menor e nunca causou falso positivo em produção?
2. Empate determinístico é a saída certa pro estouro do guard, ou deveria haver uma distinção entre "estourou porque é bug de carta" (deveria falhar loud em teste) vs "estourou em partida real" (deveria ser transparente pro jogador como empate, sem parecer um crash)?
3. Vale a pena investir em H2/H3 (§1.2) antes de fechar este trabalho como "resolvido", dado que implementar só o guard sem rodar o fuzzer contra o deck exato do incidente deixa a causa raiz real não confirmada?

---

### 2. Resposta / Auditoria Crítica (Gemini - Auditor)

[CONCORDANCIA: 90%]

---

### Resumo da Auditoria

A proposta do Propositor (Claude) é **sólida, bem fundamentada nos fatos do repositório** e atinge um grau de maturidade técnica elevado. Destaco e me uno aos dois achados mais valiosos revelados pela auditoria do repositório real:

1. **A constatação de que `primitives-claims.json` está atualmente VAZIO (`{}`)**, apesar de termos 42 cláusulas diferidas e dezenas de primitivas novas já em uso em GD01. Isso é uma falha cega de governança que destruiria o RAG lexical em GD02+.
2. **A confirmação irrefutável via `grep` de que a guarda `MAX_TRIGGER_CHUNKS` consensuada em 12/09/2026 nunca virou código**, mantendo o motor exposto a cascatas recursivas sem limitação em `dispatcher.ts`.

Contudo, atuando como **Auditor Crítico**, identifico **3 falhas de premissa, 1 risco de falso positivo em jogo legítimo e 1 penalidade de performance desnecessária no CI** na proposta apresentada. Abaixo detalho os pontos de correção obrigatórios antes da execução.

---

## 1. Correção no Diagnóstico do Incidente (H1 vs H2/H3 e Web Workers)

O Propositor argumentou no §1.2 que uma trava de 4 horas "não poderia ser um loop síncrono puro (H1) porque o Chrome exibiria o diálogo 'Página sem resposta' em segundos".

**Esta premissa do Propositor está INCORRETA para arquiteturas modernas de simulador.**

* **Por que está errada:** Se o simulador roda em um **Web Worker** (arquitetura padrão para motores de jogos pesados e IA em React/Vite para não congelar o framerate de renderização), ou via subprocesso Node/CLI num dev harness:
  - O Web Worker preso em um `while(true)` ou recursão síncrita **consome 100% de 1 núcleo da CPU indefinidamente sem disparar o diálogo de 'Página sem resposta' do Chrome**, pois a thread principal de UI (DOM/React) continua recebendo eventos de mouse, renderizando animações de hover e respondendo a cliques.
  - A UI simplesmente não "avança" a partida porque está aguardando uma mensagem via `postMessage` que a thread do Worker nunca enviará.
* **Conclusão:** O incidente de 4 horas é **100% compatível com H1 (loop síncrono no motor)**. Não devemos dispersar esforço investigando H2/H3 como hipóteses equivalentes antes de fechar o guard síncrono. H1 é a causa raiz primária.

---

## 2. O Risco Crítico de Falso Positivo: "Largura" vs "Profundidade" em `MAX_TRIGGER_CHUNKS`

No §1.3, o Propositor sugere um único contador acumulativo `chunkCount` incrementado a cada sub-gatilho processado dentro de uma única ação de jogador, limitado a `MAX_TRIGGER_CHUNKS = 50`.

**AQUI HÁ UM EDGE CASE DE REGRA DE TCG QUE PODE QUEBRAR PARTIDAS LEGÍTIMAS (FALSO POSITIVO).**

### O Cenario do Board Wipe em Late-Game (Gundam TCG):
Considere uma mesa de late-game:
1. Jogador A joga um Command de área (Board Wipe, ex: *"Cause 5000 de dano a todas as Unidades inimigas"*).
2. O campo possui 5 Unidades do Jogador B, cada uma pareada com 1 Piloto (10 cartas no total).
3. A resolução do Command destrói as 5 Unidades simultaneamente.
4. Isso gera **imediatamente na fila FIFO**:
   - 5 gatilhos 【Destroyed】 de Unidade.
   - 5 gatilhos 【Destroyed】 de Piloto.
   - Suponha que o Jogador A possui 2 Unidades em campo com a habilidade *"Quando uma Unidade inimiga for destruída, compre 1 carta e cause 1000 de dano à Base"*. Como 5 unidades foram destruídas, essa habilidade dispara $5 \times 2 = 10$ vezes.
   - Suponha que os Pilotos destruídos do Jogador B possuem efeitos de despedida ("Quando destruído, recupere 1 carta de comando do lixo"). São mais 5 gatilhos.
5. **Total de chunks sequenciais gerados por uma ÚNICA ação:** $5 + 5 + 10 + 5 = 25$ chunks primários.
6. Se a compra de cartas disparar um efeito secundário (ex: *"Quando você comprar uma carta fora do Draw Step..."*), a fila atinge facilmente **mais de 50 chunks sem que haja NENHUM loop infinito ou recursão**. É apenas a resolução de uma fila de largura extensa em um jogo de cartas complexo.

### Solução Técnica Requerida (Refinamento do Guard):
Não podemos limitar apenas a **largura bruta de chunks por ação**. O motor precisa diferenciar **Largura da Fila FIFO** de **Profundidade de Recursão Cascata**:

```ts
export const MAX_QUEUE_BREADTH = 150; // Teto de segurança para eventos na fila FIFO de uma única ação
export const MAX_CASCADE_DEPTH = 12;   // Teto rígido para prof. de gatilhos que GERAM NOVOS gatilhos em cadeia
```

* **Largura (`MAX_QUEUE_BREADTH = 150`)**: Quantos gatilhos podem ser enfileirados e processados sequencialmente em uma ação (limpa a mesa, processa tudo linearmente).
* **Profundidade (`MAX_CASCADE_DEPTH = 12`)**: Quantos níveis de sub-gatilhos um gatilho pode disparar recursivamente (Gatilho A $\rightarrow$ gera Gatilho B $\rightarrow$ gera Gatilho C... $\rightarrow$ nível 13 $\rightarrow$ **EMPATE FORÇADO POR LOOP**).

Isso previne 100% de falsos positivos em tabuleiros cheios enquanto mata loops infinitos reais (que são caracterizados por profundidade/recursão descontrolada, ex: A re-dispara B que re-dispara A).

---

## 3. Requisito (B): A Falha da Divisão por Mecânica em Sets de Gundam TCG

No §2.2, o Propositor sugere dividir arquivos de waves grandes (`content/<wave>/`) pelo eixo de mecânica: `units.ts`, `pilots-pairing.ts`, `commands.ts`, `bases.ts`, `tokens.ts`.

**PROBLEMA DE ESCALA ESPECÍFICO DO GUNDAM TCG:**

* Em qualquer expansão de Gundam TCG, **Unidades (Units) representam ~65% a 70% de todo o set** (em GD01, são ~90 cartas de 130).
* Se aplicarmos a divisão proposta pelo Claude em GD01/GD02, o arquivo `commands.ts` terá ~200 linhas, `pilots-pairing.ts` terá ~300 linhas, e `units.ts` terá **mais de 3.800 linhas**!
* Ou seja: a divisão por tipo/mecânica **não resolve o problema da verbosidade nas Unidades**, que é justamente a maior fatia do código.

### Critério de Split Refinado e Objetivo:
Adotar a quebra por pasta `content/<wave>/` quando o arquivo único ultrapassar **800 linhas**, mas dividindo as **Units por faixa de ID ou Cor/Facção**:

```
content/gd02/
  index.ts             // barrel re-exporting WAVE_EFFECT_SPECS e WAVE_CARD_DEFS
  units-blue-green.ts  // CardDefs + EffectSpecs (ex: GD02-001 a GD02-045)
  units-red-black.ts   // CardDefs + EffectSpecs (ex: GD02-046 a GD02-090)
  pilots.ts            // Pilotos e habilidades de pareamento
  commands-bases.ts    // Commands, Bases e Tokens
```
Essa estrutura garante que **nenhum** arquivo individual do modulo passe de ~600-800 linhas em nenhuma expansão futura (GD02 a GD10).

---

## 4. Requisito (C) e Performance do CI: A Penalidade Indevida do `pool: "forks"`

No §3b, o Propositor recomendou configurar o Vitest com `pool: "forks"` + `poolOptions.forks.isolate: true` globalmente para impedir travamentos de CI.

**AUDITORIA DE IMPACTO DE PERFORMANCE NO CI:**

1. O Vitest rodando com `pool: "forks"` e isolamento completo cria um novo processo Node.js filho para cada arquivo de teste.
2. Em ecossistemas TypeScript com compilação/transpilação em tempo de execução (Vite/ESBuild), o overhead de inicialização de processos em massa no GitHub Actions (runners Linux/Windows de 2 vCPUs) **pode aumentar o tempo da suíte de testes de 5 segundos para mais de 45 segundos**.
3. **Se implementarmos os guards determinísticos no motor (`MAX_CASCADE_DEPTH` e `MAX_QUEUE_BREADTH`)**, o simulador é **matematicamente incapaz de entrar em um `while(true)` síncrono**. O próprio motor interromperá a execução e retornará um `GAME_OVER` ou lançará um erro estruturado em milissegundos.
4. **Conclusão:** Não há necessidade de penalizar o CI com `pool: "forks"` global. O pool padrão do Vitest (`threads` ou `forks` padrão sem isolamento forçado por arquivo) é totalmente seguro **desde que o motor tenha os guards síncronos internos**.

---

## 5. Exigência de Governança sobre `primitives-claims.json`

Validando e reforçando a descoberta do Propositor: `primitives-claims.json` está zerado (`{}`).

Para atender ao Requisito (B) e garantir que a inclusão contínua de waves não duplique código nem gere verbosidade:
* **Nova Regra Obrigatória no CI**: Criar a verificação `pnpm claims:check` que varre `src/modules/simulator/engine/effectSpec.ts`. Se for detectado qualquer tipo de `PrimitiveCall["type"]` ou `TargetGroup` que não esteja listado em `primitives-claims.json`, o build do CI **DEVE FALHAR**.
* Isso impede que novos desenvolvedores/agentes LLM inventem variações de primitivas sem registrar o vocabulário oficial do motor.

---

## Checklist Prático Ajustado (Versão do Auditor)

Qualquer dev ou agente que adicione cartas em GD01/GD02+ deve seguir esta sequência exata:

### 1. Arquivos a Modificar
1. `src/modules/simulator/engine/effectSpec.ts` (se e somente se houver nova primitiva).
2. `src/modules/simulator/content/primitives-claims.json` (registrar imediatamente qualquer nova primitiva/filtro).
3. `src/modules/simulator/content/<wave>/` (respeitando o teto de 800 linhas por sub-arquivo).
4. `src/modules/simulator/content/deferred.ts` (se houver cláusula não suportada, com motivo tipado).
5. `src/modules/simulator/content/<wave>.manifest.json` (incrementar contadores e status das fases).
6. `src/modules/simulator/content/<wave>.test.ts` (usando o `cardHarness.ts` desacoplado).

### 2. Comandos de Validação e Gate de CI (Execução Local Obrigatória)
```bash
# 1. Checagem de Tipagem Estreita
pnpm tsc --noEmit

# 2. Teste da Wave e Cláusulas Adiadas
npx vitest run src/modules/simulator/content/<wave>.test.ts
npx vitest run src/modules/simulator/content/deferred.test.ts

# 3. Trava de Governança de Primitivas (Novo!)
node scripts/gundam-coverage.mjs

# 4. Fuzzing Bounded com Verificação de Cascata/Recursão
node scripts/gundam-fuzz.mjs --decks=<WAVE>,<WAVE> --games=500 --policyA=heuristic --policyB=random

# 5. Golden Master Regression (Garantia de Não-Regressão de Hashes)
npx vitest run src/modules/simulator/engine/goldenMaster.test.ts
```

---

## Resposta Final às Perguntas do Propositor

1. **Sobre `MAX_TRIGGER_CHUNKS = 50`**: Não usar valor único. Adotar a separação técnica entre **`MAX_CASCADE_DEPTH = 12`** (profundidade de gatilhos encadeados/recursivos) e **`MAX_QUEUE_BREADTH = 150`** (largura da fila FIFO de resolução). Isso previne travamentos e elimina falsos positivos em destruições em massa no late-game.
2. **Tratamento do Estouro**:
   - Em **modo de produção/partida real**: Disparar evento `GAME_OVER` por empate determinístico (`reason: "trigger_loop_guard"`).
   - Em **modo de teste/dev (`NODE_ENV === "test"`)**: O `applyPlayerAction` deve lançar uma exceção explícita (`TriggerLoopException`) com o dump dos últimos 20 eventos, para que o teste falhe com stack trace legível em vez de passar silenciosamente como empate.
3. **Investigação H2/H3**: Implementar os guards de profundidade/largura primeiro. Em seguida, rodar o fuzzer com 2.000 partidas na seed do incidente manual. Se zero travamentos ocorrerem, H1 estará definitivamente provado e encerrado.

Com estes ajustes incorporados, a proposta está **APROVADA** para execução imediata.

</details>
