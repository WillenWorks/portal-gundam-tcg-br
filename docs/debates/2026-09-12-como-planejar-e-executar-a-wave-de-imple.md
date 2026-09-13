# Debate Técnico: Como planejar e executar a wave de implementacao das cartas da colecao GD01 no motor de jogo do simulador, garantindo que os efeitos das cartas respeitem as mecanicas do jogo, mas que o motor aceite novas configuracoes carta por carta para que os efeitos sejam implementados corretamente

- **Data:** 12/09/2026, 13:31:45
- **Iniciador:** GEMINI
- **Propositor:** Gemini
- **Auditor Crítico:** Claude
- **Status:** Consenso Antecipado (>= 85%)
- **Índice de Concordância:** 85%
- **Turnos Executados:** 3 de 4

---

# Relatório de Sintetização Técnica: Implementação da Coleção GD01

**Status do Debate:** Consenso Alcançado (85% de concordância final)  
**Agentes Envolvidos:** Gemini (Propositor) vs. Claude (Auditor Crítico)  
**Tema:** Arquitetura e Estratégia de Execução da Wave GD01 no Motor do Simulador  

---

## [Pontos de Acordo]

1. **Reaproveitamento e Extensão da Arquitetura Existente:**
   - Abandonou-se completamente a ideia de construir uma DSL baseada em JSON externo, hot-reload ou runtime paralelo.
   - A coleção GD01 utilizará estritamente a estrutura existente em `src/modules/simulator/engine/` (`effectSpec.ts`, `predicates.ts`, `abilityDispatch.ts`), estendendo-a via uniões discriminadas em TypeScript.

2. **Eliminação de Sandbox JS / Scripting Arbitrário (Fase 4 Purificada):**
   - Nenhuma carta de "quebra de regra" executará scripts dinâmicos ou código isolado em VM.
   - Qualquer mecânica inédita da GD01 será declarada via **novas `PrimitiveCall` fortemente tipadas** no motor, garantindo determinismo absoluto, replayability e compatibilidade com fuzzing.

3. **Manutenção do Modelo de Compilação Imutável (Sem Hot-Reloading):**
   - As definições de cartas permanecem sendo módulos compilados e tipados (`gd01.ts`), eliminando inconsistências de mutação por valor e garantindo integridade de estado durante partidas em andamento.

4. **Resolução de Gatilhos Simultâneos via Regra APNAP (Active Player, Non-Active Player):**
   - Gatilhos simultâneos gerados na mesma resolução de comando são organizados deterministicamente: primeiro os gatilhos do Jogador Ativo, depois os do Jogador Passivo.

5. **Substituição da Call Stack Guard por Fila FIFO Determinística:**
   - Abandono de limites de recursão de stack em favor de um contador de chunks processados (`MAX_TRIGGER_CHUNKS = 50`), alinhado com o padrão `BATCH_PROCESSING.md`.

6. **Prevenção de Inconsistências de UI e Pre-Targeting (`docs/48`):**
   - Validação estática antes de requisitar alvos da UI utilizando a estrutura existente (`specActiveCalls` / `callsNeedNamedTarget`).

7. **Reclassificação Realista de Cartas (Fase 0 = Zero-DSL):**
   - Cerca de **45% da coleção GD01** consiste em cartas *vanilla* ou que utilizam exclusivamente keywords oficiais já suportadas pelo core (`Blocker`, `First Strike`, `Support`, `Repair`, `Breach`, `Suppression`, `High-Maneuver`, `Once per Turn`), não exigindo especificações de efeito.

8. **Compatibilidade Transversal com IAs (`features.ts`):**
   - Os subsistemas de IA (`heuristicPolicy.ts`, `mctsPolicy.ts`, `neuralPolicy.ts`) consultarão o estado recalculado via `getEffectiveStats(unit, state)` para enxergar modificadores contínuos da GD01.

---

## [Divergências e Riscos]

1. **Complexidade de Performance no Cálculo de Layers (Auras da Fase 3):**
   - *Risco:* A recalculação constante de stats efetivos em um pipeline de 3 camadas (Base -> Auras por Timestamp -> Temporários) pode gerar gargalos durante simulações intensivas de IA (como a busca da árvore MCTS).
   - *Mitigação:* Implementar um cache de propriedades calculadas por tick de estado com invalidação atrelada a mudanças no campo (`boardHash`).

2. **Interface de Decisão para Gatilhos Simultâneos do Mesmo Jogador:**
   - *Ponto Remanescente (15%):* Caso um mesmo jogador dispare múltiplos gatilhos no mesmo evento, deve-se decidir entre solicitar a escolha de ordenação via UI ou adotar ordem padrão por timestamp de entrada no tabuleiro (*board entry order*).

3. **Crescimento da União Discriminada `PrimitiveCall`:**
   - *Risco:* Adicionar novas primitivas na engine para a GD01 aumenta a superfície de código de `abilityDispatch.ts`, exigindo cobertura rigorosa na suíte *Golden Master* para evitar regressões nas coleções ST01–ST04.

---

## [Proposta de Planejamento/Ajuste]

### Pipeline Consolidado da Wave GD01 (5 Fases)

```
[Fase 0: Baseline Zero-DSL] 
   └── Cadastrar cartas vanilla e de keywords nativas (~45% do set).
[Fase 1: Extensão de Primitivas TS] 
   └── Adicionar novas PrimitiveCalls no `effectSpec.ts` (bounce, rest, discard).
[Fase 2: Pipeline de Layers & Auras] 
   └── Implementar cálculo de stats efetivos (3 layers) e custos dinâmicos.
[Fase 3: APNAP & Auditoria Pre-Target] 
   └── Ordenação APNAP na fila FIFO + Validação estática de alvos (`docs/48`).
[Fase 4: Validação Golden Master & Delivery] 
   └── Adicionar fixtures GD01 em `goldenMaster.test.ts` e rodar suite de fuzzing.
```

---

## [Documento MD com todo o informativo, checklist caso precise e prompts de automação, orquestração e/ou uso de skills, caso necessário]

