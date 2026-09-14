# Debate Técnico: Com base no relatorio docs/debates/2026-09-12-como-planejar-e-executar-a-wave-de-imple.md sobre a wave GD01 no motor do simulador, debater: (1) pontos de risco e mitigacao para garantir que cada NOVA wave de colecao (GD02, GD03, etc) nao quebre ou comprometa o que ja esta consolidado nas colecoes anteriores (regressao, compatibilidade, testes Golden Master); (2) como acelerar a inclusao de cartas com o mesmo rigor tecnico usando multiplos agentes/orquestracao em paralelo sem perder qualidade nem introduzir inconsistencia entre agentes; (3) como fazer tanto o motor quanto um bot LLM conhecerem cada carta, suas interacoes e as regras do jogo (usando RAG ou analise de similaridade semantica) para evoluir e ajudar jogadores a montar decks e estrategias; tudo isso (4) sem comprometer espaco em disco, processamento/custo de tokens, tamanho de arquivos ou geral risco de exaustao de contexto/memoria

- **Data:** 12/09/2026, 13:51:33
- **Iniciador:** CLAUDE
- **Propositor:** Claude
- **Auditor Crítico:** Gemini
- **Status:** Consenso Antecipado (>= 85%)
- **Índice de Concordância:** 90%
- **Turnos Executados:** 3 de 4

---

# RELATÓRIO SINTÉTICO DE CONSOLIDADAÇÃO TÉCNICA
**Tema:** Protocolo de Waves Multi-Coleção (GD02+), Orquestração Multi-Agente Paralela, Grounding de Conhecimento (Engine + Bot LLM) e Governança de Orçamento de Recursos.
**Debatedores:** Claude (Propositor) & Gemini (Auditor Crítico)
**Status Final:** Consenso Alcançado (90% de Concordância Final)

---

## [Pontos de Acordo]

1. **Separação Rígida entre Motor e Bot LLM**:
   - O **Motor de Jogo** é 100% código TypeScript tipado e determinístico (`CardDef`, `EffectSpec`, `abilityDispatch.ts`). Nenhuma chamada a LLM ou inferência probabilística é executada no ciclo de simulação.
   - O **Bot LLM / Assistente de Deck** é uma camada exclusivamente narrativa/consultiva. Ele opera sobre o resultado pré-filtrado e verificado de ferramentas determinísticas MCP (`gundam_deck_suggest`, `gundam_similar_specs`), mantendo o consumo de tokens plano, independente da expansão do catálogo.
2. **Zero Embeddings / Zero Infraestrutura Vetorial**:
   - Manutenção da decisão arquitetural do `docs/44 §6.1`: RAG e busca semântica usam **matching lexical por n-gramas de mecânica + trigramas literais** e parsing estático de AST em Node.js.
   - Custo de infraestrutura zero, zero chamadas de API externas para indexação, tempo de build negligenciável e reprodutibilidade 100% auditável.
3. **Golden Master Append-Only e Isolamento de Diff**:
   - O arquivo `engine/__golden__/hashes.json` é estritamente **append-only**.
   - O harness de teste diferencia programaticamente alterações de hash em pares da wave atual (esperado durante a implementação) de alterações de hash em pares de waves legadas sem arquivos alterados no PR (bloqueio por regressão cross-wave).
4. **Imutabilidade de Contrato em Primitivas (`PrimitiveCall`)**:
   - Primitivas existentes e consolidadas em waves anteriores jamais recebem parâmetros opcionais ou alterações de assinatura/comportamento para acomodar novas waves.
   - Novas variações de efeito exigem obrigatoriamente novas primitivas aditivas ou composição via *Higher-Order Modifiers*, eliminando o risco de regressão oculta em cartas legadas.
5. **Paralelização por Fatiamento de ID-Range (Abandono do Split por Tier)**:
   - Para evitar a quebra da coesão do domínio da entidade "Carta" e resolver conflitos de merge, os arquivos de conteúdo de cada wave são divididos estritamente por **ranges disjuntos de IDs de cartas** (`content/gd02/gd02.001-030.ts`, `gd02.031-060.ts`, etc.).
6. **Mecanismo Extensível de Reservas de Primitivas (`primitives-claims.json`)**:
   - Agentes em fan-out não bloqueiam a pipeline nem reabrem a Fase 1 sequencial ao encontrarem uma nova variante de efeito. Eles registram o nome da nova primitiva em um arquivo append-only de reserva (`primitives-claims.json`) e adicionam a variante sem colidir com outros trabalhadores.
7. **Fuzzing Cross-Wave Triangular com Retenção Apenas em Falha**:
   - Além da amostragem pairwise de golden master, a validação de regras globais (APNAP e Layers) utiliza cenários **triangulares** com "decks-fronteira" fixos (`GD0N x GD0(N-1) x ST01`).
   - Para respeitar o orçamento de disco, o runner de fuzzing retém em disco apenas os estados serializados e seeds de partidas que falharem.

---

## [Divergências e Riscos]

1. **Risco de Insuflamento do Discriminated Union `PrimitiveCall`**:
   - *Risco Mapeado*: A imutabilidade do contrato impede "canivetes suíços", mas pode gerar um aumento contínuo do número de variantes em `PrimitiveCall` no `effectSpec.ts`.
   - *Resolução*: O teto numérico de primitivas deixa de ser um bloqueio de PR (*hard gate*) e vira um **alarme de débito técnico**. Quando o número de variantes ultrapassa o limiar, abre-se uma tarefa de consolidação/refatoração isolada, fora do caminho crítico da wave.
2. **Cegueira Causal no Grafo de Sinergia Lexical**:
   - *Risco Mapeado*: N-gramas e trigramas puros não conectam ações a condições (ex: uma ação `restTarget` gera o estado exigido pela condição `isRested`).
   - *Resolução*: Implementação de uma **Tabela de Dualidade de Estado** declarada estaticamente na definição das primitivas (`emitsState` e `readsState`). O gerador de índice une as pontas via AST estático, sem uso de LLM.
3. **Escalonamento Combinatório de CI/Fuzzing**:
   - *Risco Mapeado*: O crescimento cartesiano de pares de teste com a chegada de GD02, GD03, etc., pode exceder os limites de tempo de CI e uso de CPU.
   - *Resolução*: Uso de cobertura por **assinatura mecânica pairwise** somado ao fuzzing triangular de decks-fronteira com amostragem fixa (ex: 2.000 partidas), mantendo o crescimento de tempo de execução e disco sub-quadratático (praticamente linear).

---

## [Proposta de Planejamento/Ajuste]

### Fluxo de Execução de Nova Wave (GD02, GD03...)

```
[Fase 0: Bootstrap & Fatiamento de Ranges]
   ├── Geração do Manifest (content/gd0N.manifest.json) com classificação preliminar.
   ├── Fatiamento dos arquivos de cartas por IDs disjuntos (content/gd0N/gd0N.001-030.ts, ...).
   └── Inicialização de content/gd0N/primitives-claims.json.

[Fase 1: Primitivas Iniciais & Contrato]
   ├── Implementação das primitivas inéditas identificadas no Bootstrap.
   ├── Declaração de tags 'emitsState' e 'readsState' para o Grafo de Dualidade.
   └── Congelamento de contratos legados (Imutabilidade Rígida).

[Fase 2/3: Fan-Out Paralelo por Ranges de Cartas]
   ├── N Agentes (Worker Agents) assumem ranges de IDs isolados.
   ├── Novas variantes de primitivas simples usam o arquivo append-only primitives-claims.json.
   └── Casos de mudanças estruturais na engine caem no content/deferred.ts ("pending_engine").

[Fase 4: Consolidação & Suíte Tríplice de Validação (Agente Líder)]
   ├── Consolidação dos ranges no barrel index file (content/gd0N/index.ts).
   ├── Execução do Golden Master (hashes.json append-only).
   ├── Execução do Fuzzing Cross-Wave Triangular (Frontier Decks).
   └── Verificação de cobertura via 'pnpm catalog:coverage:gate'.

[Fase 5: Indexação Estática e RAG do Bot]
   ├── Execução de 'pnpm gundam:index' para atualizar o interaction-graph.json (Dualidade Causal + Traits).
   └── Validação da tool MCP 'gundam_deck_suggest' para o Bot LLM.
```

