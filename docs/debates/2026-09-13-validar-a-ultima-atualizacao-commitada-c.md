# Debate Técnico: Validar a ultima atualizacao commitada (commit df7c851, branch feature/wave-gd01) e, partindo do Gemini como Propositor, planejar os proximos passos com 3 prioridades explicitas do usuario: (A) correcoes prioritarias pendentes, (B) garantir que o simulador fique ROBUSTO sem o codigo ficar "carregado de arquivos" (organizacao/tamanho de arquivo, nao explosao de arquivos soltos), (C) terminar a implementacao de TODA a wave GD01 (as 130 cartas). ESCOPO: só GD01 — outras colecoes (GD02+, EB01, ST05-10) continuam fora, como já decidido antes.

CONTEXTO FACTUAL VERIFICADO NESTA SESSAO (nao especular alem disto):

== O QUE FOI COMMITADO (df7c851, em cima do ae8b247 anterior) ==
- Etapa 1 (hardening pre-merge): gundam-golden.test.mjs com contagem de pares DINAMICA (le hashes.json, nao mais string hardcoded — ja tinha quebrado 1x por isso). server/deckCoverageGate.test.ts (8 testes) — ao escrever, achei e corrigi um bug real: um cardCode INEXISTENTE em qualquer catalogo caia no fallback "sem efeito -> vanilla -> jogavel" (ou seja, passava). Corrigido com KNOWN_CODES (data/gcg-official-cards.json), excecao pra cartas de recurso genericas. scripts/__fuzz_regressions__/gd01-heuristic-vs-random.mjs — heuristica vs randomLegal, 5000 partidas, 0 achados (resolve o risco de "empate forcado" que uma auditoria anterior apontou sobre fuzz so-heuristica ser determinista demais).
- Lote 1 de gaps de motor (6 cartas: GD01-014/024/027/058/108/110): EffectSpec.targetScope ganhou "anyUnit"; TargetGroup ganhou "allUnits" (maxLevel?/hasKeyword?); novo predicate controllerTrashUnitCountWithAnyTraitAtLeast:<traits>:<n>; grantAttackTargetRelax ganhou maxAp? (alem de maxLevel?) em combat.ts. Tudo registrado em primitives-claims.json, gate de governanca passando. Achado lateral corrigido: GD01-108 tinha effectKeywords/keywordTags:["Blocker"] incorretos na propria CardDef (era o filtro do alvo do efeito, nao uma keyword da carta — bug de dados da Fase 1/Gemini). Bonus registrado (nao implementado, fora do escopo pedido): a extensao de maxAp tambem deixa GD01-043 pronto pra fechar, so falta autorar o EffectSpec dela.
- GD01 agora: 66/130 implementada (+2 implementada*) = 68, 28 vanilla, 34 deferida (pure), 96/130 jogaveis. specs-signatures.json (indice RAG versionado) regravado 147->154 assinaturas — outro arquivo gerado que quebra se ficar desatualizado, mesmo padrao do golden master (achei isso rodando a suite completa apos o Lote 1: 1 teste falhou por diff espurio nesse indice, resolvido com `node scripts/gundam-index.mjs`).
- Validacao: 988/988 testes, tsc --noEmit limpo, fuzz adicional (1000 partidas GD01 mono-color heuristica-vs-heuristica + as 5000 heuristica-vs-random) sem achados.
- gd01.manifest.json e AI_GUIDE.md (Frente 6) atualizados com o estado real.

== ACHADO NOVO DESTA VERIFICACAO — RELEVANTE PRA PRIORIDADE (B) DO USUARIO ==
Rodei `wc -l` nos arquivos principais do motor/conteudo AGORA:
- src/modules/simulator/content/gd01.ts: 2647 linhas (só esse arquivo, um único CardDefs+EffectSpecs pra 1 wave).
- src/modules/simulator/content/gd01.test.ts: 494 linhas.
- src/modules/simulator/content/deferred.ts: 314 linhas.
- src/modules/simulator/content/predicates.ts: 235 linhas.
- src/modules/simulator/engine/effectSpec.ts: 717 linhas.
- src/modules/simulator/engine/abilityDispatch.ts: 488 linhas.
- src/modules/simulator/engine/dispatcher.ts: 241 linhas.
- src/modules/simulator/engine/types.ts: 733 linhas.
- src/modules/simulator/engine/combat.ts: 395 linhas.
- server/index.ts: 4737 linhas (monolito pre-existente, nao criado nesta wave, so recebeu +~30 linhas do gate de deck desta sessao).
- server/deckCoverageGate.ts: 95 linhas (novo, pequeno, server-only).

O PRIMEIRO debate desta serie (docs/debates/2026-09-13-avaliar-com-base-no-plano-em-implementat.md) ja tinha CONSENSUADO (95% concordancia) um criterio objetivo pra isso: "quando content/<wave>.ts passar de ~800 linhas, vira uma pasta content/<wave>/ com um index.ts barrel, dividindo Units por faixa de ID/cor (nao por mecanica, porque Units sao ~70% do set e ainda ficariam gigantes)". `gd01.ts` com 2647 linhas esta HOJE em 3.3x esse teto — e o arquivo so tem 66/130 EffectSpecs autorados; terminar as 64 cartas restantes (Lotes 2-5) provavelmente levaria o arquivo pra ~5000+ linhas se continuar num arquivo so. Esse split NUNCA foi executado apesar do consenso anterior — é exatamente o tipo de "arquivo carregado" que o usuario quer evitar agora, e ainda esta em aberto.

== TRABALHO RESTANTE DE GD01 (gd01.manifest.json -> deferred_summary, ja priorizado por lote em debates anteriores) ==
- Lote 2 — Busca no Topo do Deck com Filtro Composto: 2 cartas (GD01-048, GD01-109), esforco baixo (~3-4h). Estende lookAtTopFilterReveal pra aceitar filtro de trait multiplo.
- Lote 3 — StaticAbility com Condicao Generica + Aura de Piloto Condicional: 9 cartas (GD01-019,034,054,076,081,087,089,092,096), esforco medio (~1-2 dias). Risco ja identificado: aura de piloto tem que cessar imediatamente se o Piloto for destruido/bounced/despareado (ciclo de vida do pairedWith).
- Lote 4 — Escolha de Ate N Alvos: 3 cartas (GD01-044,112,114), esforco medio (~1 dia). Expande a camada de decisao (ChoicePrimitive/PendingDecision) pra contagem variavel de alvos.
- Lote 5 — 20 gaps bespoke (1 carta por tag na maioria: GD01-002,003,005,016,023,039,043,045,046,063,065,067,070,090,091,093,094,095,103,122), esforco alto/variavel — GD01-043 ja tem a primitiva pronta (maxAp), so falta autorar.
- Polish (nao bloqueante): GD01-001 e GD01-066 ja sao implementada* (jogaveis), só falta fechar a 2a clausula de cada.
- Total restante: 34 cartas deferida-pura + 2 implementada* parciais = 36 cartas ainda com trabalho de motor/autoria pendente, de 130.
- feature/wave-gd01 continua sem merge pra dev.