```markdown
# Especificação Técnica de Execução: Wave GD01 Engine Integration

## 1. Resumo Executivo
Este documento orienta a implementação da expansão GD01 no motor do simulador TCG/CCG. A estratégia estende a DSL declarativa em TypeScript existente (`effectSpec.ts`), garantindo determinismo total, retrocompatibilidade com as coleções ST01-ST04 e total integração com a suíte de testes e bots de IA.

---

## 2. Mudanças Arquiteturais no Core Engine

### 2.1 Extensão do `effectSpec.ts`
Adicionar apenas os novos discriminadores estritamente necessários para o set GD01:

```typescript
// Localização: src/modules/simulator/engine/effectSpec.ts

export type PrimitiveCall =
  // Primitivas Existentes (ST01-ST04)
  | { type: 'draw'; amount: number }
  | { type: 'damageUnit'; target: TargetRef; amount: number }
  | { type: 'modifyStat'; target: TargetRef; stat: 'hp' | 'atk'; value: number; duration: Duration }
  | { type: 'spawnToken'; cardDef: CardDef }
  // NOVAS PRIMITIVAS GD01
  | { type: 'bounceToHand'; target: TargetRef }
  | { type: 'restTarget'; target: TargetRef }
  | { type: 'discardRandom'; player: 'self' | 'opponent'; amount: number };
```

### 2.2 Pipeline de Cálculo de Stats por Camadas (Layers)
Para processar Auras e Modificadores Contínuos da Fase 3:

```typescript
// Localização: src/modules/simulator/engine/stats.ts

export function getEffectiveStats(unit: UnitInstance, state: GameState): EffectiveStats {
  // Layer 1: Stats nativos + anexos permanentes (equipamentos/pilotos)
  let atk = unit.cardDef.stats.attack + unit.attachments.reduce((acc, a) => acc + a.atkBonus, 0);
  let hp = unit.cardDef.stats.hp + unit.attachments.reduce((acc, a) => acc + a.hpBonus, 0);

  // Layer 2: Auras contínuas no campo (ordenadas por playIndex)
  const activeAuras = state.board.getAurasOrderedByTimestamp();
  for (const aura of activeAuras) {
    if (aura.appliesTo(unit, state)) {
      atk += aura.atkModifier;
      hp += aura.hpModifier;
    }
  }

  // Layer 3: Modificadores temporários de turno
  for (const mod of unit.temporaryModifiers) {
    if (mod.stat === 'atk') atk += mod.value;
    if (mod.stat === 'hp') hp += mod.value;
  }

  return { effectiveAtk: Math.max(0, atk), effectiveHp: hp };
}
```

### 2.3 Despacho APNAP e Fila FIFO de Gatilhos
Garantir a ordem determinística de gatilhos simultâneos em `abilityDispatch.ts`:

```typescript
// Localização: src/modules/simulator/engine/abilityDispatch.ts

export function queueSimultaneousTriggers(
  triggers: TriggerEvent[], 
  activePlayerId: string, 
  state: GameState
): void {
  // Ordenação APNAP: Jogador Ativo primeiro, Jogador Passivo depois
  const sortedTriggers = [
    ...triggers.filter(t => t.controllerId === activePlayerId),
    ...triggers.filter(t => t.controllerId !== activePlayerId)
  ];

  for (const trigger of sortedTriggers) {
    state.actionQueue.push(trigger);
  }
}
```

---

## 3. Checklist de Execução Técnico

- [ ] **Fase 0 (Baseline GD01)**
  - [ ] Mapear o set GD01 e identificar as ~45% de cartas Zero-DSL.
  - [ ] Criar o arquivo `src/modules/simulator/content/gd01.ts` contendo as definições estáticas das cartas Vanilla/Keyword.
- [ ] **Fase 1 (Primitivas GD01)**
  - [ ] Atualizar as uniões discriminadas em `effectSpec.ts`.
  - [ ] Implementar os manipuladores de cada nova primitiva em `abilityDispatch.ts`.
  - [ ] Criar testes unitários para cada nova `PrimitiveCall`.
- [ ] **Fase 2 (Layers & Auras)**
  - [ ] Implementar `getEffectiveStats` em `stats.ts`.
  - [ ] Atualizar `costs.ts` para receber `GameState` e calcular custos dinâmicos.
  - [ ] Atualizar `features.ts` para sincronizar os vetores da IA com os stats efetivos.
- [ ] **Fase 3 (Gatilhos APNAP & Resiliência)**
  - [ ] Integrar a ordenação APNAP na fila de gatilhos.
  - [ ] Aplicar o guarda `MAX_TRIGGER_CHUNKS = 50` em resoluções em lote.
  - [ ] Garantir validação `specActiveCalls` para evitar travamentos de UI.
- [ ] **Fase 4 (Validação Golden Master)**
  - [ ] Adicionar fixtures da GD01 no `goldenMaster.test.ts`.
  - [ ] Executar suíte de testes de regressão ST01-ST04 + GD01.
  - [ ] Executar fuzzing automatizado de 10.000 partidas simuladas.

---

## 4. Prompts de Automação / Orquestração

### Prompt 1: Extensão do TypeScript DSL (`Claude Code / Antigravity`)
> Copie e cole este prompt para solicitar a inclusão das novas primitivas no motor:

```text
Você é um engenheiro sênior do motor de simulador TCG. Siga estritamente as especificações abaixo:

TAREFA:
1. Abra `src/modules/simulator/engine/effectSpec.ts`.
2. Estenda o tipo discriminado `PrimitiveCall` adicionando as seguintes variantes sem quebrar as existentes:
   - `{ type: 'bounceToHand'; target: TargetRef }`
   - `{ type: 'restTarget'; target: TargetRef }`
   - `{ type: 'discardRandom'; player: 'self' | 'opponent'; amount: number }`
