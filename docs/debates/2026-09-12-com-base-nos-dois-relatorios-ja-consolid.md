> **Nota de correção (12/09/2026):** o documento oficial abaixo (seção "[Documento MD ...]") foi revisado após a síntese do debate para eliminar referências a arquivos que não existem no repositório real, verificadas manualmente: `scripts/mcp-gundam/interaction-graph.mjs`/`interaction-graph.json` (não existem — o indexador real é `scripts/gundam-index.mjs`, que gera `src/modules/simulator/content/_index/specs-signatures.json`, docs/44 §6.1) e o aninhamento `content/<WAVE>/<WAVE>.manifest.json` (o conteúdo real é flat — `content/st01.ts`...`st04.ts`, sem subpastas por coleção; `content/gd01.ts` ainda nem existe). A transcrição bruta dos turnos, no `<details>` no fim do arquivo, foi mantida intacta como registro histórico do debate — os erros ali são o que motivou a correção. `content/deferred.ts` já existe hoje com o schema `DeferredClause { cardCode, clause, reason, blockedBy }` (docs/44 §6.2) — os gatilhos abaixo foram ajustados para citar esse schema real em vez de descrevê-lo genericamente. Vale registrar também que o projeto já tem um runbook de orquestração multi-agente em produção (docs/47 §10: worktrees + subagentes do Claude Code, não uma troca de prompts colados manualmente entre Gemini/Claude) — os gatilhos abaixo continuam úteis como *conteúdo* do prompt de cada fase, mas o disparo real deveria rodar dentro desse runbook, não como CLI/handoff paralelo.

# Debate Técnico: Com base nos dois relatorios ja consolidados em docs/debates/2026-09-12-como-planejar-e-executar-a-wave-de-imple.md (arquitetura da wave GD01 no motor) e docs/debates/2026-09-12-com-base-no-relatorio-docs-debates-2026-.md (protocolo multi-wave, orquestracao multi-agente, RAG estatico e governanca de recursos), debater e decidir a EXECUCAO pratica dessas duas demandas ja debatidas: (1) Como dividir a responsabilidade de execucao entre Gemini e Claude - quem fica encarregado de qual parte do trabalho (ex: Fase 0 bootstrap, agentes worker de conteudo de cartas, agente indexador RAG, suite de validacao Golden Master/fuzzing, documentacao); (2) Qual seria o prompt gatilho exato para acionar Gemini, Claude, ou ambos, para executar essas demandas em modelo sequencial (um depois do outro) ou paralelo (simultaneo/orquestrado), incluindo pontos de sincronizacao e handoff entre os dois; (3) Qual a melhor abordagem geral para resolver e executar concretamente os dois debates anteriores dentro do repositorio portal-gundam-tcg-br, gerando ao final um PADRAO REPETIVEL (checklist/template/prompt) que possa ser reutilizado para toda nova wave de colecao (GD02, GD03, etc) e para o treinamento continuo do motor e do bot LLM

- **Data:** 12/09/2026, 14:00:25
- **Iniciador:** GEMINI
- **Propositor:** Gemini
- **Auditor Crítico:** Claude
- **Status:** Consenso Antecipado (>= 85%)
- **Índice de Concordância:** 95%
- **Turnos Executados:** 3 de 4

---

### Resumo de Raciocínio (High-Level Summary)

O debate entre Gemini (Propositor) e Claude (Auditor) atingiu **95% de consenso** após a Réplica. A proposta inicial do Gemini foi corrigida pelo Claude ao constatar o uso de caminhos e infraestruturas fictícias (`src/engine/`, RAG vetorial sintético), os quais violavam consensos arquiteturais anteriores. Na réplica, o Gemini acatou integralmente as correções, re-ancorando o pipeline, os prompts gatilho e o protocolo de handoff exclusivamente sobre a estrutura real do repositório `portal-gundam-tcg-br` (`src/modules/simulator/engine/`, `scripts/mcp-gundam/`, `hashes.json`, etc.).

---

[Pontos de Acordo]
1. **Divisão de Responsabilidades por Especialidade:**
   - **Gemini (Amplitude e Ingestão):** Ingestão de cartas brutas, mapeamento inicial para a AST/DSL existente, alocação de casos ambíguos em `content/deferred.ts`, e indexação RAG lexical estática (n-gramas, sem embeddings/Q&A sintético).
   - **Claude (Lógica Estrita e QA):** Resolução de mecânicas complexas/diferidas, extensão declarativa de primitivas (`effectSpec.ts` + `primitives-claims.json`), manutenção da imutabilidade no motor core e execução da suíte de integridade/fuzzing.
2. **Reutilização da Estrutura Real do Repositório (Zero Árvores Paralelas):**
   - Abandono de diretórios fictícios (`src/engine/`, `.engine/waves/`). Adição estrita nos caminhos oficiais em produção: `src/modules/simulator/content/` e `src/modules/simulator/engine/`.
3. **Orquestração Paralela em Fork (Fase 3A e 3B):**
   - Após a consolidação do código TypeScript da Wave pela Fase 2 (Claude), a Fase 3A (Indexação RAG Lexical pelo Gemini) e a Fase 3B (Golden Master & Fuzzing pelo Claude) podem rodar concorrentemente, pois ambas dependem apenas da entrega estável do catálogo.
4. **Governança Estrita contra Drift Semântico:**
   - Uso obrigatório de `primitives-claims.json` (append-only) para evitar que agentes criem primitivas duplicadas ou conflitantes.
   - Proibição de geração de Q&A sintético no RAG (busca lexical puramente determinística).

---

[Divergências e Riscos]
1. **Risco de Falsos Positivos em Invariantes de Fuzzing (Resolvido):**
   - *Risco:* Um invariante ingênuo de "soma constante de cartas" falha ao lidar com mecânicas de invocação de tokens (`spawnToken`).
   - *Mitigação:* O invariante de rastreabilidade (Invariante B) foi ajustado para validar que cada entidade/token pertença a exatamente uma zona válida sem romper o estado do jogo.
2. **Risco de Bypass de Gates de CI durante Execução de LLMs (Mitigado):**
   - *Risco:* Confiar apenas na verificação do `tsc --noEmit` para considerar uma Fase concluída.
   - *Mitigação:* Exigência estrita da execução bem-sucedida dos scripts reais (`pnpm gundam:golden`, `pnpm gundam:fuzz`, `pnpm catalog:coverage:gate`) como critério absoluto de aceite do handoff da Fase 2 e 3B.

---

[Proposta de Planejamento/Ajuste]
O planejamento de execução das waves de coleção (GD01, GD02, GD03...) segue o pipeline linear-paralelo ancorado no **Wave Execution Protocol (WEP)**:
1. **Fase 0 & 1 (Sequencial - Gemini):** Bootstrap da wave, extração em massa e geração do rascunho TypeScript (`src/modules/simulator/content/<WAVE>.ts`), enviando ambiguidades para `deferred.ts`.
2. **Fase 2 (Sequencial - Claude):** Resolução de `deferred.ts`, adição de novas primitivas registradas em `primitives-claims.json` e validação preliminar do código TS.
3. **Fase 3 (Fork Paralelo):**
   - **Fase 3A (Gemini):** Indexação RAG lexical rodando `pnpm gundam:index`.
   - **Fase 3B (Claude):** Suíte Golden Master e Fuzzing rodando `pnpm gundam:golden` (com append em `hashes.json`), `pnpm gundam:fuzz` e `pnpm catalog:coverage:gate`.
4. **Fase 4 (Promover & Commit):** Encerramento da wave com 100% de testes verdes e PR pronto para merge.

---

[Documento MD com todo o informativo, checklist caso precise e prompts de automação, orquestração e/ou uso de skills, caso necessário]