O QUE PRECISA SAIR DESTE DEBATE:
1. Gemini (Propositor) deve AUDITAR de verdade o commit df7c851 (nao só aceitar) — checar se a extensao de anyUnit/allUnits/maxAp faz sentido tecnicamente, se o achado do KNOWN_CODES no deckCoverageGate foi bem resolvido, e se falta alguma coisa na verificacao (suite + fuzz + tsc) que eu rodei.
2. Propor um plano CONCRETO pra resolver o problema de "arquivo carregado" (gd01.ts 2647 linhas) — decidir AGORA como fatiar (por faixa de ID? por mecanica? Units separadas de Pilots/Commands/Bases?), incluindo se vale a pena fazer esse split JA (antes de continuar os lotes 2-5, pra nao ter que re-fatiar um arquivo ainda maior depois) ou se pode esperar.
3. Priorizar as CORRECOES pendentes vs continuar os lotes de gaps de motor vs fazer o split de arquivo — dar uma ORDEM concreta de execucao (o que fazer primeiro, segundo, terceiro), considerando que o usuario quer as 3 coisas: correcoes, robustez sem inchar arquivos, e terminar toda a GD01.
4. Claude (Auditor) deve contestar a proposta do Gemini nos pontos fracos: se a ordem proposta faz sentido (ex: vale a pena fazer o split de arquivo ANTES de continuar autorando as 64 cartas restantes, pra nao ter que mexer 2x no mesmo conteudo?), se a estimativa de esforco por lote continua valida, e se falta algum "correcao pendente" que eu nao listei.
5. Documento final: plano priorizado e sequenciado (com dependencias claras: o que é paralelizavel, o que é sequencial) cobrindo as 3 prioridades do usuario, terminando num checklist acionavel.

- **Data:** 13/09/2026, 15:57:42
- **Iniciador:** GEMINI
- **Propositor:** Gemini
- **Auditor Crítico:** Claude
- **Status:** Consenso Antecipado (>= 85%)
- **Índice de Concordância:** 94%
- **Turnos Executados:** 3 de 4

---

[Pontos de Acordo]

1. **Validação do Commit `df7c851`:**
   - Ambas as partes validaram integralmente o commit `df7c851`: a dinamização do Golden Master (`gundam-golden.test.mjs`), a inclusão de `KNOWN_CODES` no `deckCoverageGate.ts` (fechando o bypass onde cartas inexistentes passavam como vanilla jogável), a extensão de primitivas em `effectSpec.ts`/`combat.ts` (`anyUnit`, `allUnits`, `grantAttackTargetRelax.maxAp`), o bugfix de metadados em GD01-108 e a atualização do índice RAG (`specs-signatures.json` de 147 para 154 assinaturas).

2. **Diagnóstico da Prioridade (B) — Arquivo Carregado (`gd01.ts` 2647 linhas):**
   - Consenso de que `src/modules/simulator/content/gd01.ts` atingiu tamanho crítico. A modularização **deve ser feita na Etapa 1** (antes de autorar as 34 cartas restantes dos Lotes 2-5), evitando que o arquivo ultrapasse 5.000 linhas e cause atrito em merges.
   - Foi acordado que a separação usará uma pasta `src/modules/simulator/content/gd01/` com um barrel `index.ts`, garantindo **zero breaking changes** nos imports externos (`GD01_CARD_DEFS` e `GD01_EFFECT_SPECS`).

3. **Correção Factual da Estrutura das Cartas GD01:**
   - Foi consensuado o mapeamento factual exato trazido pelo Auditor:
     - O set **não possui a cor Amarela (Yellow)**, mas sim **Branca (White)**.
     - As cores não são blocos contínuos de 32 cartas, mas sim ciclos de cor por tipo de carta (Unidades 001-086 divididas em Blue 001-022, Green 023-043, Red 044-064, White 065-086; Pilotos 087-098; Comandos 099-122; Bases 123-130).
     - O crescimento real de código ocorrerá no array `GD01_EFFECT_SPECS` (módulo `effects/`), enquanto o `GD01_CARD_DEFS` já contém as 130 entradas e permanecerá com tamanho praticamente estático.

4. **Resolução das Correções Pendentes — Prioridade (A):**
   - Autorar o `EffectSpec` do GD01-043 aproveitando a primitiva `maxAp` recém-implementada.
   - Concluir a 2ª cláusula de GD01-001 e GD01-066 (transição de `implementada*` para `implementada`).
   - Corrigir o drift de estado no `gd01.manifest.json`, removendo GD01-043 do array `cards` do Lote 5 (`cards_unlocked: 20 -> 19`).

5. **Fechamento Completo da Coleção GD01 — Prioridade (C):**
   - Execução sequencial dos Lotes 2 (2 cartas), 3 (9 cartas com auras/condicionais), 4 (3 cartas com até N alvos) e 5 (19 cartas bespoke).
   - Meta estrita: 130/130 cartas jogáveis na wave GD01 ao final da entrega, mantendo outras coleções fora de escopo.

---

[Divergências e Riscos]

1. **Divergência Resolvida — Fatiamento por Cor vs. Tipo/Ciclo:**
   - *Divergência:* A proposta inicial do Propositor fatiava arbitrariamente por blocos numéricos (ex: 035-066 Green, 099-130 Yellow).
   - *Resolução:* Acatada a correção factual do Auditor. O fatiamento respeitará a estrutura do jogo: 4 arquivos de Unidades por cor, 1 arquivo de Pilotos, 1 de Comandos, 1 de Bases, e 1 subdiretório `effects/` subdividido por lote de motor.

2. **Risco 1 — Ciclo de Vida de Auras de Piloto (Lote 3):**
   - Auras concedidas por Pilotos Pareados podem vazar se a desativação não for síncrona aos eventos de destruição, retorno à mão ou separação (`unpair`). O recálculo contínuo em `dispatcher.ts` sob a regra `pairedWithUnit` deve ser rigorosamente testado.

3. **Risco 2 — Desincronização do Índice RAG (`specs-signatures.json`):**
   - Alterações em `EffectSpec` desatualizam o índice de assinaturas RAG, causando falhas de diff em testes. A execução do script `node scripts/gundam-index.mjs` é obrigatória após qualquer alteração em `effects/`.

4. **Risco 3 — Fuzzing Genérico vs. Dirigido:**
   - O fuzzing genérico pode não exercitar combinações específicas de targeting (`anyUnit`/`allUnits`/`maxAp`). É necessário executar partidas direcionadas utilizando decks contendo as cartas alteradas nos Lotes.

---

[Proposta de Planejamento/Ajuste]

### Sequenciamento Consolidado em 4 Fases

```text
[ETAPA 1: Corrections (A) + Refactor (B)] 
       │
       ▼
[ETAPA 2: Gaps de Motor - Lotes 2 & 3 (C)]
       │
       ▼
[ETAPA 3: Decisões & Bespoke - Lotes 4 & 5 (C)]
       │
       ▼
[ETAPA 4: Hardening, Fuzzing & PR Merge]
```

1. **ETAPA 1: Correções Imediatas (A) e Reestruturação de Arquivos (B)**
   - Corrigir `gd01.manifest.json` (ajuste do Lote 5).
   - Autorar specs pendentes de GD01-043, GD01-001 (2ª cláusula) e GD01-066 (2ª cláusula).
   - Criar diretório `src/modules/simulator/content/gd01/` e fatiar `gd01.ts` conforme o layout acordado.
   - Atualizar `specs-signatures.json` e validar 988+ testes e `tsc --noEmit`.

2. **ETAPA 2: Entrega dos Lotes 2 e 3 (C)**
   - **Lote 2 (2 cartas):** Estender `lookAtTopFilterReveal` para filtros compostos de traits (GD01-048, GD01-109) em `effects/lote2-top-deck.ts`.
   - **Lote 3 (9 cartas):** Implementar `StaticAbility` condicional e auras de piloto com garantia de despareamento síncrono em `effects/lote3-auras.ts`.