---

## [Documento MD de Governança e Guia Executável]

Abaixo encontra-se o documento técnico unificado pronto para orientar o repositório, contendo especificações, checklists e prompts de automação para orquestração multi-agente.

```markdown
# Guia Oficial de Execução de Waves Multi-Coleção (GD02+) & Arquitetura RAG

**Versão:** 1.0.0
**Status:** Consolidado por Consenso Técnico
**Escopo:** Proteção contra regressão, orquestração paralela de cartas, grounding determinístico e governança de recursos.

---

## 1. Regras Invioláveis de Engenharia (Invariants)

1. **Imutabilidade de Contrato de Primitivas**: Nunca adicione parâmetros opcionais ou altere a lógica interna de uma `PrimitiveCall` já existente no `effectSpec.ts` para atender a uma nova wave. Crie uma nova variante ou componha via modifier.
2. **Sanidade do Golden Master**: O arquivo `engine/__golden__/hashes.json` só recebe novas entradas (append-only). A alteração de um hash de par que não envolva arquivos alterados na PR bloqueia o merge imediatamente.
3. **Coesão do Domínio da Carta**: Uma carta não deve ter sua lógica fragmentada por camadas técnicas. Cada arquivo de lote por range (`gd0N.XXX-YYY.ts`) deve conter a definição completa da carta (Vanilla + Efeitos + Auras).
4. **Isolamento de LLM**: O simulador e o motor de regras executam em runtime puro TS. O bot LLM consome dados via ferramentas MCP e jamais toma decisões de execução do jogo.

---

## 2. Estrutura de Arquivos de uma Wave (Exemplo GD02)

```text
content/
└── gd02/
    ├── index.ts                     # Barrel export reexportando todos os ranges
    ├── gd02.manifest.json           # Classificação e estado da wave
    ├── primitives-claims.json       # Registro append-only de reivindicação de primitivas
    ├── gd02.001-030.ts              # Range 1 de cartas (Agente 1)
    ├── gd02.031-060.ts              # Range 2 de cartas (Agente 2)
    └── gd02.061-090.ts              # Range 3 de cartas (Agente 3)
```

---

## 3. Checklist de Execução por Wave

- [ ] **1. FASE DE BOOTSTRAP**
  - [ ] Executar script de scaffold do diretório `content/gd0N/`.
  - [ ] Criar o arquivo `gd0N.manifest.json` mapeando os códigos de cartas para os lotes.
  - [ ] Inicializar `primitives-claims.json` como um objeto JSON vazio `{}`.

- [ ] **2. FASE DE FAN-OUT PARALELO**
  - [ ] Lançar sub-agentes vinculados a ramos Git/worktrees isolados por ID-range.
  - [ ] Garantir que novos nomes de primitivas aditivas sejam registrados em `primitives-claims.json`.
  - [ ] Caso uma carta exija mudança na engine global, marcá-la em `content/deferred.ts` como `pending_engine`.

- [ ] **3. FASE DE VALIDAÇÃO E SUÍTE DE REGRESSÃO**
  - [ ] Executar `pnpm gundam:golden --update` para gravar os novos hashes da wave.
  - [ ] Verificar integridade dos hashes antigos (nenhum hash anterior deve mudar).
  - [ ] Executar fuzzing triangular: `pnpm gundam:fuzz --triangular --wave=GD0N`.
  - [ ] Rodar o gate de cobertura: `pnpm catalog:coverage:gate`.

- [ ] **4. FASE DE GRAFO DE INTERAÇÃO & INDEXAÇÃO RAG**
  - [ ] Adicionar as tags `emitsState` e `readsState` nas novas primitivas e predicados.
  - [ ] Executar `pnpm gundam:index` para compilar o `interaction-graph.json`.
  - [ ] Testar a ferramenta MCP via CLI: `pnpm mcp:gundam test-suggest --card=GD02-001`.

---

## 4. Prompts de Automação e Orquestração

### Prompt 1: Agente Líder — Bootstrap & Fatiamento da Wave

```text
Você é o Agente Líder responsável por preparar a infraestrutura para a nova Wave de cartas [INSERIR_NOME_DA_WAVE, ex: GD02].

Sua tarefa:
1. Crie o diretório `content/[NOME_DA_WAVE]/`.
2. Analise a lista oficial de cartas em `data/gcg-official-cards.json` filtrando pela wave [NOME_DA_WAVE].
3. Gere o arquivo `content/[NOME_DA_WAVE]/gd0N.manifest.json` mapeando os códigos de cartas.
4. Divida a lista de cartas em arquivos de lote por Range de IDs contendo no máximo 30 cartas por arquivo (ex: `gd0N.001-030.ts`, `gd0N.031-060.ts`).
5. Crie os esqueletos dos arquivos TS exportando coleções de cartas vazias e agregue tudo no `content/[NOME_DA_WAVE]/index.ts`.
6. Crie o arquivo `content/[NOME_DA_WAVE]/primitives-claims.json` inicializado com `{}`.

Regras Estritas:
- Respeite o padrão de tipagem em `engine/types.ts`.
- Não altere nenhum arquivo de waves passadas.
- Confirme a criação de todos os arquivos no final.
```

### Prompt 2: Agente Trabalhador (Worker) — Lote de ID-Range Específico

```text
Você é um Agente Trabalhador encarregado de implementar as cartas do Lote de IDs: [INSERIR_LOTE, ex: content/gd02/gd02.001-030.ts].

Sua tarefa:
1. Abra o arquivo de lote atribuído a você e a lista de cartas correspondente em `data/gcg-official-cards.json`.
2. Implemente cada carta declarando sua estrutura completa (`CardDef` contendo status, efeitos e auras).
3. Se você precisar de uma nova variante de `PrimitiveCall`:
   a. Verifique se uma primitiva idêntica já existe em `engine/effectSpec.ts`.
   b. Se NÃO existir, crie um nome único e registre a intenção no arquivo `content/[NOME_DA_WAVE]/primitives-claims.json`.
   c. Adicione a variante em `engine/effectSpec.ts` e a lógica de execução correspondente em `engine/abilityDispatch.ts`.
   d. NUNCA altere o contrato ou os parâmetros de primitivas criadas em waves anteriores.
4. Se uma carta exigir alterações estruturais profundas na arquitetura do motor, NÃO force uma gambiarra. Registre a carta em `content/deferred.ts` com o motivo `"pending_engine"`.

Validação:
Ao finalizar, execute: `pnpm tsc --noEmit` para garantir ausência de erros de compilação no seu lote.
```

### Prompt 3: Agente Indexador — Grafo de Dualidade e RAG Estático

```text
Você é o Agente responsável por atualizar o Grafo de Interação Causal e Sinergia para o Bot LLM.

Sua tarefa:
1. Inspecione `engine/effectSpec.ts` e `engine/predicates.ts`.
2. Assegure que todas as novas primitivas possuam a tag de emissão de estado (`emitsState`) quando alterarem o estado do jogo (ex: `unit.rested`, `event.onDraw`).
3. Assegure que os predicados de verificação possuam a tag de leitura (`readsState`) correspondente.
4. Atualize o script `scripts/mcp-gundam/interaction-graph.mjs` para ler as novas cartas e fazer o join estático entre `emitsState` e `readsState`.
5. Execute `pnpm gundam:index` e certifique-se de que o arquivo de saída `scripts/mcp-gundam/interaction-graph.json` foi atualizado corretamente sem estourar 500KB.

Validação:
Rode os testes da ferramenta MCP com: `pnpm test scripts/mcp-gundam/similar-specs.test.mjs`.
```
```

---

Aguardando o veredito final do usuário Willen no encerramento.

---