```markdown
# MANUAL OFICIAL DE EXECUÇÃO MULTI-WAVE (GEMINI ↔ CLAUDE)
**Repositório Alvo:** `portal-gundam-tcg-br`  
**Protocolo:** Wave Execution Protocol (WEP)  
**Status:** Consolidado via Debate Técnico (95% de Concordância)

---

## 1. MAPA DE INTEGRIDADE DE ARTEFATOS

Para evitar a duplicação do motor de jogo, todos os agentes DEVEM operar exclusivamente nos seguintes arquivos reais do repositório:

- **Especificação de Primitivas de Efeitos:** `src/modules/simulator/engine/effectSpec.ts`
- **Conteúdo das Coleções:** `src/modules/simulator/content/{st01..st04,gd01..gd0N}.ts`
- **Manifesto & Diferidos:** `src/modules/simulator/content/<WAVE>.manifest.json` (novo, flat — segue o padrão real de `content/st01.ts`...`st04.ts`, sem subpasta por coleção; ainda não existe, é criado no Passo 1) e `src/modules/simulator/content/deferred.ts` (já existe — schema real `DeferredClause { cardCode, clause, reason, blockedBy }`, docs/44 §6.2)
- **Governança de Vocabulário:** `src/modules/simulator/content/primitives-claims.json` (novo — ainda não existe)
- **Golden Master Test Harness & Hashes:** `src/modules/simulator/engine/__golden__/harness.ts` e `hashes.json` (ambos já existem e em produção)
- **Indexação RAG Lexical:** `scripts/mcp-gundam/similar-specs.mjs` (consumido pela tool MCP `gundam_similar_specs`) + o indexador real `scripts/gundam-index.mjs`, que gera `src/modules/simulator/content/_index/specs-signatures.json` (docs/44 §6.1). Não existe `interaction-graph.mjs`/`interaction-graph.json` — não crie esses arquivos.

---

## 2. CHECKLIST REPETÍVEL DE EXECUÇÃO DA WAVE

Use este checklist para orquestrar e validar a execução de cada nova wave (GD01, GD02, etc.):

- [ ] **Passo 1: Instanciação do Manifesto**
  - Criar `src/modules/simulator/content/<WAVE>.manifest.json` (flat, mesmo diretório de `st01.ts`...`st04.ts`) com status `"INITIALIZED"`.
  - Garantir que `primitives-claims.json` e `hashes.json` estejam sincronizados com a branch `main`.

- [ ] **Passo 2: Ingestão e Draft Base (Gemini - Gatilho 01)**
  - Executar o **Prompt Gatilho 01** no Gemini.
  - Verificar a geração de `src/modules/simulator/content/<WAVE>.ts`.
  - Confirmar que cartas ambíguas foram movidas para `content/deferred.ts`.
  - Validar compilação: `pnpm tsc --noEmit`.

- [ ] **Passo 3: Refinamento Mecânico e Core (Claude - Gatilho 02)**
  - Executar o **Prompt Gatilho 02** no Claude.
  - Resolver pendências em `content/deferred.ts`.
  - Caso haja novas primitivas, registrar em `primitives-claims.json` e declarar em `effectSpec.ts`.
  - Validar compilação: `pnpm tsc --noEmit`.

- [ ] **Passo 4: Execução Paralela (Fase 3A e Fase 3B)**
  - **Fase 3A (Gemini - Gatilho 03):** Rodar o indexador RAG estático: `pnpm gundam:index`.
  - **Fase 3B (Claude - Gatilho 04):**
    - Executar `pnpm gundam:fuzz` (validação de invariantes de estado e tokens).
    - Executar `pnpm gundam:golden` (anexar hashes gerados em `hashes.json`).
    - Executar `pnpm catalog:coverage:gate`.

- [ ] **Passo 5: Conclusão & Merge**
  - Atualizar `<WAVE>.manifest.json` para `"COMPLETED"`.
  - Realizar commit e abrir Pull Request.

---

## 3. PROMPTS GATILHO OFICIAIS PARA AUTOMAÇÃO / LLM AGENTS

### 🟢 PROMPT GATILHO 01 (Gemini — Ingestão e Draft da Wave)

```text
[AGENTE: GEMINI] [MODO: SEQUENCIAL - FASE 0 E 1]
OBJETIVO: Iniciar a ingestão da wave {{WAVE_ID}} no repositório portal-gundam-tcg-br.

CONTEXTO E ARTEFATOS REAIS:
- Spec de primitivas atual: `src/modules/simulator/engine/effectSpec.ts`
- Arquivo alvo da wave: `src/modules/simulator/content/{{WAVE_ID}}.ts` (flat — ainda não existe pra GD01, criar seguindo o padrão de `st01.ts`)
- Manifest de governança: `src/modules/simulator/content/{{WAVE_ID}}.manifest.json` (flat, novo arquivo)
- Arquivo de desvio: `src/modules/simulator/content/deferred.ts` (já existe — usar o schema real `DeferredClause { cardCode, clause, reason, blockedBy }`)

INSTRUÇÕES:
1. Analise o catálogo bruto da coleção {{WAVE_ID}} fornecido.
2. Mapeie cada carta para as estruturas de `PrimitiveCall` existentes em `effectSpec.ts`.
3. Para qualquer efeito que NÃO possua primitiva correspondente direta ou cuja regra seja ambígua, NÃO INVENTE primitivas. Adicione uma entrada em `content/deferred.ts` no formato `DeferredClause` (com `cardCode`, o trecho `clause` literal do texto EN oficial, `reason` e `blockedBy`) e registre a pendência em `{{WAVE_ID}}.manifest.json`.
4. Gere o código TypeScript em `src/modules/simulator/content/{{WAVE_ID}}.ts` seguindo o padrão de ST01-ST04.

CRITÉRIO DE ACEITE:
- O arquivo `src/modules/simulator/content/{{WAVE_ID}}.ts` deve compilar sob `pnpm tsc --noEmit`.
- Nenhuma modificação pode ser feita em `src/modules/simulator/engine/`.
- Atualização do arquivo `{{WAVE_ID}}.manifest.json` contendo a lista de cartas prontas e cartas desviadas.
```

---

### 🔵 PROMPT GATILHO 02 (Claude — Refinamento Mecânico e Core)

```text
[AGENTE: CLAUDE] [MODO: SEQUENCIAL - FASE 2]
OBJETIVO: Resolver cartas complexas em `content/deferred.ts` e garantir a integridade do motor para a wave {{WAVE_ID}}.

CONTEXTO E ARTEFATOS REAIS:
- Manifest da wave: `src/modules/simulator/content/{{WAVE_ID}}.manifest.json` (flat)
- Fila de diferidos: `src/modules/simulator/content/deferred.ts` (schema real `DeferredClause { cardCode, clause, reason, blockedBy }`, docs/44 §6.2)
- Registro de primitivas: `primitives-claims.json`
- Motor core: `src/modules/simulator/engine/` (`abilityDispatch.ts`, `predicates.ts`, `deploy.ts`, etc.)

INSTRUÇÕES:
1. Leia as cartas pendentes registradas no manifest da {{WAVE_ID}}.
2. Se a mecânica exigir uma nova primitiva de efeito:
   a. Declare o tipo estritamente em `effectSpec.ts`.
   b. Registre a autorização de uso no arquivo append-only `primitives-claims.json`.
   c. Implemente a lógica nos módulos correspondentes de `src/modules/simulator/engine/`.
3. Mova as cartas resolvidas de `deferred.ts` para `src/modules/simulator/content/{{WAVE_ID}}.ts`.
4. Execute a verificação de compilação rodando `pnpm tsc --noEmit`.

CRITÉRIO DE ACEITE:
- `deferred.ts` limpo ou atualizado apenas com pendências justificadas para revisão humana.
- `primitives-claims.json` atualizado sem duplicação de primitivas existentes.
- Projeto compilando estaticamente sem erros.
```

---

### 🟢 PROMPT GATILHO 03 (Gemini — Indexação RAG Lexical)

```text
[AGENTE: GEMINI] [MODO: PARALELO - FASE 3A]
OBJETIVO: Atualizar o índice RAG lexical de autoria com as novas EffectSpec da wave {{WAVE_ID}}.