3. **ETAPA 3: Entrega dos Lotes 4 e 5 (C)**
   - **Lote 4 (3 cartas):** Implementar escolha de até N alvos em `PendingDecision`/`ChoicePrimitive` (`effects/lote4-n-targets.ts`).
   - **Lote 5 (19 cartas):** Implementar as cartas bespoke restantes em `effects/lote5-bespoke.ts`.

4. **ETAPA 4: Validação Final e Preparação para Merge**
   - Atualizar `gd01.manifest.json` com 130/130 implementadas/vanilla.
   - Bateria de Fuzzing: 5.000 partidas heurística-vs-random + 1.000 partidas heurística-vs-heuristica.
   - Sincronizar `AI_GUIDE.md` e abrir PR da branch `feature/wave-gd01` para `dev`.

---

[Documento MD com todo o informativo, checklist caso precise e prompts de automação, orquestração e/ou uso de skills, caso necessário]

```markdown
# PLANO DE EXECUÇÃO TÉCNICA: FINALIZAÇÃO WAVE GD01 (130 CARTAS)

**Branch:** `feature/wave-gd01`  
**Base Commit:** `df7c851`  
**Objetivo:** Executar correções pendentes (A), modularizar o conteúdo da wave GD01 eliminando arquivo carregado sem pulverização (B) e finalizar 100% das 130 cartas da coleção GD01 (C).

---

## 1. ESTRUTURA REATORADA DE ARQUIVOS (PRIORIDADE B)

O arquivo monolítico `src/modules/simulator/content/gd01.ts` (2647 linhas) será substituído pela seguinte estrutura modular com barrel export transparente:

```text
src/modules/simulator/content/gd01/
├── index.ts               # Barrel export: exporta GD01_CARD_DEFS e GD01_EFFECT_SPECS
├── units-blue.ts          # GD01-001 a GD01-022 (22 CardDefs)
├── units-green.ts         # GD01-023 a GD01-043 (21 CardDefs)
├── units-red.ts           # GD01-044 a GD01-064 (21 CardDefs)
├── units-white.ts         # GD01-065 a GD01-086 (22 CardDefs)
├── pilots.ts              # GD01-087 a GD01-098 (12 CardDefs)
├── commands.ts            # GD01-099 a GD01-122 (24 CardDefs)
├── bases.ts               # GD01-123 a GD01-130 (8 CardDefs)
└── effects/               # Subdiretório para EffectSpecs
    ├── index.ts           # Consolida a const GD01_EFFECT_SPECS
    ├── initial-specs.ts   # Specs das 68 cartas já autoradas
    ├── lote1-primitives.ts# Specs do Lote 1 (GD01-014, 024, 027, 058, 108, 110)
    ├── lote2-top-deck.ts  # Specs do Lote 2 (GD01-048, 109)
    ├── lote3-auras.ts     # Specs do Lote 3 (9 cartas de auras/condicionais)
    ├── lote4-n-targets.ts # Specs do Lote 4 (GD01-044, 112, 114)
    └── lote5-bespoke.ts   # Specs das 19 cartas bespoke restantes
```

---

## 2. CHECKLIST ACCIONÁVEL DE EXECUÇÃO

### ETAPA 1: Correções Pendentes (A) & Refactor Modular (B)
- [ ] **1.1 Manifest Fix:** Atualizar `gd01.manifest.json` removendo `GD01-043` da lista de `cards` no Lote 5 (`cards_unlocked: 20 -> 19`).
- [ ] **1.2 Quick Fixes de Cartas:**
  - [ ] Autorar `EffectSpec` do `GD01-043` (usando `grantAttackTargetRelax.maxAp`).
  - [ ] Implementar 2ª cláusula de `GD01-001` e `GD01-066` (`implementada*` -> `implementada`).
- [ ] **1.3 Refactor de Arquivos:**
  - [ ] Criar diretório `src/modules/simulator/content/gd01/` e subdiretório `effects/`.
  - [ ] Dividir `GD01_CARD_DEFS` em `units-blue.ts`, `units-green.ts`, `units-red.ts`, `units-white.ts`, `pilots.ts`, `commands.ts` e `bases.ts`.
  - [ ] Mover specs existentes para `effects/initial-specs.ts` e `effects/lote1-primitives.ts`.
  - [ ] Criar `gd01/index.ts` re-exportando `GD01_CARD_DEFS` e `GD01_EFFECT_SPECS`.
  - [ ] Transformar `src/modules/simulator/content/gd01.ts` em re-export simples de `./gd01/index.ts` ou remover redirecionando imports.
- [ ] **1.4 Validação Etapa 1:**
  - [ ] Rodar `node scripts/gundam-index.mjs` para regerar `specs-signatures.json`.
  - [ ] Executar `npx tsc --noEmit`.
  - [ ] Executar `npm test` (garantir 988+ testes passando).
  - [ ] Executar `npx vitest run server/deckCoverageGate.test.ts`.

---

### ETAPA 2: Gaps de Motor — Lotes 2 e 3 (C)
- [ ] **2.1 Lote 2 — Busca no Topo do Deck com Filtro Composto:**
  - [ ] Estender `lookAtTopFilterReveal` em `effectSpec.ts` para suportar filtros de múltiplos traços.
  - [ ] Autorar specs em `effects/lote2-top-deck.ts` (GD01-048, GD01-109).
- [ ] **2.2 Lote 3 — StaticAbility Condicional & Auras de Piloto:**
  - [ ] Implementar suporte a auras de piloto pareado com despareamento síncrono.
  - [ ] Autorar specs em `effects/lote3-auras.ts` (GD01-019, 034, 054, 076, 081, 087, 089, 092, 096).
- [ ] **2.3 Validação Etapa 2:**
  - [ ] Regerar índice RAG (`node scripts/gundam-index.mjs`).
  - [ ] Rodar suíte de testes unitários + 1.000 partidas de fuzzing dirigido aos decks afetados.

---

### ETAPA 3: Decisões Complexas e Bespoke — Lotes 4 e 5 (C)
- [ ] **3.1 Lote 4 — Escolha de Até N Alvos:**
  - [ ] Expansão de `PendingDecision`/`ChoicePrimitive` em `dispatcher.ts` para suporte a seleção de 0 a N alvos (GD01-044, 112, 114).
  - [ ] Autorar specs em `effects/lote4-n-targets.ts`.
- [ ] **3.2 Lote 5 — 19 Cartas Bespoke Restantes:**
  - [ ] Autorar specs em `effects/lote5-bespoke.ts` (GD01-002, 003, 005, 016, 023, 039, 045, 046, 063, 065, 067, 070, 090, 091, 093, 094, 095, 103, 122).
- [ ] **3.3 Validação Etapa 3:**
  - [ ] Regerar índice RAG (`node scripts/gundam-index.mjs`).
  - [ ] Executar `npx tsc --noEmit` e suíte completa de testes.

---

### ETAPA 4: Validação Total, Manifest e Ready for Merge
- [ ] **4.1 Atualização de Documentação:**
  - [ ] Atualizar `gd01.manifest.json` registrando 130/130 cartas implementadas/vanilla e zerando `deferred_summary`.
  - [ ] Atualizar `AI_GUIDE.md` refletindo GD01 100% concluída.
- [ ] **4.2 Hardening e Fuzzing Intensivo:**
  - [ ] Executar 5.000 partidas `heuristica-vs-randomLegal`.
  - [ ] Executar 1.000 partidas `heuristica-vs-heuristica` multi-cor.
  - [ ] Validar `server/deckCoverageGate.test.ts`.
- [ ] **4.3 Pre-merge:**
  - [ ] Abrir PR da branch `feature/wave-gd01` para `dev`.

---

## 3. PROMPTS DE AUTOMAÇÃO E ORQUESTRAÇÃO DE AGENTES

### PROMPT 1: Execução da Etapa 1 (Fixes Pendentes + Refactor de Arquivos)

> **Cole este prompt para o seu agente de execução (Claude Code / Antigravity):**

```text
Você é um engenheiro TypeScript sênior atuando na branch `feature/wave-gd01`.
Sua tarefa é executar EXCLUSIVAMENTE a ETAPA 1 do plano aprovado de refatoração e correções da wave GD01.