<details>
<summary><b>Clique para ver a transcrição bruta dos turnos</b></summary>

### 1. Proposta Inicial (Claude - Propositor)

# Proposta Técnica — Protocolo de Waves Multi-Coleção, Orquestração Multi-Agente e Grounding de Conhecimento (Engine + Bot LLM)

**Autor:** Propositor Técnico (Claude Sonnet 5)
**Destinatário:** Auditoria Crítica (Gemini)
**Base:** `docs/debates/2026-09-12-como-planejar-e-executar-a-wave-de-imple.md` (consenso 85% entre Gemini/Claude sobre a wave GD01)
**Escopo desta rodada:** estender aquele consenso para (1) proteção de regressão entre waves futuras, (2) paralelização segura da autoria de cartas, (3) grounding de conhecimento carta-a-carta para o motor e para um bot LLM, e (4) tudo isso dentro de orçamento fixo de disco/tokens/contexto.

---

## 0. Achado prévio — parte disto já está construída (preciso registrar antes de propor)

Antes de propor qualquer coisa nova, verifiquei o estado real do repositório, porque o relatório-base cita `docs/44` como "documento de desenho, nada codado ainda" — isso está desatualizado. Já existe em produção:

| Peça do `docs/44` | Status real verificado |
|---|---|
| MCP `gundam` (Fase 1) | **Implementado**: `scripts/mcp-gundam/{server,mcp,catalog,engine,similar-specs}.mjs`, registrado em `.mcp.json`, com smoke test |
| `gundam_similar_specs` (RAG-lite, Fase 4 §6.1) | **Implementado**: `similar-specs.mjs` — matching por n-gramas de mecânica + trigramas literais, **zero embeddings**, testado (`similar-specs.test.mjs`) |
| Golden Master (Fase 2 §4.3) | **Implementado**: `engine/__golden__/harness.ts` + `hashes.json` (10 pares ST01–ST04, seed fixo, hash SHA-256), gate no CI |
| Coverage gate | **Implementado**: `pnpm catalog:coverage:gate` roda no CI |
| Fuzzing de regressão | **Implementado**: `pnpm gundam:fuzz` (100 partidas/par no CI) |
| Pipeline report→fix (Fase 3) | **Implementado**: `.github/workflows/bug-autofix.yml` — triagem RÁPIDO/COMPLEXO, auto-merge em `dev` só com CI verde, `main` sempre manual |
| Bots heurístico/MCTS/neural | **Implementados**: `engine/bot/{heuristicPolicy,mctsPolicy,neuralPolicy}.ts` |
| Bot LLM (Fase 5 §7.3) | **Não implementado** — é o único item genuinamente em aberto relevante ao ponto (3) |
| Interaction graph / deck-assistant | **Não existe** — é o gap real do ponto (3) |

Por quê isso importa: se eu propusesse "criar um pipeline de RAG" ou "criar CI de regressão" do zero, cairia no mesmo erro que a proposta original do Gemini cometeu no Turno 1 — reinventar o que já existe e testar contra uma base que não é a real. Minha proposta abaixo é **extensão** desses mecanismos já auditados, não substituição.

---

## 1. Protocolo de Wave — como GD02, GD03... não quebram ST01–ST04 nem GD01

### 1.1 Risco real (não é "regressão" genérica — é onde ela nasce)

O ponto de divergência nº 3 do debate-base já identificou a causa raiz corretamente: **o crescimento da união discriminada `PrimitiveCall`** (hoje 679 linhas em `effectSpec.ts`) e o dispatcher associado (`abilityDispatch.ts`) são o único lugar compartilhado que toda wave nova toca. Regressão entre waves não acontece porque "esquecemos de rodar teste" — acontece porque **um dispatcher compartilhado, editado por N waves ao longo do tempo, tem superfície de acoplamento oculto** (ex.: uma nova primitiva `restTarget` da GD02 que reusa o mesmo branch de `switch` de uma primitiva antiga por engano de merge).

### 1.2 Mecanismo proposto: "piso de regressão" append-only no Golden Master

O `GOLDEN_PAIRS` hoje é gerado programaticamente (`for i,j em ST01..ST04`). Proponho:

```ts
// engine/__golden__/harness.ts — extensão proposta
export const WAVE_KEYS = ["ST01", "ST02", "ST03", "ST04", "GD01"] as const; // cresce 1 item por wave, NUNCA remove

// Pares dentro-da-wave: cobertura completa (i<=j) só para o set novo, como já é hoje.
// Pares entre-waves: amostragem pairwise, não cartesiano completo (ver §4.3 — orçamento de CI/disco).
```

Regra dura (equivalente ao `MAX_TRIGGER_CHUNKS` do próprio projeto — um teto nomeado, não um "cresça à vontade"):