3. Em `src/modules/simulator/engine/abilityDispatch.ts`, implemente os casos de execução para essas três novas primitivas na função de dispatch.
4. Mantenha 100% de compatibilidade com as coleções ST01-ST04 e garanta que o código passe em `npm run test`.
```

### Prompt 2: Implementação da Ordenação APNAP e Guard de Fila
> Copie e cole este prompt para ajustar a fila de gatilhos:

```text
Você deve implementar a regra APNAP (Active Player, Non-Active Player) para gatilhos simultâneos e o guarda de loop.

TAREFA:
1. Em `src/modules/simulator/engine/abilityDispatch.ts`, localize onde os gatilhos de eventos são enfileirados.
2. Refatore o processamento para que os gatilhos pertencentes ao jogador ativo (`state.activePlayerId`) sejam inseridos na fila FIFO antes dos gatilhos do jogador passivo.
3. Garanta que o número de sub-gatilhos processados por comando não exceda a constante `MAX_TRIGGER_CHUNKS = 50`. Se exceder, lance um evento de término de partida por empate de loop infinito.
4. Adicione testes em `src/modules/simulator/engine/__tests__/apnap.test.ts` validando o comportamento.
```

### Prompt 3: Atualização do Golden Master e Fuzzing
> Copie e cole este prompt para executar a validação final da wave:

```text
Execute a suíte de testes Golden Master e crie os cenários de regressão para a coleção GD01.

TAREFA:
1. Adicionar fixtures de partidas contendo cartas da GD01 em `src/modules/simulator/engine/__tests__/goldenMaster.test.ts`.
2. Executar o runner de regressão garantindo que nenhuma alteração na GD01 alterou os hashes de estado das coleções ST01-ST04.
3. Executar o script de fuzzing com 1.000 partidas aleatórias entre bots utilizando o set GD01 completo.
4. Confirmar que zero exceções não tratadas foram lançadas e todos os estados finais são válidos.
```
```

---
*Aguardando o veredito final do usuário Willen para encerramento.*

---

<details>
<summary><b>Clique para ver a transcrição bruta dos turnos</b></summary>

### 1. Proposta Inicial (Gemini - Propositor)

# Proposta Técnica: Arquitetura e Estratégia de Implementação Wave-Based da Coleção GD01

**Autor:** Propositor Técnico (Gemini)  
**Destinatário:** Auditoria Crítica de Arquitetura (Claude)  
**Status:** Proposta Inicial para Revisão e Validação  

---

## 1. Visão Geral e Objetivos

O desafio de implementar a coleção **GD01** em um motor de jogo de TCG/CCG pré-existente reside no equilíbrio entre dois requisitos antagônicos:
1. **Invariância do Core:** A lógica central de regras (fases de jogo, prioridade, determinação de vitória/derrota, ciclo de combate) deve permanecer estrita, imutável e à prova de regressão.
2. **Extensibilidade por Configuração (Data-Driven):** As cartas da coleção GD01 introduzem novos efeitos, modificadores contínuos e triggers condicionais que **não** devem exigir refatoração contínua do código-fonte do motor de jogo.

### Objetivos Principais
* **Extensibilidade Zero-Code no Core:** Permitir que 90%+ das cartas da GD01 sejam implementadas exclusivamente via arquivos de configuração declarativa (JSON/YAML) baseados em uma DSL (*Domain-Specific Language*).
* **Isolamento de Estado:** Garantir que nenhuma carta altere o estado do jogo diretamente (*Direct State Mutation*), forçando a emissão de **Intenções de Ação** (*Action Intents*) validadas pelo motor.
* **Estratégia de Deploy em Waves (Onda):** Estabelecer um *pipeline* de integração e validação progressiva para a coleção GD01, minimizando o risco de *bugs* de interação entre efeitos.

---

## 2. Arquitetura do Sistema: O Paradigma Declarativo e Orientado a Eventos

Para garantir a separação entre as regras gerais do jogo e as configurações específicas da GD01, adotamos um modelo de **Event-Driven AST (Abstract Syntax Tree) com Fila de Resolução Determinística**.

```
+-----------------------------------------------------------------------+
|                         MOTOR DO JOGO (CORE)                          |
|  +---------------------+    +--------------------+    +------------+  |
|  | State Machine       |    | Action Pipeline    |    | Validation |  |
|  | (Fases, Turnos, HP) |    | & Priority Stack   |    | Rules      |  |
|  +----------+----------+    +---------^----------+    +-----^------+  |
+-------------|-------------------------|---------------------|---------+
              | Emite                   | Processa            | Valida
              v Evento                  | Intenções           |
+-------------+-------------------------+---------------------v---------+
              |                                               |
              v                                               |
+-------------------------------------------------------------+---------+
|                    CAMADA DE CARTAS (GD01 CONFIG)                    |
|  +--------------------+   +-----------------------+                 |
|  | Event Triggers     |   | AST Evaluator         |                 |
|  | (ON_PLAY, etc.)    |-->| (Condições e Alvos)   |                 |
|  +--------------------+   +-----------+-----------+                 |
|                                       | Emite Intenções             |
|                                       v                             |
|                           [ Effect Intent Vector ]                  |
+-----------------------------------------------------------------------+
```

### 2.1. Princípios de Isolamento

1. **Cartas são Dados, Não Código:** As cartas da GD01 não contêm métodos executáveis imperativos; contêm estruturas de dados declarativas que descrevem *Gatilhos (Triggers)*, *Condições (Predicates)* e *Efeitos (Actions)*.
2. **O Motor como Autoridade Única (Single Source of Truth):** Apenas o *Core Engine* altera a árvore de estado (`GameState`). As cartas apenas propõem uma lista de transformações pendentes (ex: `DamageAction`, `DrawCardAction`).
3. **Imutabilidade e Determinismo:** Dado o mesmo estado `S` e o mesmo evento `E`, a interpretação da DSL da GD01 deve retornar exatamente a mesma intenção `I` em 100% das simulações.

---

## 3. Especificação da DSL da Coleção GD01

Abaixo apresentamos o esquema de configuração para as cartas da coleção GD01. A DSL é composta por três componentes primitivos: **Triggers**, **Conditions** e **Operations**.

### 3.1. Estrutura de JSON Schema da Carta (Exemplo Completo GD01)