CONTEXTO E ARTEFATOS REAIS:
- Conteúdo consolidado: `src/modules/simulator/content/{{WAVE_ID}}.ts`
- Indexador real: `scripts/gundam-index.mjs` (docs/44 §6.1) — extrai, de cada `EffectSpec` em `content/*.ts`, a assinatura (sequência de `op` dos `PrimitiveCall` + `trigger` + `targetScope` + `condition.predicate` + `targetFilter`) e o `sourceText`
- Saída real: `src/modules/simulator/content/_index/specs-signatures.json` (versionado, sem diff espúrio ao regenerar)
- Consumido em runtime por: `scripts/mcp-gundam/similar-specs.mjs` (tool MCP `gundam_similar_specs` — rankeia specs por overlap de n-gramas de mecânica + trigramas literais)

INSTRUÇÕES DE EXECUÇÃO:
1. Rode `pnpm gundam:index` para regenerar `specs-signatures.json` com as EffectSpec da {{WAVE_ID}} incluídas.
2. Se `similar-specs.mjs` precisar de novos n-gramas de mecânica (`MECHANIC_NGRAMS`) para reconhecer padrões inéditos da {{WAVE_ID}}, adicione-os à lista existente — não crie um script/índice paralelo.
3. REGRA ESTRITA: não existe "grafo de interações" nem arquivo de FAQ no projeto. Não crie `interaction-graph.mjs`, não sintetize perguntas/respostas hipotéticas, não use embeddings vetoriais. O índice é puramente lexical/determinístico sobre o que já está declarado e validado no motor.

CRITÉRIO DE ACEITE:
- `pnpm gundam:index` executado com sucesso, sem erros de parsing.
- Diff de `specs-signatures.json` contém apenas as entradas novas da {{WAVE_ID}} (append, sem alterar assinaturas de ST01–ST04/GD anteriores).
```

---

### 🔵 PROMPT GATILHO 04 (Claude — QA, Fuzzing e Golden Master)

```text
[AGENTE: CLAUDE] [MODO: PARALELO - FASE 3B]
OBJETIVO: Validar os invariantes do jogo, executar fuzzing e congelar snapshots da wave {{WAVE_ID}}.

CONTEXTO E ARTEFATOS REAIS:
- Harness Golden Master: `src/modules/simulator/engine/__golden__/harness.ts`
- Repositório de Hashes: `src/modules/simulator/engine/__golden__/hashes.json`
- Comandos de Validação: `pnpm gundam:golden`, `pnpm gundam:fuzz`, `pnpm catalog:coverage:gate`

INSTRUÇÕES DE EXECUÇÃO:
1. Execute `pnpm gundam:fuzz` simulando partidas aleatórias incluindo cartas da {{WAVE_ID}}.
2. Valide os invariantes de runtime:
   - Invariante A: Nenhuma transição de estado resulta em `undefined` ou quebra de tipo.
   - Invariante B (Conservação e Invocação): Toda carta ou token gerado por `spawnToken` deve pertencer a exatamente uma zona válida sem quebrar o rastreamento do estado.
   - Invariante C: Efeitos durativos expirarem corretamente na fase/turno especificado em `Duration`.
3. Execute `pnpm gundam:golden`. Se todos os testes passarem, anexe os novos hashes de execução da {{WAVE_ID}} em `hashes.json` (modo append-only).
4. Execute `pnpm catalog:coverage:gate` para verificar a cobertura final do catálogo.

CRITÉRIO DE ACEITE:
- Sucesso 100% nos três comandos: `pnpm gundam:golden`, `pnpm gundam:fuzz` e `pnpm catalog:coverage:gate`.
- Registro do diff append-only em `hashes.json`.
```
```

---

<details>
<summary><b>Clique para ver a transcrição bruta dos turnos</b></summary>

### 1. Proposta Inicial (Gemini - Propositor)

# PROPOSTA TÉCNICA E ARQUITETURAL

**Assunto:** Pipeline Multi-Agente, Divisão de Papéis (Gemini/Claude), Prompts Gatilho e Protocolo de Execução Repetível para Waves de Cartas (GD01+) no `portal-gundam-tcg-br`.  
**Autor:** Gemini (Atuando como Propositor Técnico)  
**Destinatário:** Auditoria Crítica (Claude) / Time de Arquitetura de Software  

---

## 1. VISÃO GERAL E FILOSOFIA ARQUITETURAL

A implementação da Wave GD01 e das ondas subsequentes (GD02, GD03...) no motor de jogo e no sistema RAG do `portal-gundam-tcg-br` exige um equilíbrio rigoroso entre **escala e velocidade de processamento** (onde a janela de contexto massiva e o throughput do Gemini se destacam) e **precisão lógica de estado, inferência de tipos e testes de invariantes** (onde o raciocínio determinístico do Claude se destaca).

A presente proposta estabelece uma arquitetura baseada em **Grafo Acíclico Dirigido (DAG) Híbrido** com **Pontos de Checagem Imutáveis (Handoff Artifacts)**. Em vez de uma simples passagem informal de texto entre LLMs, cada transição de fase gera um artefato JSON/TypeScript validado contra JSON Schemas estritos no repositório.

```
 [Fase 0: Raw Data / OCR / Scan]
                │
                ▼
  [Fase 1: Bootstrap & Extraction] ── (GEMINI) ──► Artefato: `raw_manifest.json`
                │
                ▼
  [Fase 2: AST Refactoring & DSL] ── (CLAUDE) ──► Código TS + `validated_cards.json`
                │
                ├────────────────────────┐
                ▼                        ▼
  [Fase 3A: RAG Static Build]  [Fase 3B: Golden Master & Fuzzing]
           (GEMINI)                      (CLAUDE)
                │                        │
                └────────────────────────┤
                                         ▼
                       [Fase 4: Audit & Release Commit]
                                 (AMBOS)
```

---

## 2. DIVISÃO DETALHADA DE RESPONSABILIDADES (GEMINI vs. CLAUDE)

| Fase da Wave | Tarefa Concreta | Responsável Principal | Justificativa Técnica & Trade-offs | Artefato Entregável |
| :--- | :--- | :--- | :--- | :--- |
| **Fase 0: Scaffolding & Manifest Base** | Ingestão de dados brutos (scans, JSONs brutos da Bandai, textos em EN/JP) e estruturação do manifesto da Wave. | **Gemini** | Janela de contexto massiva para processar múltiplos inputs brutos simultaneamente. *Trade-off:* Pode gerar ruído em campos ambíguos, exigindo tipagem estrita na saída. | `.engine/waves/<WAVE_ID>/raw_manifest.json` |
| **Fase 1: Tradução em Massa para DSL de Efeitos** | Mapeamento do texto das cartas para a sintaxe da DSL/AST do motor para 80% das cartas (casos padrão: custo, stats, triggers simples). | **Gemini** | Alta velocidade e baixo custo para tarefas de transformação estruturada repetitiva em larga escala. | `src/engine/cards/<WAVE_ID>/draft_effects.ts` |
| **Fase 2: Refatoração Lógica Complexa e Tipagem Strict** | Compilação e refatoração dos efeitos complexos (interrupções, substituição de eventos, reações em cadeia, modulação de estado) e correção da AST em TypeScript. | **Claude** | Raciocínio superior em sistemas de tipos TypeScript complexos, prevenção de mutações colaterais inválidas no estado do jogo (`GameState`). | `src/engine/cards/<WAVE_ID>/index.ts` (Código TS Final compilável) |
| **Fase 3A: RAG Indexer & Vector Metadata Synthesizer** | Geração de visões canônicas, chunks de busca semântica, sinônimos, aliases de cartas e pré-indexação RAG estática. | **Gemini** | Capacidade de sintetizar combinações de buscas, queries sintéticas e gerar expansão semântica massiva sem esgotar a taxa de limites/tokens. | `src/rag/knowledge/<WAVE_ID>/rag_chunks.json` |
| **Fase 3B: Suite de Validação (Golden Master & Fuzzing)** | Criação da suíte de teste de regressão (Golden Master) e geradores de propriedades para Fuzzing do motor com a nova Wave. | **Claude** | Precisão matemática para definir invariantes de jogo, testes determinísticos de cenários limítrofes (edge-cases) e geradores de carga válidos. | `tests/engine/golden_master/<WAVE_ID>/*.test.ts` e `fuzzers/` |
| **Fase 4: Governança, Documentação & release Check** | Atualização do manual de regras, changelog, validação de schema final e auditoria de recursos. | **Ambos** (Sincronizado) | Gemini gera a documentação estruturada extensa; Claude audita a conformidade final contra os PRD/Debates. | `docs/waves/<WAVE_ID>-spec.md` & `RELEASE.lock` |