- **`hashes.json` é append-only.** Um teste dedicado (`goldenMaster.test.ts` já testa "cobre exatamente os pares" — estendo para "todo par de wave anterior a N-1 continua presente, e se `pnpm gundam:golden --update` mudar um hash de par que **não envolve** a wave sendo trabalhada, o PR falha com uma mensagem específica: "você alterou o resultado de uma coleção anterior sem tocar nela — provável regressão cross-wave, não side-effect esperado".
- Isso é diferente do gate atual (que já barra qualquer mudança de hash) — a melhoria é **diagnóstica**: separar "mudei o hash de um par GD02_vs_GD02 porque estou implementando GD02" (esperado) de "mudei o hash de ST01_vs_ST03 sem tocar em ST01/ST03" (bug). O harness já sabe quais decks cada par usa (`GoldenPair.a`, `.b`) — o diff só precisa cruzar isso com os arquivos alterados no PR.

### 1.3 Cobertura cross-wave sem explosão combinatória (pairwise testing, não cartesiano)

Hoje 4 sets = 10 pares (C(4,2)+4). Se cada wave nova crescer o cartesiano completo, GD05 chegaria a 9 sets = 45 pares — 4,5× o tempo de CI/fuzz de hoje só em golden master, crescendo O(n²). Proponho trocar o critério de "todos contra todos" por **cobertura por tag mecânica** (mesmo princípio de pairwise/combinatorial testing usado em teste de hardware/config):

1. Cada `EffectSpec` já carrega implicitamente sua "assinatura" (mesma extraída por `similar-specs.mjs`: `trigger`, `ops[]`, `targetScope`). Gerar, por wave, o conjunto de assinaturas únicas introduzidas.
2. Golden pairs cross-wave são escolhidos para que **toda combinação de (assinatura nova da wave N) × (assinatura de qualquer wave anterior)** apareça em pelo menos 1 par — não que todo deck jogue contra todo deck.
3. Isso mantém o crescimento de pares **linear** com o número de mecânicas novas por wave (tipicamente 5–15, não o produto de decks), e é auditável: o script de geração de pares imprime *por que* cada par foi escolhido (quais assinaturas ele cobre), então a auditoria consegue revisar a escolha em vez de confiar numa fórmula opaca.

### 1.4 Orçamento de crescimento de `PrimitiveCall`

Proponho um teto nomeado e um gate de reuso, no mesmo espírito do `MAX_CHUNKS` de `BATCH_PROCESSING.md`:

- **Antes de adicionar uma nova `PrimitiveCall`**, o autor (humano ou agente) é obrigado a rodar `gundam_similar_specs(effectEn)`. Se o score de similaridade com uma primitiva existente passa de um limiar (a definir empiricamente, ex. 2 n-gramas de mecânica + 1 trigrama), a primitiva existente deve ser generalizada (parâmetro opcional) em vez de duplicada.
- Um teste de arquitetura (`effectSpec.test.ts`, que já existe) ganha um caso: `expect(PrimitiveCall variants).toHaveLength(<= N)` — quando o contador estoura N (ex. 60), o PR falha pedindo uma "rodada de consolidação" explícita antes de continuar a wave. Isso não impede crescimento, só o torna uma decisão visível e revisada, não um acúmulo silencioso — o mesmo raciocínio do princípio "No Magic Numbers" já adotado no projeto, aplicado a superfície de código em vez de números mágicos.

### 1.5 Válvula de segurança: registro de deferimento já existe, só falta o gate ligado ponta a ponta

`content/deferred.ts` (docs/44 §6.2) é o mecanismo certo para "carta que não cabe ainda" — toda carta de GD0N deve cair em exatamente um dos três buckets antes do merge: **EffectSpec completo / vanilla (zero-DSL) / deferida com motivo**. O gate de cobertura já existe (`catalog:coverage:gate`) — a extensão necessária é garantir que ele rode **por wave incremental**, não só "cobertura total do catálogo", para que uma wave não consiga mesclar 80% completa e 20% "esquecida" sem entrada em `deferred.ts`.

---

## 2. Paralelização da autoria de cartas sem perder rigor nem gerar inconsistência entre agentes

### 2.1 Diagnóstico: onde a paralelização quebra qualidade

Duas fontes de inconsistência entre agentes paralelos, não uma:

1. **Conflito de escrita** — dois agentes editando o mesmo arquivo (`gd0N.ts`, `effectSpec.ts`) ao mesmo tempo.
2. **Conflito semântico sem conflito de merge** — dois agentes que **não** colidem em texto, mas cada um inventa uma primitiva diferente para o mesmo padrão mecânico (ex. um cria `bounceToHand`, outro cria `returnUnitToOwner` para o mesmo efeito), ou um segue a convenção de nomeação do `st03.ts` e outro não. Isso é o risco maior e mais difícil de pegar em code review — o merge passa limpo, os testes passam, e o catálogo fica estilisticamente fragmentado.

O plano do relatório-base resolve (1) implicitamente (arquivo por coleção), mas não (2). É o que endereço abaixo.

### 2.2 Protocolo proposto: fases sequenciais de barreira + fan-out largo dentro de cada fase

A wave GD0N já tem 4–5 fases bem definidas no consenso anterior (Fase 0 zero-DSL, Fase 1 primitivas, Fase 2 layers/auras, Fase 3 APNAP, Fase 4 golden master). Uso essa mesma estrutura como unidade de paralelização, mas com uma regra: **a Fase 1 (extensão de `PrimitiveCall`) é sempre de agente único (barreira sequencial); as Fases 0 e 2+ são de fan-out paralelo, mas só depois que a Fase 1 "congelou" as primitivas novas.**

```
[Manifest de Classificação — 1 agente, rápido]
        │  gera content/gd0N.manifest.json (vanilla | reusa-primitiva | primitiva-nova | aura)
        ▼
[Fase 1 — Extensão de Primitivas — 1 agente, sequencial]
        │  única mão que toca effectSpec.ts / abilityDispatch.ts nesta wave
        │  congela o vocabulário: PRIMITIVE_FREEZE = ["bounceToHand", "restTarget", ...]
        ▼
   ┌────────────────┬────────────────┬────────────────┐
   ▼                ▼                ▼                ▼
[Agente A]      [Agente B]      [Agente C]      [Agente D]
gd0N cartas     gd0N cartas     gd0N cartas     gd0N.auras.ts
001–025         026–050         051–075         (Fase 2, layers)
(zero-DSL +     (zero-DSL +     (zero-DSL +
 reuso)          reuso)          reuso)
   └────────────────┴────────────────┴────────────────┘
        ▼
[Agente Líder — barreira final]
   golden master + fuzz + coverage:gate (1× só, não N×)
```

Por que a barreira na Fase 1 resolve o problema real: o vocabulário de primitivas é exatamente o "estado compartilhado mutável" da wave. Travando-o antes do fan-out, cada agente do fan-out só **consome** um vocabulário já fechado (lido do manifest), nunca propõe um novo — elimina a classe de bug "dois nomes para o mesmo conceito" sem exigir revisão humana de cada card individualmente.

### 2.3 Manifest como fonte única de verdade (evita divergência sem coordenação viva entre agentes)

```json
// content/gd0N.manifest.json — gerado uma vez, lido por todos os agentes de fan-out
{
  "wave": "GD02",
  "frozenPrimitives": ["draw", "damageUnit", "modifyStat", "spawnToken", "bounceToHand", "restTarget", "discardRandom"],
  "cards": {
    "GD02-001": { "bucket": "vanilla" },
    "GD02-014": { "bucket": "reuse", "primitives": ["bounceToHand"], "similarTo": ["GD01-077"] },
    "GD02-033": { "bucket": "deferred", "reason": "troca ordem de turnos — precisa mini-RFC", "blockedBy": "engine:phase-order" }
  }
}
```

Agentes não se comunicam entre si em tempo real (caro, frágil) — eles se comunicam **através deste arquivo versionado**, que é justamente o padrão de "external memory" já usado neste projeto (`.handoff/`, `.memory/`, AI_GUIDE.md checklist). Cada agente do fan-out recebe como contexto **só** seu range de cartas + o manifest + `frozenPrimitives` — não o `effectSpec.ts` inteiro, não as outras 3 fatias.

### 2.4 Gate de consistência de estilo (automatizável, roda 1× no lead, não por agente)

Reaproveitar `gundam_similar_specs` como lint pós-fato, não só como ferramenta de autoria: um passo do agente líder roda a ferramenta para **toda carta nova da wave** contra o catálogo inteiro (ST01–GD0N-1) e sinaliza pares com score alto entre si mas `ops[]` diferentes — candidato a "dois agentes resolveram o mesmo padrão de forma diferente". Isso é barato (é o mesmo script já existente, é matching lexical, não chamada de modelo) e pode rodar no CI como um check informativo (não bloqueante) na PR da wave.

### 2.5 Reuso direto do runbook já validado do projeto

`docs/44 §8.2` já documenta o padrão de orquestração que funcionou (`scripts/iniciar-paralelo.ps1`, worktree por branch, escopo de arquivos disjunto, subagente devolve ou commita na própria branch). Não proponho um mecanismo novo de infraestrutura — proponho aplicar esse runbook **dentro de uma única wave**, usando os splits de arquivo do §2.6 abaixo para garantir que "escopo de arquivos disjunto" seja verdade mesmo com 3–4 agentes trabalhando na mesma coleção.

### 2.6 Split de arquivo por tier (resolve conflito de escrita E ajuda o orçamento de contexto do ponto 4)

Hoje cada coleção é 1 arquivo (`st03.ts`, 244 linhas; `st04.ts`, 290 linhas). Para permitir fan-out real dentro da mesma wave sem todos os agentes tocarem o mesmo arquivo, proponho dividir por tier de complexidade (que já é a classificação natural da Fase 0-3):

```
content/
  gd02.vanilla.ts      ← Fase 0 (zero-DSL) — agente A, B, C podem fatiar por range de código
  gd02.primitives.ts   ← Fase 1/2 (EffectSpec com primitivas existentes ou novas) — 1 agente por vez
  gd02.auras.ts        ← Fase 3 (layers/auras) — agente dedicado, toca costs.ts/stats.ts
  gd02.ts              ← barrel: reexporta os 3 acima (arquivo final, gerado, não editado à mão)
```

Isso também resolve parte do ponto 4: nenhum arquivo de conteúdo cresce sem limite — o vanilla tier de uma wave de ~90 cartas com 45% zero-DSL ainda cabe em ~150–200 linhas (mesma ordem de grandeza dos arquivos ST01–04 atuais).

---

## 3. Motor e bot LLM conhecendo cada carta, suas interações e as regras (RAG / similaridade semântica)

### 3.1 Separar dois consumidores com necessidades diferentes (erro comum é tratá-los como um problema só)

- **O motor** já "conhece" cada carta de forma perfeita e determinística — é código tipado (`CardDef`/`EffectSpec`), não precisa de retrieval. Não há nada de RAG a resolver aqui; o único trabalho é manter `gundam_coverage` fiel conforme waves entram.
- **O bot/assistente de deck** (o alvo real do pedido) precisa de conhecimento textual — regras, sinergias, texto de carta — para explicar jogadas e sugerir decks a jogadores. Esse é o problema de RAG de verdade, e é aqui que o risco de custo/alucinação mora.

### 3.2 Não introduzir vetor/embeddings — estender o que já existe e já foi validado

`docs/44 §6.1` já tomou essa decisão e ela está implementada (`similar-specs.mjs`): sem embeddings, sem serviço externo, ranking lexical por n-gramas de mecânica + trigramas literais. Motivo técnico para manter essa escolha em vez de "evoluir para embeddings": o vocabulário mecânico de um TCG é **fechado e pequeno** (a lista `MECHANIC_NGRAMS` já cobre a maior parte dos padrões de efeito do jogo) — retrieval lexical sobre um vocabulário fechado tem recall competitivo com embeddings **e** é 100% inspecionável (dá pra ver exatamente por que dois specs bateram), o que embeddings não dão sem tooling extra. Isso é relevante para newest ao ponto (4): zero custo de API de embedding, zero índice vetorial para persistir/re-treinar a cada wave.

### 3.3 Peça nova: grafo de interação entre cartas (o que falta para "montar decks e estratégias")

`gundam_similar_specs` responde "que carta parece com esta" — mas não responde "que cartas combinam com esta". Proponho um artefato derivado novo, gerado estaticamente (mesmo `pnpm gundam:index` já previsto):

```ts
// scripts/mcp-gundam/interaction-graph.mjs (novo, mesmo padrão de similar-specs.mjs)
interface CardSynergySignature {
  code: string;
  traits: string[];              // já existe no catálogo oficial (data/gcg-official-cards.json)
  linkRefs: string[];             // já existe — parear com pilotos nomeados
  referencedTraits: string[];     // extraído do EffectSpec: condition.filter.traits, etc.
  mechanicTokens: string[];       // reuso do mechanicTokens() de similar-specs.mjs
  costCurveSlot: number;          // já existe (cost)
}
```

- **Sinergia por trait**: cartas que citam um trait no `condition`/`targetFilter` (ex. "se você controla outra unidade Cibernética") apontam para todas as cartas desse trait — isso já está 100% nos dados existentes (`CardDef.subtypes` + `EffectSpec.condition.filter`), só falta indexar de A→B em vez de só B ter a condição.
- **Sinergia por link**: `linkRefs` (piloto nomeado) já existe no dataset oficial — vira aresta direta piloto↔unidade.
- **Sinergia por curva**: agregação simples (não IA) de custo/tipo por deck candidato, para preencher gaps de curva.

Tamanho estimado: ~1000 cartas × ~6 campos pequenos ≈ dezenas de KB (para comparação: `hashes.json` de 10 pares já pesa 884 bytes; este índice, mesmo em escala 100×, fica na casa de algumas centenas de KB — desprezível). Gerado por script, versionado como artefato derivado (mesma categoria de `hashes.json`), **nunca editado à mão**.

### 3.4 Nova tool MCP: retrieval determinístico, não geração

```
gundam_deck_suggest(seedCardCodes: string[], archetype?: string, limit?: number)
  → { candidates: [{ code, score, matchedOn: ["trait:Cybernetic", "link:Amuro Ray"] }] }
```

Implementação: pontuação por regras sobre o grafo do §3.3 (overlap de trait, presença de link, gap de curva) — **sem chamada a LLM**. Isso é o "R" do RAG: recuperação barata e determinística que faz o trabalho pesado.

### 3.5 Onde o LLM entra (e só aí) — bot comentado / assistente de deck

O LLM (Fase 5 §7.3 do docs/44, ainda não implementado) recebe **apenas**:
- a saída já filtrada de `gundam_deck_suggest` (10–20 candidatos, não os 1000+ cartas do catálogo);
- os 3–5 trechos batidos por `gundam_search_glossary` para a dúvida de regra específica;
- a visão de partida (`sim_view`) quando for modo "comentado" em tempo real.

O papel do modelo passa a ser **narrar/justificar em linguagem natural** sobre um conjunto pequeno e já citado — não "descobrir" sinergias por conta própria vasculhando o catálogo inteiro. Isso:
1. Elimina alucinação de interação inexistente (o modelo só fala sobre o que o retrieval determinístico já validou como real via `matchedOn`);
2. Mantém o custo de token **plano**: o tamanho do contexto do LLM não cresce com o catálogo (GD05 com 500 cartas a mais custa o mesmo token-wise que GD01, porque o gargalo é sempre "top 20 candidatos", nunca "catálogo inteiro").
3. Preserva a fronteira já decidida no docs/44 §7.3: o LLM é ferramenta de explicação/QA exploratório/deck-assistant — nunca o caminho de decisão em tempo real de jogo (isso continua com `heuristicPolicy`/`mctsPolicy`, que são determinísticos e baratos). Reafirmo essa fronteira em vez de reabri-la, porque é exatamente o tipo de linha que, se borrada "para acelerar", introduz custo/latência incompatível com gameplay real.

---

## 4. Orçamento — disco, tokens/custo, tamanho de arquivo, exaustão de contexto

| Recurso | Mecanismo de controle proposto | Evidência de escala atual |
|---|---|---|
| **Disco — Golden Master** | Pares cross-wave por cobertura de assinatura (§1.3), não cartesiano completo → crescimento linear, não O(n²) | `hashes.json` hoje: 884 bytes / 10 pares |
| **Disco — snapshots canônicos** | Manter só 2–3 partidas completas por wave (já previsto docs/44 §4.3), nunca por par | Estado de 1 partida serializado é da ordem de dezenas de KB (JSON de `GameState`) |
| **Disco — índice de interação/similaridade** | Artefato derivado, regenerável via `pnpm gundam:index`, não crescente por wave, sem cópia de embeddings | Escala com nº de cartas × campos fixos pequenos, não com nº de waves |
| **Tamanho de arquivo — conteúdo de coleção** | Split por tier (§2.6): `.vanilla.ts` / `.primitives.ts` / `.auras.ts`, teto informal ~300 linhas (mesma ordem dos arquivos ST01–04 atuais: 212–290 linhas) | `st01.ts`–`st04.ts`: 212–290 linhas cada |
| **Tamanho de código — `PrimitiveCall`** | Teto nomeado + gate de reuso via `gundam_similar_specs` antes de nova variante (§1.4) | `effectSpec.ts` hoje: 679 linhas, ~15 variantes de `PrimitiveCall` |
| **Tokens/custo — autoria paralela** | Cada agente de fan-out recebe só seu range de cartas + manifest congelado, não o repositório inteiro; suíte completa (golden+fuzz+coverage) roda 1× no líder, não N× por agente | Evita custo N× de re-rodar `pnpm test`/`gundam:fuzz` por agente |
| **Tokens/custo — bot LLM em runtime** | Retrieval determinístico primeiro (§3.4), LLM só narra sobre 10–20 candidatos já citados — contexto plano independente do tamanho do catálogo | Ancorado no padrão já em produção do `bug-autofix.yml` (LLM só entra depois de triagem determinística, nunca varre o repo inteiro às cegas) |
| **Exaustão de contexto do agente** | Fonte de verdade externa versionada (manifest JSON) em vez de o agente "lembrar" a classificação da wave inteira na própria transcript; 1 agente por tier/arquivo, não 1 agente monolítico por wave inteira | Mesmo padrão já adotado no projeto (`.handoff/`, `.memory/`, checklist do `AI_GUIDE.md`) |
| **CI/tempo de execução** | Fuzz cross-wave amostrado (não todo par), gate de golden master incremental por diff de arquivos alterados | CI atual: fuzz 100 partidas/par, ~10 pares — já seria ~4-5× mais lento em cartesiano puro na GD05 |

---

## 5. Trade-offs explícitos

| Decisão | Vantagem | Custo/risco aceito | Por que aceito mesmo assim |
|---|---|---|---|
| Golden pairs cross-wave por cobertura de assinatura, não cartesiano | Crescimento linear de CI/disco | Pode, em teoria, deixar uma combinação rara de duas mecânicas específicas sem par de teste dedicado | Mitigado pelo fuzzing amplo (que já é aleatório, não por par) + qualquer bug real gera um golden pair novo via `docs/44 §5` (pipeline de bug→repro já cobre esse buraco) |
| Barreira sequencial na Fase 1 (primitivas) antes do fan-out | Elimina inconsistência semântica entre agentes | Reduz o paralelismo total da wave (a fase mais "criativa" não é paralela) | Fase 1 é tipicamente a menor fração de cartas (15% na matriz do debate-base) — o gargalo sequencial é pequeno, o fan-out grande (45%+30% vanilla/reuso) é onde o tempo realmente é gasto |
| RAG lexical (sem embeddings) para o bot | Zero custo de infra nova, 100% inspecionável, já testado | Recall pior que embeddings para efeitos com fraseado muito atípico/fora do vocabulário conhecido | Vocabulário de TCG é fechado; e o mecanismo já tem trigramas literais como desempate — degradação suave, não silenciosa |
| Retrieval determinístico antes do LLM no bot de deck | Custo de token plano, sem alucinação de sinergia inexistente | Sugestões limitadas ao que o grafo de regras captura (não "criatividade" livre do modelo) | Alinhado ao objetivo real citado ("ajudar jogadores a montar decks") — precisão > criatividade num assistente de regras |
| Split de arquivo por tier em vez de 1 arquivo por coleção | Paralelismo de escrita real + arquivos menores | Mais um passo de build (barrel `gd0N.ts` gerado) | Custo de build é trivial (reexport), ganho de paralelismo e legibilidade compensa |

---

## 6. Síntese executável (checklist a validar com Gemini)

1. **Regressão entre waves**: golden master append-only + diagnóstico de "hash mudou fora do escopo da wave" + pairwise sampling cross-wave em vez de cartesiano + teto nomeado em `PrimitiveCall` + coverage gate por wave incremental.
2. **Paralelização**: manifest de classificação como fonte única de verdade → barreira sequencial só na Fase 1 (primitivas) → fan-out largo nas Fases 0/2/3 por tier de arquivo → suíte completa rodada 1× pelo agente líder.
3. **Conhecimento carta-a-carta**: motor não precisa de RAG (é código tipado); bot precisa — estender `gundam_similar_specs` (já existe, lexical) com um grafo de interação derivado + nova tool `gundam_deck_suggest` de retrieval puro; LLM só narra sobre o shortlist já filtrado, nunca varre o catálogo inteiro.
4. **Orçamento**: todo mecanismo acima escolhido especificamente por crescer sub-quadraticamente (linear ou constante) em disco, tokens e tamanho de arquivo conforme novas waves entram — nenhuma peça nova depende de infraestrutura externa (sem vetor DB, sem serviço de embeddings, sem sandbox de execução).

Submeto para auditoria crítica: peço atenção especial a (a) se o limiar de "similaridade suficiente para forçar reuso de primitiva" em §1.4/§2.4 é operacionalizável sem virar bloqueio arbitrário, e (b) se a barreira sequencial da Fase 1 no §2.2 é realista dado que novas primitivas às vezes só ficam óbvias *durante* a autoria das cartas de fan-out (risco de a barreira precisar reabrir no meio da wave).

---

### 2. Resposta / Auditoria Crítica (Gemini - Auditor)

[CONCORDANCIA: 80%]

---

### Visão Geral da Auditoria

A proposta do Propositor (Claude) é **tecnicamente madura e notavelmente respeitosa ao estado real do repositório**. A checagem inicial de fatos (reconhecendo que o MCP `gundam`, `similar-specs`, o harness Golden Master e os bots de simulador já estão codados) evita retrabalho e foca nos problemas reais. A decisão de manter o RAG estritamente **determinístico/lexical (sem vetores/embeddings)** e manter o motor 100% tipado/sem LLM está plenamente alinhada com os princípios de estabilidade, custo zero de infra e runtime determinístico.

No entanto, como Auditor Crítico, identifiquei **4 falhas estruturais, riscos de regressão oculta e inviabilidades operacionais** no fluxo proposto que precisam ser sanados antes da aprovação final.

---

### 1. Riscos Identificados e Falhas de Desenho

#### Risco 1: A Armadilha da "Primitiva Canivete Suíço" (§1.4)
* **O Problema**: A proposta exige que, se uma nova carta da GD02 for parecida com uma `PrimitiveCall` existente, a existente deva ser *generalizada* adicionando parâmetros opcionais, para não estourar o teto `PrimitiveCall <= N`.
* **A Falha Oculta**: Esta é a causa nº 1 de regressões silenciosas cross-wave em TCGs. Ao adicionar um parâmetro opcional (ex: `targetFilter?: ExtendedFilter`) a uma primitiva central usada por 40 cartas de ST01–ST04 (`damageUnit`), altera-se a assinatura e a lógica do dispatcher compartilhado (`abilityDispatch.ts`). Se o comportamento *default* do parâmetro opcional tiver um edge case sutil (ex: avaliação de lista vazia vs `undefined`), **cartas legadas que usam a primitiva sem o parâmetro mudam de comportamento silenciosamente**.
* **Impacto**: O teto numérico arbitrário força o desenvolvedor/agente a inflar primitivas existentes em "canivetes suíços" multifuncionais, aumentando a complexidade ciclomática do dispatcher em vez de mantê-lo composável e modular.

#### Risco 2: Quebra Inevitável da Barreira Sequencial e Arquitetura Errada de Fichamento por Tier (§2.2, §2.6)
* **O Problema na Barreira (§2.2)**: A proposta assume que a Fase 1 (extensão de primitivas) congela o vocabulário *antes* dos agentes entrarem em fan-out nas Fases 0/2/3.
* **A Inviabilidade Prática**: Em TCGs, a necessidade de um ajuste de primitiva frequentemente **só é descoberta durante a implementação e teste da carta**. Exemplo: ao codificar GD02-045 na Fase 2, o agente percebe que a aura depende de uma verificação de estado de jogo que a primitiva da Fase 1 não capturou inteiramente. Se a Fase 1 estiver congelada, o agente em fan-out terá apenas duas opções ruins:
  1. Forçar uma implementação "torta" (workaround em TS) violando a DSL.
  2. Bloquear o fan-out, invalidando o estado dos outros N agentes paralelos para reabrir a Fase 1.
* **O Erro de Design no Split de Arquivos (§2.6)**: Fatiar a wave em `gd02.vanilla.ts`, `gd02.primitives.ts`, `gd02.auras.ts` **viola a encapsulação do domínio**. Uma única carta Gundam (ex: um Mobile Suit de custo 5) pode ter status base (vanilla), um efeito `OnPlay` (primitiva) e um efeito constante de área (aura). Fatiar uma carta em 3 arquivos rompe a coesão. Além disso, se 3 agentes no fan-out trabalharem em cartas vanilla, todos ainda terão conflito de escrita no mesmo `gd02.vanilla.ts`!

#### Risco 3: Ponto Cego Semântico no Grafo de Interação Estático (§3.3)
* **O Problema**: A proposta sugere construir o grafo de sinergia indexando apenas `traits`, `linkRefs` e tokens mecânicos idênticos.
* **A Falha**: TCGs são dominados por **sinergias causais de causa-efeito entre termos opostos/complementares**.
  * Exemplo: Carta A aplica o estado `Rest` (Ação: `restTarget`). Carta B ganha +2000 ATK se o inimigo estiver em `Rest` (Condição: `isRested`).
  * Indexação por n-gramas exatos **não conecta** `restTarget` (ação) com `isRested` (checagem de condição). O grafo estático proposto ignorará as maiores sinergias de combate do jogo, entregando recomendações pobres ou incompletas para o bot LLM.

#### Risco 4: Cobertura Pairwise Insuficiente para Interações de Estado Global (§1.3)
* **O Problema**: Trocar a amostragem cartesiana cross-wave por *pairwise based on mechanic signature*.
* **O Risco de Escala**: Pairwise de assinaturas isoladas (Carta A × Carta B) garante que duas primitivas rodem juntas em um contexto unitário. Porém, bugs cross-wave críticos surgem de **regras globais e resolução de pilha/camadas (APNAP e Layers)** envolvendo 3+ cartas no campo simultaneamente (ex: Aura GD02 + Trigger GD01 + Resolução de Custo ST01). O pairwise puramente bilinear falhará em capturar bugs de prioridade e interleaving de triggers.

---

### 2. Matriz de Auditoria Direta aos Requisitos do Debate

| Requisito do Debate | Avaliação da Proposta de Claude | Risco Oculto / Gargalo Restante |
|---|---|---|
| **(1) Não quebrar waves anteriores (Regressão/Golden Master)** | **Excelente**: Hash append-only com diagnóstico de diff por wave. | **Médio**: Risco de regressão por "generalização de primitivas" (§1.4) e cegueira de APNAP no pairwise. |
| **(2) Paralelização Multi-Agente sem inconsistência** | **Regular**: Diagnóstico correto (conflito semântico), mas mecanismo falho. | **Alto**: Bloqueio de fan-out ao reabrir Fase 1; split por tier rompe a entidade Carta. |
| **(3) Conhecimento Motor + Bot LLM (RAG)** | **Bom**: Separação clara entre motor determinístico e LLM narrativo. | **Médio**: Grafo de interação estático cego para relações causa-efeito (ação vs condição). |
| **(4) Orçamento de Disco/Tokens/Memória** | **Excepcional**: Zero embeddings, zero infra vetorial, crescimento linear de assets. | **Baixo**: Fuzzing cross-wave precisa de limpeza de memória estrita (GC de snapshots). |

---

### 3. Ajustes Obrigatórios Exigidos pelo Auditor

Para elevarmos a concordância a nível de consenso definitivo, o Propositor deve incorporar as seguintes correções na arquitetura:

#### A. Ajuste na Governança de Primitivas (Substituir Teto Rígido por Imutabilidade de Contrato)
* **Regra**: É estritamente **proibido alterar comportamentos existentes de uma `PrimitiveCall`** para acomodar novas waves. Se uma nova wave exigir uma variação, a primitiva antiga deve ser mantida intocada e uma nova variante criada ou composta via *Higher-Order Primitive/Modifier*.
* O limite `PrimitiveCall <= N` deve ser um alarme de refatoração *fora do ciclo da wave*, e nunca uma regra que force "gambiarra" ou acoplamento em primitivas legadas consolidadas.

#### B. Reestruturação do Fan-Out de Agentes e Fichamento por Range de IDs
* **Split por Arquivo**: Abandonar a divisão por tier (`.vanilla.ts`, `.auras.ts`). Cada coleção GD0N deve ser fatiada por **Ranges de IDs de Cartas Disjuntos** (ex: `content/gd02/gd02.001-030.ts`, `content/gd02/gd02.031-060.ts`, etc.), indexadas por um `gd02/index.ts`.
* **Fluxo de Primitivas Emergentes**: Se um agente trabalhando no seu range de cartas precisar de uma primitiva não prevista na Fase 1, ele **não altera** `effectSpec.ts`. Ele declara a carta temporariamente no `content/deferred.ts` da wave com a flag `"pending_primitive"`. No final do fan-out, o Agente Líder faz um único passe consolidado adicionando as primitivas faltantes e resolvendo as cartas deferidas. Isso destrava o paralelismo sem conflito.

#### C. Mapeamento Causal de Causa-Efeito no Grafo de Interação (§3.3)
* O `interaction-graph.mjs` deve incluir uma **Tabela de Dualidade de Estado/Mecânica**:
  * Exemplo de par de dualidade: `action:restTarget` $\leftrightarrow$ `condition:isRested`; `action:drawCard` $\leftrightarrow$ `trigger:onDraw`.
* O grafo deve pontuar sinergia não apenas quando o token é idêntico, mas quando uma carta gera o evento/estado que a outra carta exige como condição/gatilho.

#### D. Suíte Fuzzing Cross-Wave Tríplice (Triangular)
* Para suprir a limitação do Pairwise puro (§1.3), o fuzzing cross-wave deve obrigatoriamente incluir cenários **triangulares** (1 Deck Novo GD0N vs 1 Deck Recente GD0N-1 vs 1 Deck Core ST01) sob motor de Gatilhos Múltiplos, garantindo a validação de resolução APNAP e ordem de camadas de aura entre waves distintas.

---

### Pergunta para a Próxima Rodada

Propositor (Claude): **Como você pretende estruturar a Tabela de Dualidade (Causa-Efeito) no `interaction-graph.mjs` mantendo-a estática e leve (sem LLM e sem estourar o orçamento de disco/scripting)? E você concorda em adotar o fatiamento por Range de ID de Cartas em vez de Tier para garantir o paralelismo real sem conflito de merge?**

---

### 3. Réplica (Claude - Propositor)

[CONCORDANCIA: 90%]

# Réplica e Consolidação — Governança Multi-Wave (GD02+)

A auditoria acertou nos quatro pontos centrais e evitou que o plano cometesse, na escala "multi-wave + multi-agente", exatamente o mesmo erro que a auditoria anterior (de Claude sobre a proposta original do GD01) já havia identificado: desenhar mecanismo novo sem checar se o mecanismo simples e aditivo já resolve o problema. Acato integralmente os Riscos 1, 3 e 4, acato o mecanismo do Risco 2 com uma correção de enquadramento (não de substância), e respondo às duas perguntas finais com um desenho concreto.

---

## 1. Tratamento dos Achados

### 1.1. Risco 1 — "Canivete Suíço" em Primitivas (§1.4) — **ACATADO INTEGRALMENTE**

A auditoria está certa: um teto numérico rígido (`PrimitiveCall <= N`) cria um incentivo perverso para generalizar primitivas já consolidadas em vez de criar novas. Isso é regressão silenciosa clássica — mudar o comportamento *default* de uma primitiva usada por 40 cartas de ST01–ST04 para acomodar uma variação da GD02 é o pior tipo de bug: passa no golden master das cartas que o autor testou e quebra uma carta legada que ninguém tocou.

**Regra adotada — Imutabilidade de Contrato de Primitiva:**
- Uma vez mergeada e coberta por golden master, uma `PrimitiveCall` existente **nunca** tem sua assinatura ou comportamento alterados. Zero exceções, mesmo para adicionar parâmetro opcional.
- Uma variação de comportamento = uma nova variante do discriminated union (`bounceToHandFiltered`, não `bounceToHand` com filtro opcional).
- Composição em vez de generalização: se duas primitivas fazem quase a mesma coisa, extrai-se uma função pura compartilhada (*Higher-Order Modifier*) chamada por ambas — nunca uma primitiva chama a outra por mutação de parâmetro.
- `PrimitiveCall <= N` deixa de ser gate de wave e vira **alarme de débito técnico**: quando o total cruza o limiar, abre-se um item de consolidação (fora do caminho crítico de qualquer wave em andamento) para decidir se duas primitivas near-duplicadas devem virar uma composição via modifier. Isso nunca bloqueia entrega de carta.

Isso não tem custo de disco/token adicional — é puramente uma regra de revisão, e reduz superfície de regressão em vez de aumentar.

### 1.2. Risco 3 — Cegueira Causal no Grafo de Interação (§3.3) — **ACATADO INTEGRALMENTE**

Correto: indexar por trait/token idêntico não captura a sinergia mais comum em TCG, que é ação → estado → condição (`restTarget` gera o estado que `isRested` consulta). Um grafo lexical não vê essa aresta. Respondo com o desenho concreto na Seção 3 (é também a pergunta final do auditor).

### 1.3. Risco 4 — Pairwise Insuficiente para Regras Globais (§1.3) — **ACATADO COM ESCOPO CONTROLADO**

Concordo que pairwise por assinatura mecânica não expõe bugs de resolução de pilha/APNAP entre 3+ cartas de waves diferentes. A suíte fuzzing cross-wave passa a incluir cenário **triangular obrigatório**, mas com escopo limitado para não violar o orçamento de disco/CPU do requisito (4):

- Não é combinatório sobre todas as triplas de cartas (isso explodiria). É **um conjunto fixo e pequeno de "decks-fronteira"** — um deck por wave que maximiza o uso das mecânicas novas daquela wave (curado manualmente, ~1 por wave, não gerado) — rodado em round-robin: `GD0N (fronteira) × GD0(N-1) (fronteira) × ST01 (core, fixo)`.
- Cada rodada de fuzzing roda um número fixo de partidas (ex.: 2.000, não 10.000+), e **só falhas são persistidas em disco** (hash do estado + seed de replay), não os logs completos das partidas que passaram. Isso mantém o crescimento de artefatos de teste linear com o número de waves, não combinatório.

### 1.4. Risco 2 — Fan-Out Sequencial e Split por Tier (§2.2, §2.6) — **ACATADO NO MECANISMO, COM CORREÇÃO DE ENQUADRAMENTO**

Aqui concordo com a conclusão (split por tier é ruim, dois agentes ainda colidem no mesmo arquivo `.vanilla.ts`) mas discordo levemente do diagnóstico. A auditoria enquadra o problema como "a barreira sequencial da Fase 1 é inevitavelmente quebrada durante o fan-out." Com a **Imutabilidade de Contrato** da Seção 1.1 já em vigor, isso deixa de ser verdade: adicionar uma primitiva nova é uma operação **puramente aditiva e nunca destrutiva** para o trabalho de outro agente. Não existe "reabrir a Fase 1" — existe apenas "declarar mais uma variante", o que não invalida nenhum agente em paralelo, contanto que dois agentes não tentem nomear a mesma primitiva nova ao mesmo tempo (colisão de nome, não de comportamento).

Ou seja: a Fase 1 não precisa ser congelada por completo antes do fan-out — ela precisa ser **aberta para extensão, fechada para modificação**, com um protocolo leve de reserva de nome:

```
content/gd02/primitives-claims.json   (arquivo único, append-only, ~poucos KB)

{
  "restTargetWithCondition": { "claimedBy": "agent-3", "cardRange": "031-060" },
  "swapOwnership":          { "claimedBy": "agent-7", "cardRange": "091-120" }
}
```

Um agente que precisa de uma primitiva nova durante o fan-out apenas adiciona uma linha reservando o nome (merge trivial, conflito de string, não de lógica) e implementa a variante — sem bloquear ninguém e sem reabrir nada. O `deferred.ts` com flag `pending_primitive` proposto pela auditoria continua útil, mas só para o caso residual em que a variante exige uma mudança **estrutural** no dispatcher (não uma nova variante, mas uma nova categoria de evento) — aí sim é trabalho de coordenação do Agente Líder fora do fan-out.

**Split de arquivo — aceito integralmente:** abandono do split por tier. Cada wave é fatiada por **Range de ID de carta disjunto** (`gd02/gd02.001-030.ts`, `gd02/gd02.031-060.ts`, ...), cada arquivo contendo a carta inteira (vanilla + efeito + aura, coesa), indexado por `gd02/index.ts`. Isso elimina a colisão de merge e preserva a coesão da entidade Carta.

---

## 2. Matriz de Auditoria Atualizada

| Risco | Veredito | Ação |
|---|---|---|
| 1. Canivete suíço em primitivas | Confirmado | Imutabilidade de contrato + composição via modifier; teto vira alarme, não gate |
| 2. Barreira sequencial / split por tier | Confirmado (split), refinado (barreira) | Split por ID-range; Fase 1 aberta-para-extensão via arquivo de claim, `deferred.ts` só para mudança estrutural |
| 3. Cegueira causal no grafo | Confirmado | Tabela de Dualidade estática (Seção 3) |
| 4. Pairwise insuficiente | Confirmado, escopo limitado | Fuzzing triangular com decks-fronteira fixos, retenção só de falhas |

---

## 3. Resposta à Pergunta Final

### 3.1. Estrutura da Tabela de Dualidade Causa-Efeito (estática, sem LLM, sem embeddings)

A tabela não é gerada por similaridade semântica em runtime — é **metadado declarado no ponto de autoria** de cada primitiva/predicado, resolvido em build-time por um script Node determinístico. Custo: algumas dezenas de KB de JSON gerado, zero dependência de infra.

**Passo 1 — Tag de emissão em cada `PrimitiveCall` que muda estado relevante para regras:**
```typescript
// effectSpec.ts
| { type: 'restTarget'; target: TargetRef; emitsState: 'unit.rested' }
| { type: 'drawCard'; player: PlayerRef; emitsState: 'event.onDraw' }
```

**Passo 2 — Tag de leitura em cada predicado que consulta esse mesmo estado:**
```typescript
// predicates.ts
| { type: 'isRested'; target: TargetRef; readsState: 'unit.rested' }
| { type: 'onDrawTrigger'; readsState: 'event.onDraw' }
```

**Passo 3 — `interaction-graph.mjs` faz apenas um join estático** entre `emitsState` e `readsState` ao escanear todos os módulos de conteúdo (AST parse, sem LLM):
```
edge(cardA, cardB, weight) quando cardA.emitsState === cardB.readsState
```

O grafo final continua sendo o mesmo n-gram/trait matching de antes, só que com uma segunda categoria de aresta ("dualidade causal") somada por cima. Isso resolve exatamente o caso `restTarget ↔ isRested` sem precisar de vetor, sem custo de token, e sem exigir manutenção separada — a tag é escrita junto com a primitiva, então nunca fica dessincronizada (se o autor esquecer a tag, o pior caso é uma aresta ausente, não uma aresta errada — falha segura).

### 3.2. Concordância com Range de ID vs. Tier

**Sim, concordo integralmente.** Fatiamento por Range de ID de carta é adotado como padrão para todas as waves futuras (ver Seção 1.4). Fatiamento por tier fica reservado exclusivamente para código de **engine compartilhado** (o pipeline de layers em `stats.ts`, o dispatcher em `abilityDispatch.ts`) — que é infraestrutura de motor, não conteúdo de wave, e continua sob edição sequencial/coordenada por um único agente ou pelo Agente Líder, nunca em fan-out paralelo.

---

## 4. Plano Consolidado (Governança Multi-Wave)

```
Por wave (GD0N):
[Fase 0: Baseline + Range Split]
   └── Fatiar conteúdo em gd0N.001-030.ts, .031-060.ts, ... (coesão por carta)
[Fase 1: Primitivas — Aberta para Extensão]
   └── Novo comportamento = nova variante + emitsState/readsState + claim em primitives-claims.json
   └── Imutabilidade de contrato: zero alteração em primitiva existente
[Fase 2/3: Fan-Out Paralelo por Range]
   └── Agentes trabalham ranges disjuntos; bloqueio só via deferred.ts (mudança estrutural real)
[Fase 4: Golden Master + Fuzzing Triangular]
   └── Regressão ST01-ST04 + GD01...GD0(N-1) + GD0N
   └── Fuzzing triangular: deck-fronteira GD0N × GD0(N-1) × ST01, retenção só de falhas
[Fase 5: Consolidação de Débito Técnico (fora do caminho crítico)]
   └── Revisão de primitivas quase-duplicadas quando PrimitiveCall cruza limiar de alarme
```

Isso fecha os quatro riscos levantados sem introduzir infraestrutura nova (sem vetor, sem sandbox, sem hot-reload), mantendo o crescimento de artefatos (claims file, duality tags, fixtures de falha) linear por wave — dentro do orçamento de disco/token/contexto exigido pelo item (4) do tema original.

**Pergunta em aberto para fechar consenso:** você concorda que o `deferred.ts` deve ficar reservado apenas para mudanças estruturais no dispatcher (não para novas variantes de primitiva, que já fluem pelo arquivo de claim), ou vê um cenário onde mesmo uma nova variante aditiva ainda justificaria bloquear o fan-out?

</details>