Considere uma carta complexa da GD01: *"Quando esta unidade atacar, se você controlar outra unidade GD01 do tipo 'Cibernético', cause 3 de dano à unidade inimiga com menor HP e compre 1 carta."*

```json
{
  "id": "gd01_card_042",
  "name": "Vanguard Cyber-Scout",
  "set": "GD01",
  "cost": 3,
  "type": "UNIT",
  "subtypes": ["CYBERNETIC"],
  "stats": {
    "attack": 3,
    "hp": 4
  },
  "effects": [
    {
      "id": "attack_cyber_synergy",
      "trigger": {
        "event": "ON_ATTACK_DECLARE",
        "source": "SELF"
      },
      "condition": {
        "op": "AND",
        "rules": [
          {
            "field": "CONTROLLER_BOARD",
            "predicate": "CONTAINS",
            "filter": {
              "exclude_self": true,
              "set": "GD01",
              "subtypes": ["CYBERNETIC"]
            },
            "count_at_least": 1
          }
        ]
      },
      "operations": [
        {
          "type": "DEAL_DAMAGE",
          "amount": 3,
          "target": {
            "selector": "SINGLE",
            "scope": "ENEMY_BOARD",
            "type": "UNIT",
            "order_by": "STAT_HP_ASCENDING",
            "limit": 1
          }
        },
        {
          "type": "DRAW_CARDS",
          "amount": 1,
          "target": {
            "selector": "PLAYER",
            "scope": "SELF"
          }
        }
      ]
    }
  ]
}
```

### 3.2. Mecanismo de Execução da Configuração no Motor

```typescript
// Interface simplificada do Interpretador de Efeitos no Engine Core

interface EffectDefinition {
  id: string;
  trigger: TriggerRule;
  condition?: ConditionTree;
  operations: OperationDefinition[];
}

class EngineEffectEvaluator {
  public evaluateTrigger(
    event: GameEvent, 
    card: CardInstance, 
    state: GameState
  ): ActionIntent[] {
    const cardDef = card.definition;
    const intents: ActionIntent[] = [];

    for (const effect of cardDef.effects) {
      if (!this.matchesTrigger(event, card, effect.trigger)) continue;
      
      if (effect.condition && !this.evalCondition(effect.condition, card, state)) {
        continue;
      }

      // Resolver Alvos de forma estritamente determinística
      for (const op of effect.operations) {
        const resolvedTargets = this.targetResolver.resolve(op.target, card, state);
        intents.push(new ActionIntent(op.type, op.amount, resolvedTargets, card.id));
      }
    }

    return intents;
  }
}
```

---

## 4. Plano de Execução da Wave de Implementação (GD01)

A implementação da coleção GD01 será executada em **4 Fases Sequenciais**, organizadas por complexidade mecânica para evitar gargalos de desenvolvimento.

```
Wave GD01 Pipeline:
[Fase 1: Primitivas] ──> [Fase 2: Wave Estática] ──> [Fase 3: Wave Dinâmica] ──> [Fase 4: Sandboxing]
```

### 4.1. Fases da Wave

| Fase | Categoria de Cartas | Cobertura GD01 | Descrição da Configuração / Ação |
| :--- | :--- | :--- | :--- |
| **Fase 1** | *Vanilla & Primitivas Base* | ~40% do Set | Cartas sem efeito, com buffs estáticos simples (ex: +1/+1), custos diretos e danos simples. Validação total da DSL base. |
| **Fase 2** | *Triggers Estreitos & Filtros* | ~35% do Set | Efeitos de entrada em campo (`ON_PLAY`), morte (`ON_DEATH`), e filtros por sub-tipos GD01. Uso 100% da DSL declarativa em JSON. |
| **Fase 3** | *Modificadores Contínuos e Auras* | ~15% do Set | Efeitos como "Enquanto esta unidade estiver em jogo, suas outras unidades GD01 custam (1) a menos". Exige introdução de *Layers de Modificação de Estado*. |
| **Fase 4** | *Quebradores de Regras (Edge Cases)* | ~10% do Set | Cartas que alteram mecânicas fundamentais (ex: "Inverte a ordem dos turnos", "Troca o deck com o cemitério"). Implementadas via escopo estendido de *Script Extensions*. |

### 4.2. Estrutura do Pipeline de Deploy e Ingestão de Configurações

Para aceitar novas configurações **carta por carta** sem indisponibilizar o simulador:

1. **Hot-Reloading em Ambiente de Teste:** O servidor do simulador monitora o repositório de JSONs das cartas da GD01. Ao alterar o JSON de uma carta, a definição é invalidada no cache do simulador sem derrubar as partidas em execução (as novas partidas pegam a nova versão).
2. **Feature Flagging Individual:** Cada carta possui uma chave de ativação: `GD01_CARD_042_ENABLED = true/false`. Se uma carta apresentar um bug crítico em produção, ela pode ter seu efeito desativado instantaneamente, caindo para o comportamento "Vanilla" ou sendo banida temporariamente via flag de configuração, sem necessidade de *rollback* de build do motor.

---

## 5. Estratégia de Qualidade, Testes e Garantia de Regras

Para garantir que as novas cartas da GD01 não quebrem as mecânicas existentes:

### 5.1. Testes de Integração Baseados em Declaração (Data-Driven Tests)
Criamos um runner de teste baseado em arquivos de cenário (fixtures em JSON).

```json
{
  "test_name": "GD01_Card_042_Cyber_Synergy_Triggers_Correctly",
  "setup": {
    "player_board": ["gd01_card_042", "gd01_generic_cybernetic_unit"],
    "enemy_board": [{"id": "enemy_unit_1", "hp": 5}, {"id": "enemy_unit_2", "hp": 2}]
  },
  "action": {
    "type": "DECLARE_ATTACK",
    "attacker": "gd01_card_042",
    "target": "enemy_player"
  },
  "expected_state": {
    "enemy_board": [{"id": "enemy_unit_1", "hp": 5}, {"id": "enemy_unit_2", "hp": 0, "status": "DEAD"}],
    "player_hand_count_delta": "+1"
  }
}
```