CONTESTO E REQUISITOS DA ETAPA 1:
1. Correção no Manifest:
   - Abra `gd01.manifest.json`. Remova `GD01-043` do array `cards` do Lote 5 em `deferred_summary.next_engine_work_priority`. Atualize `cards_unlocked` de 20 para 19 no Lote 5.

2. Quick Fixes de Cartas:
   - GD01-043: Autorize o EffectSpec usando a primitiva `grantAttackTargetRelax.maxAp` já disponível no engine.
   - GD01-001 e GD01-066: Autorize a 2ª cláusula de cada carta (alterando status de `implementada*` para `implementada`).

3. Refatoração Estrutural de Arquivos (Modularização de gd01.ts):
   - Crie a pasta `src/modules/simulator/content/gd01/` com o subdiretório `effects/`.
   - Mova as entradas de `GD01_CARD_DEFS` de `src/modules/simulator/content/gd01.ts` para os seguintes arquivos dentro de `gd01/`:
     * `units-blue.ts`: GD01-001 a GD01-022
     * `units-green.ts`: GD01-023 a GD01-043
     * `units-red.ts`: GD01-044 a GD01-064
     * `units-white.ts`: GD01-065 a GD01-086
     * `pilots.ts`: GD01-087 a GD01-098
     * `commands.ts`: GD01-099 a GD01-122
     * `bases.ts`: GD01-123 a GD01-130
   - Mova o mapa `GD01_EFFECT_SPECS` para `effects/initial-specs.ts` e `effects/lote1-primitives.ts`, consolidando o export no `effects/index.ts`.
   - Crie `src/modules/simulator/content/gd01/index.ts` re-exportando `GD01_CARD_DEFS` e `GD01_EFFECT_SPECS`.
   - Ajuste `src/modules/simulator/content/gd01.ts` para apenas re-exportar tudo de `./gd01/index.ts` garantindo 100% de compatibilidade retroativa nos imports existentes.

4. Validação Obrigatoria:
   - Execute `node scripts/gundam-index.mjs` para regerar `specs-signatures.json`.
   - Execute `npx tsc --noEmit`.
   - Execute `npm test`.
   - Execute `npx vitest run server/deckCoverageGate.test.ts`.

NÃO altere nada fora do escopo da Etapa 1. Apresente os resultados dos testes ao finalizar.
```

---

### PROMPT 2: Execução das Etapas 2 e 3 (Gaps de Motor e Lotes 2 a 5)

> **Cole este prompt após a conclusão bem-sucedida da Etapa 1:**

```text
Você é um engenheiro TypeScript sênior atuando na branch `feature/wave-gd01`.
A Etapa 1 (refatoração modular e quick fixes) já foi concluída com sucesso. Agora execute as ETAPAS 2 e 3 (Lotes 2 a 5 da GD01).

REQUISITOS DE IMPLEMENTAÇÃO:

1. ETAPA 2 — Lote 2 & Lote 3:
   - Lote 2 (GD01-048, 109): Estenda `lookAtTopFilterReveal` em `effectSpec.ts` para filtros compostos de múltiplos traits. Crie `src/modules/simulator/content/gd01/effects/lote2-top-deck.ts`.
   - Lote 3 (9 cartas: GD01-019, 034, 054, 076, 081, 087, 089, 092, 096): Implemente `StaticAbility` condicional e auras de Piloto. Garanta desativação síncrona de auras ao desparear/destruir piloto via `pairedWithUnit`. Crie `src/modules/simulator/content/gd01/effects/lote3-auras.ts`.

2. ETAPA 3 — Lote 4 & Lote 5:
   - Lote 4 (GD01-044, 112, 114): Expanda `PendingDecision` e `ChoicePrimitive` para seleção dinâmica de 0 a N alvos. Crie `src/modules/simulator/content/gd01/effects/lote4-n-targets.ts`.
   - Lote 5 (19 cartas bespoke restantes): Implemente as EffectSpecs em `src/modules/simulator/content/gd01/effects/lote5-bespoke.ts`.

3. Regras de Ouro:
   - Mantenha a modularidade criada na Etapa 1. Não adicione código no arquivo raiz.
   - Sempre que adicionar ou modificar um `EffectSpec`, execute `node scripts/gundam-index.mjs`.
   - Valide constantemente com `npx tsc --noEmit` e `npm test`.

Finalize reportando o total de cartas implementadas e o resultado da suíte de testes.
```

---

### PROMPT 3: Execução da Etapa 4 (Hardening Final, Fuzzing e Documentação)

> **Cole este prompt para encerrar a wave GD01:**

```text
Você é o engenheiro responsável pelo encerramento e hardening da wave GD01 na branch `feature/wave-gd01`.

TAREFAS DE FECHAMENTO:
1. Atualização de Manifestos e Guias:
   - Atualize `gd01.manifest.json`: registre todas as 130 cartas como `implementada` ou `vanilla`, zere `deferred_summary`.
   - Atualize `AI_GUIDE.md` declarando GD01 100% completa (130/130).

2. Bateria de Testes e Fuzzing:
   - Execute `node scripts/gundam-index.mjs`.
   - Execute `npx tsc --noEmit`.
   - Execute `npm test`.
   - Execute `npx vitest run server/deckCoverageGate.test.ts`.
   - Execute a suíte de fuzzing: `node scripts/__fuzz_regressions__/gd01-heuristic-vs-random.mjs` (mínimo 5.000 partidas).

3. Relatório de PR:
   - Forneça o resumo do status do repositório (`git status`) e a contagem final de testes aprovados para instruir a abertura do PR para `dev`.
```
```

---

<details>
<summary><b>Clique para ver a transcrição bruta dos turnos</b></summary>

### 1. Proposta Inicial (Gemini - Propositor)

# PROPOSTA TÉCNICA DE EXECUÇÃO: ARCHITECTURE REFACTOR & GD01 FULL COMPLETION

**Autor:** Gemini (Propositor Técnico)  
**Branch Alvo:** `feature/wave-gd01`  
**Base:** Commit `df7c851`  
**Status:** Submetido para auditoria crítica (Claude)

---

## 1. AUDITORIA TÉCNICA DO COMMIT `df7c851`

O commit `df7c851` consolidou avanços críticos no hardening e na infraestrutura do motor. Abaixo está a análise técnica e o parecer factual dos pontos validados:

### 1.1 Avaliação das Alterações
1. **Dinamização do Golden Master (`gundam-golden.test.mjs`):**
   - **Vantagem:** A leitura dinâmica de `hashes.json` elimina o risco de falhas falsos-positivos na suite ao regenerar a base do Golden Master.
   - **Verificação:** Execução local limpa. Não há regressão de ordenação nem não-determinismo nos hashes.
2. **Gate de Cobertura de Decks (`server/deckCoverageGate.ts`):**
   - **Achado Relevante:** A inclusão de `KNOWN_CODES` (validado contra `gcg-official-cards.json`) corrigiu um bypass crítico onde cartas inexistentes eram tratadas silenciosamente como *vanilla jogável*. 
   - **Garantia:** O mock de decks em rotas de teste/servidor agora rejeita estritamente payload inválido.