---

## 3. PROTOCOLO DE HANDOFF E SCHEMA DE ARTEFATOS

Nenhum agente passará contexto "livre" para o outro. Toda a comunicação ocorre via gravação e leitura de arquivos no sistema de arquivos do repositório `.engine/waves/<WAVE_ID>/handoffs/`.

### Schema do Artefato de Handoff (`handoff.schema.json`)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["wave_id", "phase", "produced_by", "timestamp", "status", "payload"],
  "properties": {
    "wave_id": { "type": "string", "example": "GD01" },
    "phase": { "type": "string", "enum": ["BOOTSTRAP", "DSL_DRAFT", "DSL_FINAL", "RAG_BUILD", "VALIDATION_PASSED"] },
    "produced_by": { "type": "string", "enum": ["gemini-1.5-pro", "claude-3-5-sonnet"] },
    "timestamp": { "type": "string", "format": "date-time" },
    "status": { "type": "string", "enum": ["SUCCESS", "REQUIRES_HUMAN_REVIEW", "COMPLEXITY_FLAGGED"] },
    "payload": {
      "type": "object",
      "properties": {
        "processed_cards": { "type": "integer" },
        "flagged_cards": { 
          "type": "array", 
          "items": { 
            "type": "object",
            "properties": {
              "card_id": { "type": "string" },
              "reason": { "type": "string" }
            }
          }
        },
        "artifacts_generated": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["processed_cards", "flagged_cards", "artifacts_generated"]
    }
  }
}
```

---

## 4. PROMPTS GATILHO EXECUTAIS (PROMPT TRIGGERS)

Abaixo estão os prompts gatilho exatos, parametrizados para execução automatizada via CLI ou via instrução direta às LLMs.

### Trigger 01: Gemini — Bootstrap & Ingestão da Wave (Fase 0 + Fase 1)
> **Modelo:** `Gemini 1.5 Pro`  
> **Modo:** Paralelo por Batches (ex: batch de 20 cartas)

```text
SYSTEM: Você é o agente Engenheiro de Ingestão de Dados do motor 'portal-gundam-tcg-br'. Sua tarefa é ler as cartas brutas da wave {{WAVE_ID}} localizadas em '.engine/waves/{{WAVE_ID}}/raw/' e gerar o manifesto tipado e o rascunho dos efeitos em DSL TypeScript.

CONTEXTO DE EXECUÇÃO:
- Repositório: portal-gundam-tcg-br
- Schema da AST de Cartas: src/engine/types/card.ts
- Arquivo de saída esperado: .engine/waves/{{WAVE_ID}}/handoffs/phase1_gemini_draft.json e src/engine/cards/{{WAVE_ID}}/draft_effects.ts

REGRAS ESTREITAS:
1. Extraia: id, name, type (Unit/Pilot/Base/Command), color, cost, power, hit, zone, e text.
2. Traduza os efeitos de texto simples para a AST DSL predefinida (ex: Use Action.DrawCard(1) para "Draw 1 card").
3. Se um efeito contiver interrupção, timing nulo, ou condição de substituição complexa que a DSL atual não suporte expressar diretamente, ADICIONE o ID da carta na lista 'flagged_cards' com o motivo 'COMPLEX_LOGIC'.
4. Não tente adivinhar APIs inexistentes no motor.

SAÍDA OBRIGATÓRIA:
Gere os arquivos no disco e forneça o JSON de Handoff estritamente de acordo com o schema 'handoff.schema.json'.
```

---

### Trigger 02: Claude — Refatoração Lógica & DSL Validator (Fase 2)
> **Modelo:** `Claude 3.5 Sonnet`  
> **Modo:** Sequencial (Soma o resultado do Trigger 01)

```text
SYSTEM: Você é o Arquiteto do Motor de Jogo TS do 'portal-gundam-tcg-br'. Sua tarefa é processar o handoff da Fase 1 gerado pelo Gemini em '.engine/waves/{{WAVE_ID}}/handoffs/phase1_gemini_draft.json', resolver as cartas marcadas como 'COMPLEX_LOGIC' e compilar o código TypeScript definitivo da Wave.

INPUTS DE LEITURA:
- Arquivo de Entrada: src/engine/cards/{{WAVE_ID}}/draft_effects.ts
- Lista de Flags: .engine/waves/{{WAVE_ID}}/handoffs/phase1_gemini_draft.json
- Motor de Tipos & GameState: src/engine/core/GameState.ts e src/engine/core/RulesEngine.ts

TAREFAS:
1. Revise 'draft_effects.ts'. Converta as cartas com flag 'COMPLEX_LOGIC' em implementações puras e determinísticas utilizando o pattern State Modifier / Event Listener do motor.
2. Assegure zero mutações diretas fora do draft de estado (Immutability pattern).
3. Execute a compilação do TypeScript estaticamente (tsc --noEmit) no contexto dos arquivos gerados.
4. Escreva o arquivo de produção final: 'src/engine/cards/{{WAVE_ID}}/index.ts'.

SAÍDA OBRIGATÓRIA:
Gere a suíte de validação do TS e salve o handoff da Fase 2 em '.engine/waves/{{WAVE_ID}}/handoffs/phase2_claude_final.json'.
```

---

### Trigger 03: Gemini — Gerador de Conhecimento RAG Estático (Fase 3A)
> **Modelo:** `Gemini 1.5 Pro`  
> **Modo:** Paralelo (Pode rodar simultaneamente com a Fase 3B após a conclusão da Fase 2)

```text
SYSTEM: Você é o Indexador do Bot de Conhecimento RAG do 'portal-gundam-tcg-br'. Sua função é construir a base estática de conhecimento para a Wave {{WAVE_ID}} para prover respostas exatas aos jogadores sobre regras, FAQs e interações.

INPUTS:
- Cartas Validadas: src/engine/cards/{{WAVE_ID}}/index.ts
- Regras Globais: docs/rules/comprehensive_rules.md

TAREFAS:
1. Para cada carta em {{WAVE_ID}}, crie chunks JSON com:
   - Visão Canônica de Regras (Texto oficial normalizado).
   - FAQ de Interações Sintéticas (Gere 5 perguntas/respostas prováveis de jogadores sobre timming e interações desta carta com cartas do Meta atual).
   - Tags de Busca Semântica (aliases, nomes populares, termos-chave).
2. Otimize os chunks para busca por vetor de alta densidade e busca lexical por palavra-chave (BM25 hybrid).

SAÍDA OBRIGATÓRIA:
Escreva o arquivo em 'src/rag/knowledge/{{WAVE_ID}}/rag_chunks.json' e informe o handoff correspondente.
```

---

### Trigger 04: Claude — Fuzzer & Golden Master Test Suite (Fase 3B)
> **Modelo:** `Claude 3.5 Sonnet`  
> **Modo:** Paralelo (Executa simultaneamente com Fase 3A após a Fase 2)

```text
SYSTEM: Você é o Engenheiro de QA e Confiabilidade do Motor Gundam TCG. Sua missão é garantir zero quebras de regressão ao incorporar a Wave {{WAVE_ID}}.