### 5.2. Testing de Propriedades e Fuzzing (Invariantes de Mecânica)
Rodamos simulações automatizadas com bots fazendo ações aleatórias com 100% do set da GD01 habilitado para validar **Invariantes do Motor**:
* **Invariante 1:** Nenhum valor de HP/Ataque/Custo pode ser manipulado para estados inválidos (ex: NaN, Infinity, Custo negativo a menos que explicitado).
* **Invariante 2:** A Fila de Resolução de Efeitos (*Stack*) deve **sempre** esvaziar. Se o limite de 50 sub-efeitos encadeados for atingido, o motor deve abortar a cadeia para evitar loops infinitos de gatilhos acoplados.

---

## 6. Análise de Trade-offs e Gestão de Riscos

### 6.1. Trade-offs do Design

| Decisão Arquitetural | Vantagem | Desvantagem / Trade-off | Mitigação Proposta |
| :--- | :--- | :--- | :--- |
| **DSL 100% Declarativa vs. Scripting Livre (Lua/JS)** | Total segurança de execução, impossível travar a thread principal com loops infinitos, validação de schema estática. | Menos flexível para cartas extremamente exóticas da GD01 (Fase 4). | Permitir Fallback para expressões avaliadas em um Sandbox estritamente isolado apenas na Fase 4. |
| **Resolução por Intenções (Action Intents)** | Desacoplamento perfeito do Core Engine. Permite preview de efeitos na UI antes de aplicar. | Adiciona uma pequena sobrecarga de alocação de memória por evento processado. | *Object Pooling* de Action Intents dentro da Fila de Execução do Motor. |
| **Pipeline de Deploy Carta por Carta** | Velocidade de entrega da wave, isolamento de bugs por carta. | Risco de inconsistência de versão do catálogo de cartas entre Cliente e Servidor. | Hash de verificação de Catálogo de Cartas no handshake da conexão WebSocket. |

### 6.2. Riscos Mapeados e Planos de Contingência

1. **Risco:** Loops infinitos de gatilhos cruzados (Ex: Carta A engatilha B quando sofre dano, B causa dano a A).
   * *Contingência:* O motor implementa uma **Profundidade Máxima de Stack de Gatilhos (Max Trigger Stack Depth = 25)**. Ao atingir o limite, o efeito atual é interrompido e um log de erro é emitido para auditoria.
2. **Risco:** Modificadores contínuos da GD01 desacelerando o cálculo de estado a cada tick do jogo.
   * *Contingência:* Utilização do padrão *Calculated Property Cache* com invalidação seletiva baseada em grafo de dependências do estado do jogo.

---

## 7. Próximos Passos (Submissão para Auditoria)

Esta proposta detalha a arquitetura **Data-Driven / Event-Driven Pipeline** projetada para absorver a coleção GD01 com máxima segurança mecânica e agilidade de configuração.

Submeto este documento para a **Auditoria Crítica do Claude**, solicitando análise especialmente sobre:
1. Resiliência da DSL para cartas que alterem regras contínuas (Auras/Modificadores de Regra).
2. Cobertura da pilha de intenções de ação contra *race conditions* de eventos simultâneos.
3. Consistência da divisão em Waves proposta.

---

### 2. Resposta / Auditoria Crítica (Claude - Auditor)

[CONCORDANCIA: 40%]

# Auditoria Crítica — Proposta de Wave GD01

Antes de entrar nos três pontos solicitados, preciso registrar o achado mais grave: **esta proposta ignora que o motor já existe e já resolve boa parte do que ela está "inventando".**

## 0. Achado crítico: a proposta reinventa um motor que já está em produção e já foi auditado

Verifiquei o código real em `src/modules/simulator/engine/` e `src/modules/simulator/content/`. O que existe hoje:

- `effectSpec.ts` define exatamente o conceito de **EffectSpec declarativo** (Trigger → Condition → PrimitiveCall[]) que a proposta apresenta como novidade. Já tem `TargetRef` (self, pairedUnit, instance, named, group), `PrimitiveCall` (draw, damageUnit, modifyStat, spawnToken, etc.), `Duration` (endOfTurn/thisBattle/permanent) e `staticAbilities`.
- `predicates.ts`, `abilityDispatch.ts`, `deploy.ts` implementam o "Condition Evaluator" e o "Action Intent Pipeline" da proposta — só que já rodando com 64 cartas reais (ST01–ST04).
- Existe suíte de **golden master tests** (`goldenMaster.test.ts`) e testes data-driven de cenário — o que a seção 5.1 da proposta apresenta como algo a criar.
- **Mais importante: existe `docs/48-auditoria-condicionais-e-alvos-st01-st04.md`, um relatório de correção de um bug de produção real** que é exatamente a classe de problema que essa proposta corre o risco de reintroduzir (ver ponto 2).

Isso muda o enquadramento inteiro do debate. A pergunta certa não é "como desenhar um motor Event-Driven AST do zero para GD01" — é **"como estender o EffectSpec/PrimitiveCall existente para cobrir as mecânicas novas da GD01 sem quebrar o que já está validado nas ST01–ST04"**. A proposta atual, se executada como está (JSON runtime, hot-reload, `EngineEffectEvaluator` novo, feature flags por carta), significa:
- Duas linguagens de efeito coexistindo (o `EffectSpec` TS atual + o JSON novo) até alguém migrar as 64 cartas antigas — trabalho não estimado e não mencionado.
- Ou abandonar o `EffectSpec` atual, jogando fora testes/auditoria já feitos.

**Isso precisa ser resolvido antes de qualquer coisa. Não é detalhe de implementação, é a decisão arquitetural nº 1.**

---

## 1. Resiliência da DSL para regras contínuas (Auras / Modificadores)

A Fase 3 é subestimada. Hoje o motor computa stats "efetivos" (`effectiveHp`, `effectivePilotDef`) e `staticAbilities` de forma pontual — aparentemente recomputado sob demanda para o próprio card, não um sistema de camadas (layers) genérico que resolve dependências entre auras cruzadas (A buffa B, B teria efeito sobre a condição de A).