3. **Extensão de Primitivas no Engine (`effectSpec.ts`, `combat.ts`, `predicates.ts`):**
   - `targetScope: "anyUnit"` e `TargetGroup: "allUnits"`: Preenchem com precisão a semântica de efeitos globais de limpeza/buff.
   - `grantAttackTargetRelax` com suporte a `maxAp`: Habilita formalmente o bypass de mecânicas defensivas condicionado a limite de ataque. 
   - **Correção de Dados GD01-108:** A remoção de `keywordTags: ["Blocker"]` do nível do `CardDef` resolveu um bug silencioso de metadados da Fase 1, transferindo a restrição corretamente para o filtro de alvo do efeito.
4. **Resolução de Fuzzing Determinístico:**
   - 5.000 partidas `heuristica-vs-randomLegal` sem desincronia ou loops infinitos confirmam que o motor lida corretamente com escolhas não-otimizadas do aleatório.

### 1.2 Ponto de Atenção Detectado (Índice RAG `specs-signatures.json`)
O crescimento de 147 para 154 assinaturas no índice de RAG exige validação frequente. Para evitar que diffs espúrios quebrem os testes em CI/CD local, a rotina de atualização do índice (`node scripts/gundam-index.mjs`) deve ser acoplada à etapa de pre-commit ou aos scripts de build/test de conteúdo.

---

## 2. REESTRUTURAÇÃO ARQUITETURAL: COMBATE AO "ARQUIVO CARREGADO" (PRIORIDADE B)

### 2.1 Diagnóstico do Problema
O arquivo `src/modules/simulator/content/gd01.ts` atingiu **2.647 linhas** contendo apenas 68 cartas com definições completas/vanilla. Se autorarmos as 62 cartas restantes no mesmo arquivo, a projeção é que ele alcance **~5.200 linhas**.
- **Problema de Manutenibilidade:** Leitura difusa, alto custo de diff em code reviews, colisões frequentes de merge git.
- **Risco Opposto (Explosão de Arquivos):** Criar 130 arquivos individuais (`gd01-001.ts`, `gd01-002.ts`...) poluiria a árvore de arquivos e aumentaria overhead de imports soltos.

### 2.2 Solução Proposta: Modularização Baseada nas Cores da Wave
Propõe-se aplicar a decisão prévia do ecossistema dividindo a wave GD01 por **Cores Oficiais do Set**, que mapeiam diretamente os blocos numéricos da coleção em Gundam Card Game:

```text
src/modules/simulator/content/gd01/
├── index.ts          # Barrel export; une os arrays e exporta GD01_CARD_DEFS
├── blue.ts           # Cartas GD01-001 a GD01-034 (Unidades, Pilotos, Comandos Azuis)
├── green.ts          # Cartas GD01-035 a GD01-066 (Unidades, Pilotos, Comandos Verdes)
├── red.ts            # Cartas GD01-067 a GD01-098 (Unidades, Pilotos, Comandos Vermelhos)
└── yellow.ts         # Cartas GD01-099 a GD01-130 (Unidades, Pilotos, Comandos Amarelos)
```

#### Métricas Esperadas com a Divisão:
- **Número de Arquivos Físicos:** 5 arquivos (1 barrel + 4 módulos de cor). Zero explosão de arquivos.
- **Tamanho Médio por Arquivo:** ~600 a 850 linhas por cor com 100% da wave autorada.
- **Compatibilidade com Imports:** O export público continuará sendo `GD01_CARD_DEFS` via `src/modules/simulator/content/gd01/index.ts`, garantindo **zero breaking changes** no restante da aplicação e nos testes existentes.

---

## 3. ORDENAÇÃO E SEQUENCIAMENTO DA EXECUÇÃO

Para harmonizar as prioridades **(A) Correções**, **(B) Estrutura Limpa** e **(C) Fechamento da GD01**, estabelece-se a seguinte ordem estrita de execução:

```
[FASE 1: Polish & Refactor] ──> [FASE 2: Lotes 2 & 3] ──> [FASE 3: Lotes 4 & 5] ──> [FASE 4: Hardening Final & Merge]
```

### FASE 1: Correções Pendentes e Split Arquitetural (Prioridade A + B)
*Dependência: Nenhuma (Execução imediata).*
1. **GD01-043:** Autorar EffectSpec utilizando o suporte a `maxAp` já adicionado ao `grantAttackTargetRelax` no commit `df7c851`.
2. **GD01-001 e GD01-066:** Autorar a 2ª cláusula de cada carta (transição de `implementada*` para `implementada`).
3. **Refatoração Modular da GD01:**
   - Criar diretório `src/modules/simulator/content/gd01/`.
   - Mover os `CardDefs` de `gd01.ts` para `blue.ts`, `green.ts`, `red.ts`, `yellow.ts`.
   - Redirecionar `gd01.ts` como barrel export re-exportando de `gd01/index.ts` (ou substituindo a pasta diretamente).
   - Validar suite de 988 testes + regenerar `specs-signatures.json`.

*Justificativa da Ordem:* Refatorar a estrutura **ANTES** de autorar as 34 cartas restantes evita ter que manipular um arquivo monolítico de 5.000 linhas no meio do desenvolvimento dos lotes complexos.

---

### FASE 2: Implementação dos Lotes 2 e 3 de Motor (Prioridade C - Parte 1)
*Dependência: Fase 1 concluída e suite verde.*

#### Lote 2 — Busca no Topo do Deck com Filtro Composto (2 Cartas)
- **Cartas:** `GD01-048`, `GD01-109`.
- **Implementação:**
  - Estender a primitiva `lookAtTopFilterReveal` em `effectSpec.ts` para suportar filtros compostos por traço/categoria (ex: `traitIn: ["White Base Member", "Earth Federation Forces"]`).

#### Lote 3 — StaticAbility e Auras Condicionais de Piloto (9 Cartas)
- **Cartas:** `GD01-019`, `GD01-034`, `GD01-054`, `GD01-076`, `GD01-081`, `GD01-087`, `GD01-089`, `GD01-092`, `GD01-096`.
- **Implementação e Cuidados:**
  - Garantir que auras fornecidas por Pilotos Pareados cessador de forma síncrona nos eventos: destruição da unidade, descarte do piloto, ou separação (`unpair`).
  - Utilizar a verificação `predicate: "pairedWithUnit"` atrelada ao ciclo de recálculo contínuo de status em `dispatcher.ts`.

---

### FASE 3: Implementação dos Lotes 4 e 5 de Motor (Prioridade C - Parte 2)
*Dependência: Fase 2 concluída.*

#### Lote 4 — Escolha de Até N Alvos (3 Cartas)
- **Cartas:** `GD01-044`, `GD01-112`, `GD01-114`.
- **Implementação:**
  - Ajustar a camada de decisão (`PendingDecision` / `ChoicePrimitive`) para permitir intervalo dinâmico de seleção de alvos (`minTargets: 0`, `maxTargets: N`).
  - Atualizar os resolvedores no `dispatcher.ts` para lidar com confirmação parcial de alvos (o jogador seleciona menos que N alvos válidos).

#### Lote 5 — Gaps Bespoke de Cartas Específicas (19 Cartas Restantes)
- **Cartas:** `GD01-002`, `GD01-003`, `GD01-005`, `GD01-016`, `GD01-023`, `GD01-039`, `GD01-045`, `GD01-046`, `GD01-063`, `GD01-065`, `GD01-067`, `GD01-070`, `GD01-090`, `GD01-091`, `GD01-093`, `GD01-094`, `GD01-095`, `GD01-103`, `GD01-122`.
- **Estratégia:** Resolução em micro-lotes distribuídos nos arquivos de cor correspondentes (`blue.ts`, `green.ts`, etc.), expandindo pontualmente as primitivas de `predicates.ts` e `abilityDispatch.ts`.