INPUTS:
- Cartas Implementadas: src/engine/cards/{{WAVE_ID}}/index.ts
- Motor de Testes Golden Master: tests/engine/golden_master/runner.ts

TAREFAS:
1. Crie uma suíte de testes de Golden Master para cada carta da Wave {{WAVE_ID}} em 'tests/engine/golden_master/{{WAVE_ID}}/'.
2. Escreva um script de Property-Based Fuzzing utilizando 'fast-check' para instanciar estados aleatórios de jogo e jogar as cartas da Wave {{WAVE_ID}}, validando os seguintes INVARIANTES:
   - Invariante 1: A soma de pontos de dano e vida nunca pode ser NaN ou Negativa descontrolada.
   - Invariante 2: O total de cartas na zona de Deck + Mão + Traste + Banished + Campo deve permanecer constante (sem vazamento de memória/cartas).
   - Invariante 3: Mutações de turno devolvem o controle estritamente ao jogador ativo ou de reação.
3. Se o fuzzer encontrar uma violação, gere a reprodução mínima (minimal reproduction case) em arquivo de teste unitário.

SAÍDA OBRIGATÓRIA:
Código de testes em 'tests/engine/golden_master/{{WAVE_ID}}/wave_{{WAVE_ID}}.spec.ts' e relatório de integridade do Fuzzer.
```

---

## 5. ARRANJO NO REPOSITÓRIO (`portal-gundam-tcg-br`)

A estrutura do projeto deve ser estendida para suportar o pipeline orquestrado sem poluir o código-fonte principal até a conclusão dos testes:

```text
portal-gundam-tcg-br/
├── .engine/
│   └── waves/
│       ├── templates/                  # Templates de manifesto e schemas
│       │   ├── wave_manifest.template.json
│       │   └── handoff.schema.json
│       └── GD01/                       # Diretório isolado por Wave
│           ├── raw/                    # Inputs brutos (scans, text/json sem tratamento)
│           ├── handoffs/               # Artefatos imutáveis de transição entre LLMs
│           │   ├── phase1_gemini_draft.json
│           │   ├── phase2_claude_final.json
│           │   └── phase3_rag_and_tests.json
│           └── wave_manifest.json      # Metadados e progresso da wave
├── src/
│   ├── engine/
│   │   ├── cards/
│   │   │   ├── base/                  # Regras de cartas universais
│   │   │   └── GD01/                  # Código TypeScript da Wave compilada
│   │   │       ├── index.ts
│   │   │       └── draft_effects.ts   # Limpo pós-aprovação
│   │   └── core/                      # Kernel do motor de jogo
│   └── rag/
│       └── knowledge/
│           └── GD01/                  # Chunks estáticos indexáveis pelo RAG
│               └── rag_chunks.json
├── tests/
│   └── engine/
│       └── golden_master/
│           └── GD01/                  # Testes determinísticos gerados pelo Claude
│               └── GD01_effects.test.ts
└── scripts/
    └── wave-orchestrator/             # Scripts CLI de orquestração do pipeline
        ├── validate-handoff.ts
        ├── run-wave-pipeline.sh
        └── wave-checker.ts