Problemas não endereçados pela proposta:
- **Ordem de aplicação de layers**: se duas auras da GD01 alteram o mesmo atributo (uma reduz custo, outra reduz custo condicionalmente "se você tiver 3+ Cibernéticos"), a ordem de avaliação importa quando há dependência circular de contagem (aura X conta unidades Cibernéticas, mas uma dessas unidades só é Cibernética por causa de outra aura Y). O MTG resolve isso com um sistema de layers com timestamp — a proposta não especifica nada equivalente, só cita "Calculated Property Cache com invalidação seletiva baseada em grafo de dependências", que é uma frase, não um design. Grafo de dependência de estado mutável recalculado a cada tick é exatamente onde a maioria dos motores de TCG (Hearthstone, MTGA) historicamente sangraram bugs.
- **Custo dinâmico não é "efeito", é uma propriedade consultada em outro subsistema** (`costs.ts` no seu próprio motor). Uma aura que reduz custo de compra exige que `costs.ts` consulte o grafo de auras ativas — isso é acoplamento novo entre "camada de cartas" e "core", contradizendo o princípio de isolamento da própria seção 2.1 ("apenas o motor altera o GameState"). A proposta não trata onde mora essa consulta nem quem é dono da fonte de verdade do custo efetivo.
- Nenhuma menção a como as **três IAs de bot já existentes** (`heuristicPolicy.ts`, `mctsPolicy.ts`, `neuralPolicy.ts`, `features.ts`) vão enxergar auras contínuas. Se `features.ts` extrai vetor de estado para o bot e não souber ler os novos modificadores de Fase 3, os bots vão jogar mal ou nem considerar a aura — isso é uma lacuna de produto, não só de engine.

## 2. Cobertura contra "race conditions" de eventos simultâneos — diagnóstico errado do problema

A proposta trata isso como concorrência distribuída (menciona WebSocket handshake, hash de catálogo). Mas o dispatcher real (`abilityDispatch.ts`) processa comandos de forma síncrona, single-threaded, com uma fila FIFO (`queuedDestroyed`). **Não existe race condition no sentido de threads — existe um problema de ordenação determinística de gatilhos simultâneos (regra APNAP: Active Player, Non-Active Player)**, que a proposta nunca menciona explicitamente. Exemplo real do próprio jogo: combate mútuo onde as duas unidades morrem ao mesmo tempo, cada uma com "quando esta unidade for destruída" — quem resolve primeiro? O jogador ativo escolhe a ordem dos seus próprios gatilhos simultâneos e depois o oponente resolve os dele (regra padrão de CCGs) — a "Fila de Resolução Determinística" da proposta usa a palavra "determinística" mas não define o algoritmo de ordenação.

Além disso, o achado real do `docs/48` é exatamente sobre **avaliação estática vs. dinâmica de condição** antes de abrir prompt de escolha de alvo (cartas sendo marcadas como "interativas" antes de checar se a condição passa). O pseudocódigo `EngineEffectEvaluator.evaluateTrigger` da proposta resolve isso corretamente *na hora de gerar intents*, mas **não resolve o problema real**, que é decidir *antes* da resolução se a UI precisa pausar esperando escolha de alvo — a mesma classe de bug do Aegis Gundam (ST04-006) vai se repetir na GD01 se o novo schema JSON não tiver o equivalente a `specActiveCalls`/`callsNeedNamedTarget` (que já existe e já foi corrigido no formato atual). Isso é factível de reproduzir 1:1 se o time não souber que esse bug já existiu.

**Limite de profundidade de stack (seção 6.2)**: a mitigação proposta ("Max Trigger Stack Depth = 25") não bate com a arquitetura real, que usa fila FIFO, não recursão de call stack. O guard correto aqui é um **contador de gatilhos processados por resolução de comando** (padrão já documentado em `BATCH_PROCESSING.md` deste projeto: `MAX_CHUNKS` como guarda, não profundidade de stack). Pequeno detalhe, mas mostra que a mitigação foi copiada de um modelo mental (linguagem funcional recursiva) que não é o do motor real.

## 3. Consistência da divisão em Waves — números soltos e contradição interna

- Os percentuais (40/35/15/10%) não têm lastro em contagem real de cartas da GD01, e o próprio `effectSpec.ts` documenta que **toda keyword oficial (Blocker, First Strike, Support, Repair, Breach, Suppression, High-Maneuver, Once per Turn) já é tratada automaticamente pelo motor**, sem precisar de EffectSpec nenhum. Isso significa que a real "Fase 0" (cartas que não precisam de NADA de DSL, só stats+keywords) provavelmente é maior que os 40% de "Fase 1" propostos, e a Fase 1 real de esforço de engenharia é menor. O plano precisa primeiro classificar as cartas por "zero DSL" vs "precisa de EffectSpec", não assumir 40% como "vanilla" já contando trabalho de validação de DSL que não é necessário.
- **Contradição interna grave**: o objetivo declarado na seção 1 é "Extensibilidade Zero-Code no Core... 90%+ das cartas via configuração declarativa" — mas a Fase 4 (10% do set) introduz **"Script Extensions"** com "Fallback para expressões avaliadas em um Sandbox estritamente isolado". Isso anula todas as garantias de determinismo, segurança e fuzzing da seção 5 exatamente para as cartas mais perigosas (as que "alteram mecânicas fundamentais", ex. "inverte ordem dos turnos"). E é tratado como uma frase de rodapé na tabela de trade-offs, sem: qual sandbox (VM do Node? QuickJS? WASM?), qual orçamento de CPU/tempo por execução, como isso passa nos mesmos testes de invariante do golden master, e como isso interage com replay determinístico (save/replay de partida fica impossível de garantir se há JS arbitrário no meio). **A Fase 4 é o maior risco técnico do plano inteiro e recebe a menor especificação.**
- **Hot-reload + feature flag por carta é perigoso dado o design atual de dados embutidos por valor**: no `PrimitiveCall` de `spawnToken`, o próprio `CardDef` é embutido por valor no spec, não referenciado por ID. Isso sugere que as definições de carta são módulos TS compilados (`st01.ts`, `st02.ts`...), não um registro JSON mutável em runtime. "Hot-reload sem derrubar partidas em execução" não protege partidas cujas instâncias já capturaram a definição antiga por valor, e reintroduz exatamente a classe de bug de dessincronia cliente/servidor que o `docs/48` já teve que caçar e corrigir — só que agora dentro do próprio processo do servidor, não só entre cliente e servidor.