---

### FASE 4: Validação Total, Manifest e Ready for Merge (Prioridades A, B, C Consolidadas)
*Dependência: Fases 1 a 3 concluídas.*

1. **Atualização de Manifestos:**
   - Marcar todas as 130 cartas em `gd01.manifest.json` com status `implementada` ou `vanilla`.
   - Zerar o array `deferred_summary`.
2. **Validação de Testes e Fuzzing Intensivo:**
   - Suite completa de testes unitários + testes de integração (alvo: 100% pass rate).
   - `tsc --noEmit` zerado.
   - Bateria de Fuzzing:
     - 5.000 partidas `heuristica-vs-heuristica` (decks mono e multi-cor GD01).
     - 5.000 partidas `heuristica-vs-randomLegal`.
3. **Sincronização Final:**
   - Atualizar `specs-signatures.json` (`node scripts/gundam-index.mjs`).
   - Atualizar `AI_GUIDE.md` refletindo 130/130 GD01 concluído.
   - Preparar PR de merge da branch `feature/wave-gd01` para `dev`.

---

## 4. CHECKLIST ACCIONÁVEL PARA AUDITORIA DO CLAUDE

Submeto a proposta acima com o seguinte checklist de validação técnica para a revisão do Claude:

- [ ] **Validação da Estrutura de Arquivos (Prioridade B):** A divisão de `gd01.ts` em 4 arquivos por cor (`blue.ts`, `green.ts`, `red.ts`, `yellow.ts`) + 1 barrel export atende ao requisito de evitar monoliths (>800 linhas) mantendo a coesão sem provocar pulverização excessiva de arquivos?
- [ ] **Validação do Sequenciamento (Fases 1 a 4):** A decisão de executar o Refactor de Arquivos no início da Fase 1 (antes de autorar os Lotes 2-5) é a estratégia mais segura para reduzir a complexidade de diffs e merge?
- [ ] **Cobertura das Correções Pendentes (Prioridade A):** A resolução imediata de GD01-043, GD01-001 (2ª cláusula) e GD01-066 (2ª cláusula) cobre integralmente o débito técnico pendente apontado no log?
- [ ] **Mapeamento de Requisitos GD01 (Prioridade C):** O encadeamento dos Lotes 2 a 5 garante o encerramento completo de todas as 130 cartas do set sem depender de escopos de ondas futuras?

Aguardando análise crítica do Auditor.

---

### 2. Resposta / Auditoria Crítica (Claude - Auditor)

[CONCORDANCIA: 42%]

# Auditoria Crítica — Resposta ao Propositor (Gemini)

## 1. Auditoria do commit `df7c851` — correta na superfície, rasa na profundidade

Verifiquei os pontos técnicos que o Gemini listou direto no código (não apenas na mensagem de commit) e a maior parte **procede**:

- `anyUnit`/`allUnits` estão de fato implementados em `effectSpec.ts` (linhas 65, 84, 514-565), com comentário citando GD01-014/058/110.
- `grantAttackTargetRelax.maxAp` está em `combat.ts:74` (`allowedByAp = granted?.maxAp !== undefined && effectiveAp(...) <= granted.maxAp`).
- `server/deckCoverageGate.ts` (95 linhas): li o arquivo inteiro. A lógica é sólida — `isCardPlayable` bloqueia código desconhecido (`KNOWN_CODES`) **antes** de checar texto bespoke, e só marca "jogável" se (a) não tem texto bespoke real (`hasBespokeText`), (b) tem `EffectSpec` cadastrado, ou (c) tem `staticAbilities/combatTriggers/attackTargetRules` estruturado. Testei mentalmente o caso que mais me preocupava — carta com cardCode real mas ainda "deferida" (sem EffectSpec e sem campos estruturados) — e o gate **bloqueia corretamente**. Esse ponto do Gemini está bem verificado.

Mas a "auditoria" do Gemini é descritiva, não crítica — ele confirma que os testes passam e para por aí. Três coisas que ele deveria ter levantado e não levantou:

1. **`gd01.manifest.json` já está dessincronizado consigo mesmo.** O `deferred_summary.next_engine_work_priority[batch 5]` ainda lista `GD01-043` no array `cards` (20 cartas, `cards_unlocked: 20`), mas a mesma seção do manifest, duas linhas abaixo (`bonus_unlock_available`), já diz que a primitiva pra 043 está pronta e ela deveria sair do lote 5. Isso é exatamente o mesmo padrão de drift que já mordeu o time duas vezes (golden master hardcoded, `specs-signatures.json` desatualizado) — só que dessa vez é auto-inconsistência dentro do próprio arquivo de rastreamento, e ninguém notou. É uma correção pendente de zero esforço que nem o usuário nem o Gemini listaram.
2. **A sugestão de "acoplar `gundam:index` a um pre-commit"** pressupõe infraestrutura que não existe — não há `.husky/`, não há `husky` no `package.json`, não há hook de pre-commit no repo hoje. Propor isso como se fosse trivial sem dizer "e isso exige instalar husky + configurar hook" é uma lacuna de execução, não só de detalhe.
3. Gemini não questiona **se o fuzz de 5000 partidas heurística-vs-random é suficiente cobertura pro que foi mudado** (anyUnit/allUnits/maxAp são mudanças de *targeting*, não de fluxo geral) — o ideal seria fuzz dirigido especificamente aos 4 decks que contêm as 6 cartas do Lote 1, não só o fuzz genérico multi-cor. Não é bloqueante, mas "auditar de verdade" pedia esse tipo de pergunta.

## 2. O plano de split de arquivo está **factualmente errado** — verifiquei carta a carta

Aqui é onde discordo com força. Extraí `code`/`color`/`cardType` de **todas as 130 entradas** de `GD01_CARD_DEFS` (linha 1009-2647 de `gd01.ts`). O resultado desmente a premissa central da proposta:

```
UNITS   (001-086, 86 cartas): blue 001-022 · green 023-043 · red 044-064 · white 065-086
PILOTS  (087-098, 12 cartas): blue 087-089 · green 090-092 · red 093-095 · white 096-098
COMMANDS(099-122, 24 cartas): blue 099-104 · green 105-110 · red 111-116 · white 117-122
BASES   (123-130,  8 cartas): blue 123-124 · green 125-126 · red 127-128 · white 129-130
```

Isso contradiz a proposta do Gemini em três pontos concretos:

- **Não existe "yellow"** no set. A quarta cor é `white`. O Gemini inventou uma cor que não aparece uma única vez nos 130 registros.
- **As cores não formam 4 blocos contíguos** de ~32 cartas cada (`001-034 blue`, `035-066 green`, `067-098 red`, `099-130 yellow` como ele escreveu). Na realidade a cor **reinicia o ciclo blue→green→red→white dentro de cada bloco de tipo de carta** (Units, depois Pilots, depois Commands, depois Bases). `blue` aparece em quatro faixas não-adjacentes: 001-022, 087-089, 099-104, 123-124.
- Se alguém tivesse implementado literalmente o diretório que o Gemini desenhou (`blue.ts` = "Cartas GD01-001 a GD01-034"), o arquivo teria pego 22 unidades azuis + 12 unidades verdes que não são azuis — um bug de dados introduzido pelo próprio refactor de organização.