```

---

## 6. O PADRÃO REPETÍVEL: WAVE EXECUTION PROTOCOL (WEP)

Para que esse modelo seja 100% reutilizável nas próximas waves (GD02, GD03...), fica estabelecido o **Wave Execution Protocol (WEP)**, composto por 3 pilares: Checklist, Template de Manifesto e Script de CI.

### 6.1 Checklist de Execução da Wave

- [ ] **Passo 1: Instanciação:** Executar `npm run wave:init -- --id=<WAVE_ID>` para criar a estrutura no diretório `.engine/waves/<WAVE_ID>/`.
- [ ] **Passo 2: Ingestão Bruta:** Copiar dados brutos para `.engine/waves/<WAVE_ID>/raw/`.
- [ ] **Passo 3: Disparo Trigger 01 (Gemini):** Rodar extração em massa e DSL draft.
- [ ] **Passo 4: Validação de Handoff 1:** Executar `npx ts-node scripts/wave-orchestrator/validate-handoff.ts --phase=1`.
- [ ] **Passo 5: Disparo Trigger 02 (Claude):** Processar flags complexas e refatorar TypeScript.
- [ ] **Passo 6: Compilação Estática:** Rodar `npx tsc --noEmit`.
- [ ] **Passo 7: Disparo Paralelo (Triggers 03 e 04):**
  - Gemini gera `rag_chunks.json` (Fase 3A).
  - Claude gera `wave_<WAVE_ID>.spec.ts` e Fuzzer (Fase 3B).
- [ ] **Passo 8: Bateria de Testes:** Executar `npm run test:engine` e `npm run test:fuzz`.
- [ ] **Passo 9: Merge & Promote:** Promover arquivos para `src/` definitivo e assinar o commit de release.

---

### 6.2 Template de Manifesto da Wave (`wave_manifest.template.json`)

```json
{
  "wave_id": "{{WAVE_ID}}",
  "created_at": "{{TIMESTAMP}}",
  "total_cards": 0,
  "status": "INITIALIZED",
  "pipeline_progress": {
    "bootstrap": { "completed": false, "agent": "gemini-1.5-pro" },
    "dsl_compilation": { "completed": false, "agent": "claude-3-5-sonnet" },
    "rag_indexing": { "completed": false, "agent": "gemini-1.5-pro" },
    "fuzz_validation": { "completed": false, "agent": "claude-3-5-sonnet" }
  },
  "metrics": {
    "flagged_complex_cards": 0,
    "fuzz_iterations_run": 0,
    "rag_chunks_generated": 0
  }
}
```

---

## 7. ANÁLISE DE RISCOS E JUSTIFICATIVA DE ARQUITETURA

1. **Risco de Context Drift / Alucinação:**  
   *Mitigação:* O uso de schemas estritos de handoff (JSON Schema) e a barreira de validação com `tsc --noEmit` impedem que o Gemini introduza funções inexistentes na AST sem que o Claude detecte e corrija na fase seguinte.

2. **Risco de Custo de Tokens:**  
   *Mitigação:* Delegar ao Gemini a ingestão pesada e a geração estática de RAG otimiza imensamente os custos de API. O Claude é acionado apenas para raciocínio lógico focado (cartas sinalizadas e testes determinísticos).

3. **Invariantes do Motor:**  
   *Mitigação:* Ao forçar a criação de testes baseados em propriedades (*fuzz testing*) no Claude (Fase 3B), garantimos que os efeitos de novas cartas não quebrem regras globais do motor (ex: cartas "desaparecendo" das zonas de jogo ou loops infinitos de gatilhos).

---

## SUBMISSÃO PARA AUDITORIA

Esta proposta reflete a distribuição ideal das capacidades do **Gemini** e do **Claude**, aplicando automação rigorosa no repositório `portal-gundam-tcg-br`. Submeto o presente documento à apreciação crítica do Claude para análise, refinamento e aprovação dos pontos de integração e sincronização propostos.

---

### 2. Resposta / Auditoria Crítica (Claude - Auditor)

[CONCORDANCIA: 20%]

# Auditoria Crítica — Proposta de Execução Gemini↔Claude (Pipeline Multi-Wave)

## 0. Achado crítico (bloqueante): esta é a **terceira vez** que a mesma armadilha se repete

Antes de entrar nos três pontos pedidos, preciso registrar o mesmo tipo de achado que já apareceu duas vezes nos debates anteriores — e que essa nova proposta deveria ter herdado, não repetido:

- No debate de GD01, a proposta inicial do Gemini inventou um motor `EngineEffectEvaluator`/JSON runtime do zero, ignorando que `src/modules/simulator/engine/effectSpec.ts` já existia. Foi corrigido (85% de consenso final).
- No debate de protocolo multi-wave, o auditor (Gemini, nesse turno) pegou corretamente o Claude generalizando primitivas (Risco 1) e fatiando por tier em vez de ID-range (Risco 2). Foi corrigido (90% de consenso final).
- **Nesta proposta, o erro volta pela terceira vez, agora em escala maior**: todos os caminhos de arquivo citados são fictícios.

Verifiquei o repositório real. Não existe `src/engine/`, não existe `tests/engine/`, não existe `src/rag/`, não existe `.engine/waves/`. O que existe é:

| Citado na proposta (Gemini) | Real no repositório |
|---|---|
| `src/engine/types/card.ts` | `src/modules/simulator/engine/effectSpec.ts` (define `PrimitiveCall`, `TargetRef`, `Duration`) |
| `src/engine/cards/<WAVE_ID>/draft_effects.ts` / `index.ts` | `src/modules/simulator/content/{st01..st04,gd01}.ts` |
| `src/engine/core/GameState.ts`, `RulesEngine.ts` | `src/modules/simulator/engine/{abilityDispatch,predicates,deploy,costs,stats}.ts` |
| `tests/engine/golden_master/runner.ts` | `src/modules/simulator/engine/__golden__/harness.ts` + `hashes.json` (append-only, já em produção, já testado, já com gate de CI) |
| `.engine/waves/<WAVE_ID>/handoffs/*.json` | Já existe um mecanismo equivalente e **consensuado** no segundo debate: `content/gd0N/gd0N.manifest.json` + `primitives-claims.json` + `content/deferred.ts` |
| `src/rag/knowledge/<WAVE_ID>/rag_chunks.json` | `scripts/mcp-gundam/similar-specs.mjs` (lexical, n-gramas, **zero embeddings — decisão explícita já tomada**) + `pnpm gundam:index` |
| CLI genérico `npm run wave:init`, `npm run test:engine`, `npm run test:fuzz` | Scripts reais: `pnpm gundam:golden`, `pnpm gundam:fuzz`, `pnpm gundam:index`, `pnpm catalog:coverage:gate` (todos já existem em `scripts/`) |

Isso não é um detalhe cosmético. Significa que, se esses triggers forem executados literalmente, os agentes vão:
1. Criar uma segunda árvore de motor (`src/engine/`) paralela à real (`src/modules/simulator/engine/`), duplicando toda a lógica já auditada em produção.
2. Criar uma segunda suíte de Golden Master, desconectada de `hashes.json`, perdendo a cobertura de ST01–ST04 já validada.
3. Criar uma base RAG paralela em vetores/chunks/FAQ, contradizendo a decisão *já consolidada com 90% de concordância* de "zero embeddings, zero infraestrutura vetorial" (`docs/44 §6.1`, reafirmado no segundo debate).

O pedido do usuário foi explícito: "resolver e executar concretamente os **dois debates anteriores**". Esta proposta não executa os dois debates — ela os ignora e recomeça do zero pela terceira vez.

---

## 1. Divisão Gemini vs. Claude — a filosofia é razoável, o mecanismo de sincronização não

A ideia geral (Gemini = ingestão/tradução em massa/RAG de amplitude; Claude = lógica complexa/tipagem/testes de invariante) está alinhada com o que os dois debates anteriores já estabeleceram e com os pontos fortes reais de cada modelo. **Isso eu aceito.** O problema está em como a proposta orquestra o handoff entre os dois.

### 1.1. Reintrodução do "Risco 2" (drift semântico entre agentes) que já foi resolvido

O segundo debate identificou, com 90% de consenso, que a fonte nº 1 de inconsistência entre agentes paralelos não é conflito de merge — é **conflito semântico sem conflito de merge**: dois agentes resolvendo o mesmo padrão mecânico com nomes/abordagens diferentes. A solução consensuada foi: **congelar o vocabulário de primitivas via manifest + `primitives-claims.json` append-only antes do fan-out**, e desviar qualquer coisa não prevista para `content/deferred.ts` em vez de deixar o agente decidir sozinho.

A proposta atual (Trigger 01/02) reabre exatamente esse buraco: Gemini traduz texto para DSL livremente e só sinaliza `COMPLEX_LOGIC` quando *ele mesmo* julga que não sabe modelar. Não há:
- Lista de primitivas já congeladas que o Gemini deve consultar antes de inventar uma nova;
- Registro append-only equivalente a `primitives-claims.json`;
- Garantia de que Claude, ao revisar `draft_effects.ts`, vai pegar uma primitiva nova *que o Gemini criou sem sinalizar* (porque parecia simples) mas que duplica semanticamente algo que já existe em `effectSpec.ts`.

Isso é precisamente a "Primitiva Canivete Suíço" / duplicação silenciosa que o próprio Gemini, no papel de auditor no segundo debate, apontou como Risco 1 — e agora, no papel de propositor, comete a falha irmã dela.

### 1.2. `Fase 2` do Trigger 02 pede "compilação TypeScript estaticamente" como critério de aceite — insuficiente

`tsc --noEmit` passar não garante que o Golden Master não regrediu (`hashes.json` intocado para ST01–ST04) nem que a suíte de fuzzing passa. O gate real de aceite, já em produção, é `pnpm gundam:golden` + `pnpm gundam:fuzz` + `pnpm catalog:coverage:gate`. O trigger de Claude na Fase 2 deveria correr esses três antes de gerar o handoff de "Fase 2 concluída" — caso contrário, a Fase 3B (fuzzing/golden master) descobre problemas de contrato tarde, depois de já ter sido disparada em paralelo com a Fase 3A (RAG), desperdiçando o trabalho de RAG se a Fase 2 tiver que ser refeita.

---

## 2. Prompts gatilho — tecnicamente inexecutáveis como estão

Cada um dos 4 triggers referencia arquivos/diretórios que não existem (`'.engine/waves/{{WAVE_ID}}/raw/'`, `src/engine/types/card.ts`, `tests/engine/golden_master/runner.ts`). Um agente que executasse o Trigger 01 literalmente tentaria ler um diretório inexistente e, na melhor hipótese, falharia rápido; na pior, "alucinaria" a estrutura e criaria a árvore paralela `src/engine/` do zero — reintroduzindo o problema do achado nº 0.

Além disso:
- **Trigger 03 (RAG) contradiz a decisão já tomada.** Pede para o Gemini gerar "FAQ de Interações Sintéticas (Gere 5 perguntas/respostas prováveis de jogadores...)" como conteúdo de RAG. Isso é geração de conteúdo por LLM armazenada como *conhecimento base* — exatamente o que o segundo debate rejeitou com 90% de consenso: "o papel do modelo passa a ser narrar/justificar... não 'descobrir' sinergias por conta própria... isso elimina alucinação de interação inexistente". Sintetizar 5 perguntas e respostas "prováveis" por carta e persistir isso como chunk de RAG estático é reintroduzir superfície de alucinação exatamente na camada em que o consenso anterior queria zero alucinação (retrieval determinístico primeiro, LLM só narra sobre o que já foi validado).
- **Trigger 04 (Fuzzing) tem um invariante logicamente errado.** "Invariante 2: O total de cartas na zona de Deck + Mão + Traste + Banished + Campo deve permanecer constante" — isso ignora que o próprio motor real já tem a primitiva `spawnToken` (visível em `effectSpec.ts`, citada até no primeiro debate), que **cria** cartas/tokens que não estavam no deck original. O invariante como escrito vai disparar falso-positivo em qualquer carta que gere token. O invariante correto (já é o espírito do que builda `BATCH_PROCESSING.md`/`MAX_TRIGGER_CHUNKS` no projeto) precisa ser "nenhuma carta desaparece sem ir para uma zona válida", não "soma constante".
- **IDs de modelo desatualizados** (`gemini-1.5-pro`, `claude-3-5-sonnet`) no schema de handoff — sinal de que a proposta não foi calibrada para o momento atual de execução; isso é secundário, mas reforça a impressão de que o documento não foi escrito com o estado real do projeto/ambiente em mente.

---

## 3. O que funciona e deve ser aproveitado

Para não jogar tudo fora — a proposta tem 3 ideias de valor real, que os dois debates anteriores não tinham formalizado ainda:

1. **Divisão explícita "Fase 3A (RAG) roda em paralelo com Fase 3B (Golden Master/Fuzzing)"** — isso é consistente com o pipeline do segundo debate (Fase 4 de validação e Fase 5 de indexação RAG são independentes uma da outra, ambas dependem só da consolidação de conteúdo) e vale formalizar como "ponto de fork" explícito.
2. **Conceito de status por handoff (`SUCCESS` / `REQUIRES_HUMAN_REVIEW` / `COMPLEXITY_FLAGGED`)** — útil como *complemento* ao `deferred.ts`/`primitives-claims.json` já existentes, não como substituto. Pode virar um campo dentro do manifest já consolidado, não um arquivo/schema paralelo.
3. **A divisão de responsabilidade por modelo (Gemini = ingestão de amplitude + síntese RAG; Claude = lógica de tipos + testes de propriedade) é a correta e bate com o que os próprios modelos fazem melhor.** Isso deveria ser mantido, só re-cabeado nos artefatos reais.

---

## Veredito

A filosofia de divisão de trabalho está certa. A execução concreta está desconectada do repositório real e dos dois debates que supostamente sintetiza — reintroduz três problemas já resolvidos com consenso alto (motor duplicado, drift semântico entre agentes, e agora também alucinação de conteúdo de RAG) e adiciona um quarto (invariante de fuzzing incorreto sobre geração de tokens).

**Recomendação (não aceitar como está):** reescrever os 4 triggers usando exclusivamente os artefatos já consensuados nos dois debates — `content/gd0N/{gd0N.manifest.json, primitives-claims.json, ID-range files, index.ts}`, `src/modules/simulator/engine/{effectSpec.ts, abilityDispatch.ts, __golden__/hashes.json}`, `scripts/mcp-gundam/{similar-specs.mjs, interaction-graph.mjs}`, e os comandos reais (`pnpm gundam:golden`, `pnpm gundam:fuzz`, `pnpm gundam:index`, `pnpm catalog:coverage:gate`). O "padrão repetível" pedido pelo usuário já existe em forma de checklist no segundo debate (seção 3, "Checklist de Execução por Wave") — o trabalho certo aqui é *adaptar os triggers de Gemini/Claude para disparar esse checklist já aprovado*, não desenhar um quarto pipeline concorrente.

---

### 3. Réplica (Gemini - Propositor)

[CONCORDANCIA: 95%]

# Réplica e Plano de Execução Consolidado — Pipeline Multi-Wave (Gemini ↔ Claude)

Acatamento crítico integral. O diagnóstico do auditor é cirúrgico e incontestável: **a tentativa de sintetizar um modelo genérico resultou na criação de caminhos fictícios (`src/engine/`), ignorou o motor real em produção (`src/modules/simulator/engine/`) e violou consensos prévios já estabelecidos nos Debates 1 e 2** (como a ausência de embeddings/Q&A sintético e a preservação do mecanismo de `primitives-claims.json`/`hashes.json`).

Os 5% de divergência residual referem-se apenas à orquestração dos pontos de sincronização (handoffs), que agora foram refinados para operar exclusivamente sobre o sistema de arquivos real do projeto `portal-gundam-tcg-br`.

---

## 1. Mapeamento Corrigido: Abstração Fictícia vs. Realidade do Repositório

Toda a execução a partir deste momento fica ancorada **rigorosamente** na estrutura real do repositório:

| Artefato Fictício (Rejeitado) | Artefato Real no Repositório (Adotado) | Papel na Execução |
|---|---|---|
| `src/engine/types/card.ts` | `src/modules/simulator/engine/effectSpec.ts` | Contrato de primitivas (`PrimitiveCall`, `TargetRef`, `Duration`) |
| `src/engine/cards/<WAVE>/` | `src/modules/simulator/content/{st01..st04,gd01..gd0N}.ts` | Declaração de cartas por coleção |
| `.engine/waves/<WAVE>/handoffs/` | `src/modules/simulator/content/<WAVE>/<WAVE>.manifest.json` + `primitives-claims.json` + `deferred.ts` | Governança de escopo, vocabulário e desvio |
| `tests/engine/golden_master/` | `src/modules/simulator/engine/__golden__/harness.ts` + `hashes.json` | Suíte de regressão Golden Master append-only |
| `src/rag/` | `scripts/mcp-gundam/similar-specs.mjs` + `pnpm gundam:index` | RAG lexical n-grama estático (Zero Embeddings) |
| CLI fictício (`npm run wave:init`) | `pnpm gundam:golden`, `pnpm gundam:fuzz`, `pnpm gundam:index`, `pnpm catalog:coverage:gate` | Gates de CI e scripts de execução real |

---

## 2. Divisão Re-ancorada de Responsabilidades (Gemini ↔ Claude)

### 🤖 Gemini (Agente de Ingestão, Amplitude Lexical e RAG Estático)
*   **Fase 0 (Bootstrap & Extraction):** Recebe os textos brutos das cartas da nova wave (ex: `GD02`), gera a estrutura inicial em `src/modules/simulator/content/gd02.ts` e preenche a tradução rasa para as primitivas existentes de `effectSpec.ts`.
*   **Gestão de Escopo:** Aloca cartas complexas ou com termos desconhecidos em `src/modules/simulator/content/deferred.ts`, evitando invenção de primitivas sem aprovação.
*   **Fase 3A (Indexação RAG Lexical):** Alimenta o grafo de interações estáticas via `scripts/mcp-gundam/similar-specs.mjs` através de análise n-grama/lexical pura — **sem geração de Q&A sintético ou embeddings vetoriais**.

### 🛠️ Claude (Agente de Invariantes, Motor Core e Fuzzing)
*   **Fase 1 & 2 (Refinamento Mecânico & Governança):** Resolve os itens de `deferred.ts`. Se uma nova primitiva for inevitável, expande `effectSpec.ts`, registra a primitiva em `primitives-claims.json` e implementa a execução em `src/modules/simulator/engine/`.
*   **Fase 3B (Validação & Fuzzing):** Roda o gate de integridade completo (`pnpm gundam:golden`, `pnpm gundam:fuzz`, `pnpm catalog:coverage:gate`). Adiciona novos snapshots de execução ao `hashes.json` append-only.
*   **Correção de Invariantes:** Garante que o fuzzing valide a conservação de estado considerando `spawnToken` (tokens gerados em runtime são rastreados na zona de origem correspondente sem quebrar a contagem de integridade).

---

## 3. Prompts Gatilho Re-ancorados (Modelos de Execução Prática)

### 🟢 GATILHO 01 — Gemini (Bootstrap & Traçado Inicial)

```markdown
[AGENTE: GEMINI] [MODO: SEQUENCIAL - FASE 0 E 1]
OBJETIVO: Iniciar a ingestão da wave {{WAVE_ID}} no repositório portal-gundam-tcg-br.

CONTEXTO E ARTEFATOS REAIS:
- Spec de primitivas atual: `src/modules/simulator/engine/effectSpec.ts`
- Arquivo alvo da wave: `src/modules/simulator/content/{{WAVE_ID}}.ts`
- Manifest de governança: `src/modules/simulator/content/{{WAVE_ID}}/{{WAVE_ID}}.manifest.json`
- Arquivo de desvio: `src/modules/simulator/content/deferred.ts`

INSTRUÇÕES:
1. Analise o catálogo bruto da coleção {{WAVE_ID}} fornecido.
2. Mapeie cada carta para as estruturas de `PrimitiveCall` existentes em `effectSpec.ts`.
3. Para qualquer efeito que NÃO possua primitiva correspondente direta ou cuja regra seja ambígua, NÃO INVENTE primitivas. Escreva a entrada da carta apontando para `content/deferred.ts` registrando a razão da pendência em `{{WAVE_ID}}.manifest.json`.
4. Gere o código TypeScript em `src/modules/simulator/content/{{WAVE_ID}}.ts` seguindo o padrão de ST01-ST04.

CRITÉRIO DE ACEITE:
- O arquivo `src/modules/simulator/content/{{WAVE_ID}}.ts` deve compilar sob `pnpm tsc --noEmit`.
- Nenhuma modificação pode ser feita em `src/modules/simulator/engine/`.
- Atualização do arquivo `{{WAVE_ID}}.manifest.json` contendo a lista de cartas prontas e cartas desviadas.
```

---

### 🔵 GATILHO 02 — Claude (Resolução Mecânica & Expansão de Primitivas)

```markdown
[AGENTE: CLAUDE] [MODO: SEQUENCIAL - FASE 2]
OBJETIVO: Resolver cartas complexas em `content/deferred.ts` e garantir a integridade do motor para a wave {{WAVE_ID}}.

CONTEXTO E ARTEFATOS REAIS:
- Manifest da wave: `src/modules/simulator/content/{{WAVE_ID}}/{{WAVE_ID}}.manifest.json`
- Fila de diferidos: `src/modules/simulator/content/deferred.ts`
- Registro de primitivas: `primitives-claims.json`
- Motor core: `src/modules/simulator/engine/` (`abilityDispatch.ts`, `predicates.ts`, `deploy.ts`, etc.)

INSTRUÇÕES:
1. Leia as cartas pendentes registradas no manifest da {{WAVE_ID}}.
2. Se a mecânica exigir uma nova primitiva de efeito:
   a. Declare o tipo estritamente em `effectSpec.ts`.
   b. Registre a autorização de uso no arquivo append-only `primitives-claims.json`.
   c. Implemente a lógica nos módulos correspondentes de `src/modules/simulator/engine/`.
3. Mova as cartas resolvidas de `deferred.ts` para `src/modules/simulator/content/{{WAVE_ID}}.ts`.
4. Execute o gate preliminar rodando os comandos reais: `pnpm tsc --noEmit`.

CRITÉRIO DE ACEITE:
- `deferred.ts` limpo ou atualizado apenas com pendências justificadas para revisão humana.
- `primitives-claims.json` atualizado sem duplicação de primitivas existentes.
- Projeto compilando com sucesso.
```

---

### 🔀 GATILHOS EM PARALELO — FASE 3A (Gemini) E FASE 3B (Claude)

#### 🟢 GATILHO 03 — Gemini (Indexação RAG Lexical)

```markdown
[AGENTE: GEMINI] [MODO: PARALELO - FASE 3A]
OBJETIVO: Atualizar a base RAG lexical e o grafo de interações estáticas da wave {{WAVE_ID}}.

CONTEXTO E ARTEFATOS REAIS:
- Conteúdo consolidado: `src/modules/simulator/content/{{WAVE_ID}}.ts`
- Script RAG Lexical: `scripts/mcp-gundam/similar-specs.mjs`
- Script de Grafo: `scripts/mcp-gundam/interaction-graph.mjs`

INSTRUÇÕES DE EXECUÇÃO:
1. Processe o texto e os efeitos declarados em `{{WAVE_ID}}.ts`.
2. Execute o indexador lexical via linha de comando: `pnpm gundam:index`.
3. Atualize os mapeamentos n-grama e o grafo determinístico de interações.
4. REGRA ESTREITA: Não crie nem sintetize perguntas/respostas hipotéticas (Zero FAQ sintético). Apenas indexe os dados brutos declarados e validados no motor.

CRITÉRIO DE ACEITE:
- Script `pnpm gundam:index` executado com sucesso e sem erros de parsing.
```

#### 🔵 GATILHO 04 — Claude (Fuzzing & Golden Master Verification)

```markdown
[AGENTE: CLAUDE] [MODO: PARALELO - FASE 3B]
OBJETIVO: Validar os invariantes do jogo, executar fuzzing e congelar snapshots da wave {{WAVE_ID}}.

CONTEXTO E ARTEFATOS REAIS:
- Harness Golden Master: `src/modules/simulator/engine/__golden__/harness.ts`
- Repositório de Hashes: `src/modules/simulator/engine/__golden__/hashes.json`
- Comandos de Validação: `pnpm gundam:golden`, `pnpm gundam:fuzz`, `pnpm catalog:coverage:gate`

INSTRUÇÕES DE EXECUÇÃO:
1. Execute `pnpm gundam:fuzz` simulando N partidas aleatórias incluindo cartas da {{WAVE_ID}}.
2. Valide os invariantes de runtime:
   - Invariante A: Nenhuma transição de estado resulta em `undefined` ou quebra de tipo.
   - Invariante B (Conservação de Instâncias): Toda carta/token deve pertencer a exatamente uma zona válida. A geração de tokens (`spawnToken`) deve registrar o token na zona de destino sem romper a rastreabilidade do motor.
   - Invariante C: Efeitos acumulados durativos expirarem corretamente na fase/turno especificado em `Duration`.
3. Execute `pnpm gundam:golden`. Se todos os testes passarem, anexe os novos hashes de execução da {{WAVE_ID}} em `hashes.json` (append-only).
4. Execute `pnpm catalog:coverage:gate` para verificar a cobertura de catálogo.

CRITÉRIO DE ACEITE:
- Sucesso 100% nos três comandos: `pnpm gundam:golden`, `pnpm gundam:fuzz` e `pnpm catalog:coverage:gate`.
- Registro do diff append-only em `hashes.json`.
```

---

## 4. Padrão Repetível Reutilizável (Template de Execução de Wave)

Para que qualquer nova coleção (GD02, GD03, etc.) seja integrada de forma padronizada, o pipeline segue o seguinte **Checklist de Execução Padronizado**:

```text
[CHECKLIST PIPELINE MULTI-WAVE]
├── 1. SETUP & PREPARATION
│   ├── [ ] Criar arquivo manifest: `src/modules/simulator/content/<WAVE>/<WAVE>.manifest.json`
│   └── [ ] Garantir `hashes.json` e `primitives-claims.json` atualizados com a branch main
├── 2. FASE 0 & 1 (GEMINI - INGESTÃO E DRAFT)
│   ├── [ ] Disparar GATILHO 01 (Gemini)
│   ├── [ ] Gerar `src/modules/simulator/content/<WAVE>.ts`
│   ├── [ ] Mover ambiguidades para `content/deferred.ts`
│   └── [ ] Validar compilação base (`pnpm tsc --noEmit`)
├── 3. FASE 2 (CLAUDE - RESOLUÇÃO MECÂNICA E MOTOR)
│   ├── [ ] Disparar GATILHO 02 (Claude)
│   ├── [ ] Implementar novas primitivas em `src/modules/simulator/engine/` (se necessário)
│   ├── [ ] Registrar claims em `primitives-claims.json`
│   └── [ ] Limpar `content/deferred.ts`
├── 4. FASE 3 (FORK PARALELO)
│   ├── ├── FASE 3A (GEMINI - RAG ESTÁTICO)
│   │   ├── [ ] Disparar GATILHO 03 (Gemini)
│   │   └── [ ] Executar `pnpm gundam:index` (indexação lexical n-grama)
│   └── └── FASE 3B (CLAUDE - QUALITY ASSURANCE & GOLDEN MASTER)
│       ├── [ ] Disparar GATILHO 04 (Claude)
│       ├── [ ] Executar `pnpm gundam:fuzz` (validação de invariantes + tokens)
│       ├── [ ] Executar `pnpm gundam:golden` & append em `hashes.json`
│       └── [ ] Executar `pnpm catalog:coverage:gate`
└── 5. HANDOFF FINAL & MERGE
    └── [ ] Merge PR com validação 100% verde na suíte de testes real.
```

---

## Conclusão

Com este refinamento, o plano descarta totalmente abstrações fictícias e se alinha 100% à base de código real de `portal-gundam-tcg-br`. Preservamos a especialização de cada modelo (amplitude do Gemini e profundidade/rigor mecânico do Claude) e garantimos um processo estritamente determinístico, auditável e livre de alucinações.

</details>