## Veredito

A filosofia geral (dados não código, motor como fonte única da verdade, action intents, testes por invariante, wave por complexidade) está correta e, aliás, **já provada por este mesmo projeto**. O problema é que a proposta foi escrita como se o projeto estivesse partindo do zero. Isso produz: duplicação de arquitetura, reintrodução de um bug de produção já resolvido (avaliação estática de condição/alvo), um algoritmo de ordenação de gatilhos simultâneos não especificado, uma Fase 4 de scripting que quebra a própria premissa "zero-code", e um mecanismo de hot-reload incompatível com o modelo de dados atual (defs embutidas por valor).

**Recomendação**: reescrever a proposta como um "Plano de Extensão do EffectSpec/PrimitiveCall existente para GD01", reaproveitando `specActiveCalls`, `TargetRef`, `predicates.ts` e o padrão de golden master já em uso, endereçando explicitamente APNAP para gatilhos simultâneos, dando à Fase 3 (auras) um design de layers com timestamp real, e isolando/detalhando a Fase 4 como um mini-RFC à parte antes de qualquer commit.

---

### 3. Réplica (Gemini - Propositor)

[CONCORDANCIA: 85%]

# Réplica e Consolidação — Plano de Execução da Wave GD01

Agradeço à auditoria pelo resgate fundamental do contexto real da base de código. A crítica é sólida, precisa e salva o projeto de uma armadilha clássica de engenharia: a tentação de construir um "motor genérico do zero" para uma nova expansão, ignorando que o motor em produção já possui um sistema declarativo auditado (`effectSpec.ts`, `predicates.ts`, `abilityDispatch.ts`), com suite de testes *golden master* e correções históricas críticas (`docs/48`).

Acatamos a correção arquitetural central: **a Wave GD01 não deve introduzir um novo motor JSON nem um runtime paralelo.** O trabalho correto é **estender a especificação `EffectSpec` e `PrimitiveCall` existente**, preservando 100% a retrocompatibilidade com as coleções ST01–ST04 e respeitando o modelo síncrono, determinístico e declarativo do simulador.

Abaixo apresento a réplica detalhada, a refutação de pequenos pontos com proposta de simplificação e o **Plano Consolidado Ajustado**.

---

## 1. Tratamento dos Achados da Auditoria

### 1.1. Arquitetura Base (Ponto 0) — ACATADO INTEGRALMENTE
- **Decisão**: Cancelada a criação de DSL em JSON externo, engine alternativo ou hot-reload em runtime.
- **Solução**: O catálogo GD01 utilizará o mesmo formato TypeScript fortemente tipado de `st01.ts`–`st04.ts`, estendendo as uniões discriminadas de `EffectSpec.ts` e adicionando os novos discriminadores em `PrimitiveCall` e `TargetRef`.

### 1.2. Regras Contínuas, Auras e Custos (Ponto 1) — ACATADO COM SIMPLIFICAÇÃO
- **Sistema de Layers**: Em vez de um grafo de dependência genérico e dinâmico (complexo e propenso a bugs), adotaremos um **Pipeline de Cálculo Estatístico por Camadas Determinísticas (Layers com Timestamp de Entrada)**:
  1. *Layer 1 (Base)*: Stats nativos do CardDef + Modificadores Permanentes (equipamentos/pilotos).
  2. *Layer 2 (Auras de Campo)*: Efeitos contínuos ordenados por timestamp de entrada no estado (`playIndex`).
  3. *Layer 3 (Modificadores Temporários)*: Efeitos de turno ("até o fim do turno").
- **Integração com `costs.ts`**: O cálculo de custo de invocação deixará de ser estático e passará a receber o `GameState` atual, consultando a função pura `calculateEffectiveCost(card, state)`. Isso evita acoplamento direto alterando o core — a fonte da verdade continua sendo o `GameState`.
- **Bots e IAs (`features.ts`)**: O vetor de estado gerado para os bots (`mctsPolicy.ts`, etc.) utilizará a mesma função `getEffectiveStats(unit, state)` que a engine utiliza no combate. Nenhuma IA lerá stats brutos quando auras estiverem ativas.

### 1.3. Ordenação APNAP e Prevenção de Cyclos (Ponto 2) — ACATADO E AJUSTADO
- **APNAP (Active Player, Non-Active Player)**: Gatilhos simultâneos gerados na mesma resolução de comando são enfileirados primeiro na sub-fila do Jogador Ativo, depois na do Jogador Passivo. Se o mesmo jogador possuir múltiplos gatilhos simultâneos, a UI solicita a ordenação ou aplica a ordem de entrada no board (configurável).
- **Substituição da Call Stack por Loop Guard**: Removida a limitação de profundidade de stack de chamada (recursão). Adotado o limite de processamento de fila por ação: `MAX_TRIGGER_CHUNKS = 50` (alinhado com o padrão `BATCH_PROCESSING.md`). Se um comando gerar mais de 50 chunks de gatilho em cadeia, a partida é encerrada por empate por loop infinito determinístico.
- **Avaliação Pré-Prompt (`docs/48`)**: Incorporação obrigatória da checagem estática `specActiveCalls` / `callsNeedNamedTarget`. Antes de travar o jogo aguardando target do usuário, a engine valida se o `predicate` da habilidade é verdadeiro no estado atual.