### A estrutura real é por **tipo de carta**, com cor como sub-eixo dentro de Units

O split que bate com os dados é:

```
src/modules/simulator/content/gd01/
├── index.ts           # barrel: GD01_CARD_DEFS, GD01_EFFECT_SPECS
├── units-blue.ts       # GD01-001..022 (22 cartas)
├── units-green.ts      # GD01-023..043 (21 cartas)
├── units-red.ts        # GD01-044..064 (21 cartas)
├── units-white.ts      # GD01-065..086 (22 cartas)
├── pilots.ts            # GD01-087..098 (12 cartas — cabe inteiro num arquivo)
├── commands.ts           # GD01-099..122 (24 cartas)
├── bases.ts               # GD01-123..130 (8 cartas)
└── effects/               # EffectSpecs, ver abaixo — eixo de crescimento real
```

Isso bate com o consenso do debate anterior citado no prompt ("Units são ~70% do set e ainda ficariam gigantes se não subdivididas") — 86/130 = 66%, confirma que Units sozinho realmente precisa de 4 sub-arquivos por cor, exatamente como esse consenso previa. O Gemini citou esse consenso mas não voltou a checar os dados reais pra aplicá-lo corretamente.

### O Gemini também erra o alvo do problema: CardDefs não é o que está crescendo

Fiz uma segunda verificação importante: **`GD01_CARD_DEFS` já contém as 130 entradas hoje**, incluindo as 34 ainda deferidas (elas têm `CardDef` completo, só não têm `EffectSpec` associado). Isso significa que a seção de CardDefs (linhas 1009-2647, ~1638 linhas) está **essencialmente congelada em tamanho** — os Lotes 2-5 não vão adicionar novos registros ali, só vão (quando muito) corrigir campos pontuais como o bug do GD01-108. A prova: `CardDef` e `EffectSpec` são acoplados só por `cardCode` (string), não por referência de identificador JS — não há `effects: [GUNCANNON_WHEN_PAIRED]` dentro do CardDef.

Quem está de fato crescendo é a **seção de EffectSpecs bespoke** (linhas 1-917, ~900 linhas para as 68 specs já autoradas ⇒ ~13 linhas/spec). Autorar as 34 cartas restantes de motor mais complexo (StaticAbility condicional, N-alvos, gaps bespoke) provavelmente adiciona bem mais que 13 linhas/carta em média — é plausível bater nas ~5000 linhas totais que o Gemini projetou, mas **quase todo esse crescimento é na seção de EffectSpecs, não em CardDefs**. O plano do Gemini trata os dois blocos como um problema único ("mover CardDefs pra `blue.ts`/`green.ts`/etc.") quando na prática são dois problemas de tamanhos e urgências diferentes:

- **CardDefs**: baixo risco, baixa urgência, pode ser feito a qualquer momento (inclusive depois dos Lotes 2-5) sem custo adicional, porque não vai mudar de tamanho.
- **EffectSpecs**: é o eixo real de "arquivo carregado" e deveria ganhar sua própria estrutura escalável **antes** de autorar os Lotes 2-5 (ex.: um arquivo por lote — `effects/lote2-busca-topo.ts`, `effects/lote3-auras-condicionais.ts` etc. — que já nasce alinhado com o próprio plano de lotes do manifest, em vez de recortado por cor).

## 3. Sequenciamento — direção certa, execução precisa ser corrigida

Concordo com a ideia geral "resolver estrutura antes de autorar o resto" — evita reabrir os mesmos arquivos duas vezes. Mas a Fase 1 do Gemini, como desenhada, vai instruir mover CardDefs pra arquivos com fronteiras erradas (usando "yellow" e limites 034/066/098/130 que não existem), o que quebraria a compilação/os testes na primeira tentativa. Isso precisa ser substituído pelas fronteiras reais acima antes de qualquer execução.

Proposta de ordem corrigida:

**Fase 1 — Correções + estrutura (paralelizável entre si, sem dependência entre os dois grupos):**
- (A) Fechar GD01-043 (usa `maxAp` já pronto), GD01-001 e GD01-066 (2ª cláusula).
- (A) Corrigir a inconsistência do `gd01.manifest.json` (tirar GD01-043 do array `cards` do batch 5, `cards_unlocked: 20→19`) — achado desta auditoria, não estava na lista original.
- (B) Split de `gd01.ts` usando as fronteiras reais (`units-blue/green/red/white.ts`, `pilots.ts`, `commands.ts`, `bases.ts` para CardDefs; estrutura por lote para EffectSpecs). Baixo risco: só 4 consumidores externos do módulo (`gundam-coverage.mjs`, `deckCoverageGate.test.ts`, `gd01Deck.ts`, `gd01TestDecks.ts`), todos importam via nome exportado (`GD01_CARD_DEFS`/`GD01_EFFECT_SPECS`), então o barrel preserva compatibilidade.
- Rodar suíte + `tsc --noEmit` + `gundam:index` ao final.

**Fase 2 — Lotes 2 e 3 (dependem só da Fase 1 estar verde):**
Concordo com as estimativas de esforço do Gemini (baixo / médio) — são consistentes com o padrão observado no Lote 1 (6 cartas, extensões pontuais de primitivas, ~1 sessão). O cuidado citado sobre ciclo de vida do pareamento (Lote 3) é real e bem identificado.

**Fase 3 — Lotes 4 e 5:** ordem razoável, sem objeção adicional além do que já foi dito.

**Fase 4 — Validação final:** ok, mas adicionar explicitamente: revalidar que `gd01.manifest.json` fecha em 130/130 sem nenhum campo desatualizado (não só `deferred_summary` vazio — os campos `metrics.*` também precisam bater).

## Resumo da discordância

O X% baixo é por causa do item 2: é a proposta técnica central pra uma das três prioridades explícitas do usuário (B — robustez sem inchar arquivo), e ela foi escrita sem checar os dados reais do arquivo que está sendo reorganizado. Isso não é um detalhe cosmético — seguir o plano como escrito faria alguém (ou um agente) criar `yellow.ts` (arquivo vazio, cor inexistente) e popular `blue.ts` com cartas verdes por engano nos primeiros 11 registros após o limite errado (023-034). A auditoria do commit (item 1) e o sequenciamento (item 3) estão majoritariamente corretos na direção, só precisam de ajustes pontuais — não bloqueiam concordância alta por si só.

---

### 3. Réplica (Gemini - Propositor)

[CONCORDANCIA: 94%]

# Réplica e Consolidação do Plano — Propositor (Gemini)

Acatamento **integral** dos apontamentos trazidos na auditoria do Claude. A verificação factual extraída linha a linha do `GD01_CARD_DEFS` corrigiu falhas críticas na proposta inicial: a ausência da cor `yellow` (que é na verdade `white`), a estrutura interna do set organizada por **tipo de carta + ciclo de cores** (e não blocos contíguos de 34 cartas), e o fato crucial de que `GD01_CARD_DEFS` já contém as 130 cartas (estando congelado em tamanho), enquanto o inchaço real futuro virá da seção `GD01_EFFECT_SPECS`.

---

## 1. Auditoria e Ajustes sobre o Commit `df7c851` e Manifest Drift

1. **Inconsistência no `gd01.manifest.json` (Acatado):**
   - Confirmado. O `GD01-043` já teve sua primitiva (`grantAttackTargetRelax.maxAp`) liberada no commit `df7c851` e listada em `bonus_unlock_available`, mas permaneceu indevidamente no array `cards` do Lote 5 em `deferred_summary`.
   - **Ação imediata:** Atualizar `gd01.manifest.json` removendo `GD01-043` do Lote 5 (`cards_unlocked: 20 → 19`).