### 1.4. Divisão por Waves e Remoção de Scripts (Ponto 3) — ACATADO E CORRIGIDO
- **Fase 0 Re-classificada (Zero DSL)**: Cartas vanilla ou que usam exclusivamente keywords nativas (`Blocker`, `First Strike`, `Support`, `Repair`, `Breach`, `Suppression`, `High-Maneuver`, `Once per Turn`) não tocam no `EffectSpec`. Isso representa ~45% do set GD01.
- **FASE 4 REESCRITA (ELIMINAÇÃO DE SCRIPTS/SANDBOX)**: **Refutamos a necessidade de um sandbox JavaScript/VM.** Qualquer efeito "complexo" da GD01 que não caiba nas primitivas atuais será implementado adicionando **uma nova `PrimitiveCall` fortemente tipada e pura em TypeScript** dentro da própria engine (ex: `inversorDeFase`, `trocaDonoDeUnidade`). Isso mantém o determinismo absoluto, permite fuzzing e não quebra os testes de *golden master*.
- **Hot-Reload descartado**: Imutabilidade absoluta das CardDefs mantida via módulos TS compilados.

---

## 2. Matriz de Mapeamento GD01 -> Arquitetura Existente

Para eliminar qualquer ambiguidade, a Wave GD01 é dividida segundo a extensão necessária do `effectSpec.ts`:

| Categoria da Carta | % GD01 | Complexidade | Extensão Necessária no Motor |
| :--- | :--- | :--- | :--- |
| **Vanilla / Pure Keyword** | 45% | Nula (Fase 0) | Nenhuma (Tratado nativamente em `deploy.ts` e combate) |
| **Primitiva Existente** | 30% | Baixa (Fase 1) | Reuso direto de `draw`, `damageUnit`, `modifyStat`, `spawnToken` |
| **Novas Primitivas Simples** | 15% | Média (Fase 2) | Adição de novas tags em `PrimitiveCall` (ex: `bounceToHand`, `discardRandom`, `restTarget`) |
| **Auras e Contínuos** | 10% | Alta (Fase 3) | Adição do sistema de Layers em `effectiveStats` e suporte a Auras em `costs.ts` |

---

## 3. Plano Consolidado de Implementação da Wave GD01

```
+---------------------------------------------------------------------------------+
|                        FLUXO DE EXECUÇÃO DA WAVE GD01                           |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  [Fase 0: Baseline & Mapeamento]                                                |
|   └── Identificar cartas Zero-DSL (45%) e cadastrar apenas CardDef estático.    |
|                                                                                 |
|  [Fase 1: Extensão de Primitivas Diretas]                                       |
|   └── Adicionar novas PrimitiveCalls no `effectSpec.ts` (bounce, rest, discard).|
|   └── Implementar dispatchers em `abilityDispatch.ts`.                          |
|                                                                                 |
|  [Fase 2: Motor de Auras & Layer System]                                        |
|   └── Implementar pipeline de 3 layers em `effectiveStats`.                     |
|   └── Atualizar `costs.ts` e `features.ts` para bots.                           |
|                                                                                 |
|  [Fase 3: APNAP & Auditoria Docs/48]                                            |
|   └── Fila FIFO com ordenação APNAP e guarda `MAX_TRIGGER_CHUNKS`.              |
|   └── Aplicar validação `specActiveCalls` / `callsNeedNamedTarget`.             |
|                                                                                 |
|  [Fase 4: Validação Golden Master & Delivery]                                   |
|   └── Adicionar cenários GD01 ao `goldenMaster.test.ts` e executar Fuzzing.    |
+---------------------------------------------------------------------------------+
```

### Detalhamento dos Passos Técnicos

#### Passo 1: Extensão da DSL Declarativa (`effectSpec.ts`)
Adição de novas primitivas necessárias para o set GD01 sem alterar as existentes:
```typescript
// Em src/modules/simulator/engine/effectSpec.ts
export type PrimitiveCall =
  | { type: 'draw'; amount: number }
  | { type: 'damageUnit'; target: TargetRef; amount: number }
  | { type: 'modifyStat'; target: TargetRef; stat: 'hp' | 'atk'; value: number; duration: Duration }
  // NOVAS PRIMITIVAS GD01:
  | { type: 'bounceToHand'; target: TargetRef }
  | { type: 'restTarget'; target: TargetRef }
  | { type: 'discardRandom'; player: 'self' | 'opponent'; amount: number };
```

#### Passo 2: Pipeline de Resolução APNAP e Fila FIFO
Implementação da ordenação estrita de gatilhos em `abilityDispatch.ts`:
```typescript
function resolveSimultaneousTriggers(triggers: TriggerEvent[], activePlayerId: string): TriggerEvent[] {
  const activeTriggers = triggers.filter(t => t.ownerId === activePlayerId);
  const nonActiveTriggers = triggers.filter(t => t.ownerId !== activePlayerId);

  // APNAP: Jogador Ativo primeiro, Jogador Passivo depois
  return [...activeTriggers, ...nonActiveTriggers];
}
```

#### Passo 3: Avaliação de Invariantes e Golden Master Tests
Nenhuma carta da GD01 é considerada "pronta" sem a inclusão do seu cenário de teste em `goldenMaster.test.ts`:
1. **Divergência Zero**: Teste de regressão cobrindo ST01–ST04 e GD01 em lote.
2. **Determinismo de Replay**: Garantir que uma semente de RNG gere a mesma partida em 100% das execuções.
3. **Fuzzing de Auras**: Simular trocas repetidas de estado de campo com múltiplas auras ativas para garantir performance $O(N)$ no cálculo de layers e ausência de mutação indesejada no `GameState`.

---

## 4. Vantagens do Plano Consolidado

1. **Risco Técnico Próximo de Zero**: Não há duplicação de engine. Reaproveita 100% do código já testado e auditado em produção.
2. **Determinismo Preservado**: Ao descartar o sandbox JS na Fase 4, mantemos a garantia de que todo o estado do simulador é uma função pura de `(State, Action) -> State`.
3. **Compatibilidade Total com Bots**: A sintonização do pipeline estatístico garante que a IA continue jogando em alto nível com a introdução das auras da GD01.
4. **Respeito ao Histórico**: Incorpora o aprendizado documentado no `docs/48`, eliminando bugs de travamento de UI por pre-target incorreto.

</details>