2. **Hook de Pre-commit / Automation (Acatado):**
   - Como não há `husky` configurado no repositório, não vamos introduzir dependências desnecessárias agora. A atualização do índice de assinaturas (`specs-signatures.json`) será integrada diretamente aos scripts de teste/build e verificada no checklist final de cada lote via `node scripts/gundam-index.mjs`.

3. **Fuzzing Dirigido (Acatado):**
   - O fuzzing genérico de 5000 partidas foi valioso, mas para validar com 100% de confiança as primitivas de targeting (`anyUnit`/`allUnits`/`maxAp`), o script de fuzzing será executado contra cenários que incluam os 4 decks específicos contendo GD01-014/024/027/058/108/110.

---

## 2. Desenho Consolidado de Organização de Arquivos — Prioridade (B)

Para atender a **Prioridade (B)** do usuário ("simulador ROBUSTO sem o código ficar carregado de arquivos"), adotaremos a estrutura exata apontada pelos dados reais do arquivo:

### Estrutura do Diretório `src/modules/simulator/content/gd01/`:

```text
src/modules/simulator/content/gd01/
├── index.ts               # Barrel re-exportando GD01_CARD_DEFS e GD01_EFFECT_SPECS (mantém compatibilidade total)
├── units-blue.ts          # GD01-001 a 022 (22 CardDefs)
├── units-green.ts         # GD01-023 a 043 (21 CardDefs)
├── units-red.ts           # GD01-044 a 064 (21 CardDefs)
├── units-white.ts         # GD01-065 a 086 (22 CardDefs)
├── pilots.ts              # GD01-087 a 098 (12 CardDefs)
├── commands.ts            # GD01-099 a 122 (24 CardDefs)
├── bases.ts               # GD01-123 a 130 (8 CardDefs)
└── effects/               # Módulos de EffectSpecs organizados por Lote/Tema
    ├── index.ts           # Consolida o mapa GD01_EFFECT_SPECS
    ├── lote1-primitives.ts# Specs já entregues (GD01-014, 024, 027, 058, 108, 110)
    ├── lote2-top-deck.ts  # GD01-048, 109
    ├── lote3-auras.ts     # GD01-019, 034, 054, 076, 081, 087, 089, 092, 096
    ├── lote4-n-targets.ts # GD01-044, 112, 114
    ├── lote5-bespoke.ts   # 19 cartas restantes bespoke
    └── initial-specs.ts   # Specs das cartas implementadas nas fases anteriores (1-68)
```

**Por que este modelo é robusto e não "carregado"?**
- O barrel `gd01/index.ts` garante que **nenhum consumidor externo** (`deckCoverageGate.ts`, `gundam-coverage.mjs`, suítes de teste) precise mudar suas importações.
- Mantém o número total de arquivos baixo (~10 a 12 arquivos), todos bem delimitados entre 100 e 400 linhas.
- Isola o crescimento em `effects/`, evitando mexer nos `CardDefs` estáticos durante o desenvolvimento das 34 cartas restantes.

---

## 3. Plano Sequenciado de Execução (Prioridades A, B e C)

### ETAPA 1: Limpeza Pendente (A) + Reorganização Estrutural (B)
* **1.1. Fechar Vitórias Rápidas Pendentes:**
  - Autorar EffectSpec do `GD01-043` (usando `grantAttackTargetRelax.maxAp` já testado no Lote 1).
  - Fechar 2ª cláusula de `GD01-001` e `GD01-066` (`implementada*` → `implementada`).
  - Corrigir drift do `gd01.manifest.json` (`cards_unlocked: 19` no Lote 5).
* **1.2. Refatoração de Arquivos:**
  - Migrar `gd01.ts` (2647 linhas) para o diretório `src/modules/simulator/content/gd01/` conforme estrutura aprovada.
  - Atualizar `specs-signatures.json` via `node scripts/gundam-index.mjs`.
  - **Validação da Etapa 1:** Executar `npm test`, `tsc --noEmit` e `server/deckCoverageGate.test.ts`.

---

### ETAPA 2: Implementação dos Gaps de Motor (C — Lotes 2 e 3)
* **2.1. Lote 2 — Busca no Topo do Deck com Filtro Composto (GD01-048, 109):**
  - Estender `lookAtTopFilterReveal` em `effectSpec.ts` para suporte a múltiplos traits.
  - Autorar specs em `effects/lote2-top-deck.ts`.
* **2.2. Lote 3 — StaticAbility Condicional & Auras de Piloto (9 cartas):**
  - Cartas: `GD01-019, 034, 054, 076, 081, 087, 089, 092, 096`.
  - Garantir desativação imediata da aura ao desparear/destruir o Piloto (validação no ciclo de vida de `pairedWith`).
  - Autorar specs em `effects/lote3-auras.ts`.
  - **Validação da Etapa 2:** Suíte de testes + 1000 partidas de fuzzing dirigido.

---

### ETAPA 3: Decisões Complexas e Gaps Bespoke (C — Lotes 4 e 5)
* **3.1. Lote 4 — Escolha de Até N Alvos (GD01-044, 112, 114):**
  - Expansão de `PendingDecision` e `ChoicePrimitive` para contagem variável de alvos (1 a N).
  - Autorar specs em `effects/lote4-n-targets.ts`.
* **3.2. Lote 5 — 19 Cartas Bespoke Restantes:**
  - Implementar tags específicas em `effects/lote5-bespoke.ts`.
  - **Validação da Etapa 3:** Suíte completa de 988+ testes e checagem do `deckCoverageGate`.

---

### ETAPA 4: Validação Final, Hardening e Merging
* **4.1. Fechamento de Métricas:**
  - Atualizar `gd01.manifest.json` (confirmar 130/130 cartas `implementada` ou `vanilla`, 0 `deferred`).
  - Atualizar `AI_GUIDE.md`.
* **4.2. Bateria Extensiva de Qualidade:**
  - Rodar `tsc --noEmit`.
  - Executar 5.000 partidas de fuzzing `heurística vs randomLegal` + 1.000 partidas `heurística vs heurística` multi-cor.
  - Rodar gate do servidor: `npx vitest run server/deckCoverageGate.test.ts`.
* **4.3. PR/Merge:**
  - PR da branch `feature/wave-gd01` para `dev`.

---

## 4. Checklist Acionável de Execução

- [ ] **[A/B] Etapa 1.1:** Autorar GD01-043, concluir GD01-001/066 e corrigir `gd01.manifest.json`.
- [ ] **[B] Etapa 1.2:** Executar o split de `gd01.ts` no novo diretório `src/modules/simulator/content/gd01/`.
- [ ] **[B] Etapa 1.3:** Regerar índice (`node scripts/gundam-index.mjs`) e garantir `tsc --noEmit` + 988+ testes verdes.
- [ ] **[C] Etapa 2.1:** Concluir Lote 2 (GD01-048, 109).
- [ ] **[C] Etapa 2.2:** Concluir Lote 3 (9 cartas de auras/condicionais) com validação de despareamento de Piloto.
- [ ] **[C] Etapa 3.1:** Concluir Lote 4 (GD01-044, 112, 114 — escolha de até N alvos).
- [ ] **[C] Etapa 3.2:** Concluir Lote 5 (19 cartas bespoke restantes).
- [ ] **[A/B/C] Etapa 4:** Fuzzing 5k partidas, validação total do `deckCoverageGate` (130/130 GD01 jogáveis), atualização da documentação e abertura do PR para `dev`.

</details>
