# Debate Técnico: Verificar a integracao real da Fase 0 (higiene/testes) e Fase 1 (rollout GD01) ja commitadas juntas (commit ae8b247, branch feature/wave-gd01, ainda NAO mergeado em dev/main), atualizar as checklists de implementacao do projeto (gd01.manifest.json + AI_GUIDE.md), e elaborar os PROXIMOS PASSOS pra resolver as pendencias que sobraram. ESCOPO EXPLICITO: implementacao de OUTROS PRODUTOS/colecoes (GD02, GD03, GD04, GD05, EB01, ST05-10) fica DE FORA deste debate — só GD01 (o produto ja em andamento) entra.

CONTEXTO FACTUAL VERIFICADO NESTA SESSAO (nao especular alem disto):

== O QUE FOI COMMITADO (commit ae8b247) ==
- Motor: MAX_CASCADE_DEPTH=12/MAX_QUEUE_BREADTH=150/TriggerLoopException (abilityDispatch.ts/dispatcher.ts), substituindo o antigo MAX_DESTROYED_CHAIN.
- Governanca: content/primitives-claims.json (65 entradas) + gate automatico em scripts/gundam-coverage.mjs (exit 1 se algo novo nao registrado).
- Testkit: engine/__testkit__/cardHarness.ts (placeCard), adotado em gd01.test.ts E em st01-04.test.ts.
- Conteudo GD01: content/gd01.ts (130 CardDefs, 62 com EffectSpec real = 60 implementada + 2 implementada*), deferred.ts com 42 entradas de clausula cobrindo 40 cartas em status "deferida" (zero cobertura) + as 2 cartas implementada* citadas acima.
- Rollout Fase 1: server/deckCoverageGate.ts (validateDeckPayload, aplicado em queue/join, training/new E no endpoint de debug hoster-only), fixtures/gd01TestDecks.ts (4 decks: GD01-FED branco/azul, GD01-ZEON verde/vermelho, GD01-NEWTYPE azul/verde, GD01-SLEEVES vermelho/branco — cada um SO com as 90 cartas seguras), ENABLE_GD01_ONLINE (env var, protege só Fila Online/Convite Direto — Treino Solo libera GD01 incondicionalmente, sempre atras do deckCoverageGate), DECK_OPTIONS em SimulatorSandboxPage.tsx com badge "BETA · PARCIAL".
- Correcoes de Fase 0 que TAMBEM entraram no commit (aparentemente feitas em paralelo por outro agente/sessao, ja que eu não as fiz e elas nao apareciam no git status no inicio desta sessao): scripts/gundam-golden.test.mjs atualizado de "10 pares" pra "15 pares" (hardcoded, nao dinamico — ver achado abaixo); scripts/mcp-gundam/similar-specs.mjs ganhou n-gramas novos (in your trash, all friendly units, repair, suppression, etc.) que aparentemente resolveram o teste src/lib/similar-specs-client.test.ts.

== VERIFICACAO DE INTEGRACAO FEITA NESTA SESSAO (resultados reais, agora) ==
1. `npx vitest run` (suite completa) — 105 arquivos, 972/972 testes passando, 0 falhas. Rodei 2x pra confirmar (mesmo resultado as 2 vezes).
2. `pnpm tsc --noEmit` — limpo.
3. Fuzz DEDICADO aos 4 decks GD01-FED/ZEON/NEWTYPE/SLEEVES (script ad-hoc usando runSelfPlay direto, heuristicPolicy nos dois lados, maxTurns=200): 10 pares (todas as combinacoes incluindo espelho), 500 partidas cada = 5000 partidas totais. Resultado: 0 achados (throw/crash/illegalState/unfinished), trigger_loop_guard acionado 0 vezes. Ou seja, os decks jogaveis novos SAO estaveis e o guard nunca precisou disparar contra eles.

== PENDENCIAS/GAPS REAIS ENCONTRADOS NESTA VERIFICACAO (novos achados, nao repetir os ja fechados) ==
A. `gd01.manifest.json` esta DESATUALIZADO em relacao ao trabalho ja commitado: `status` ainda diz "PHASE_2_IN_PROGRESS", `pipeline_progress.phase2_claude_core.completed` ainda `false` (mas o conteudo de 62 cartas + testes JA esta commitado), `pipeline_progress.phase3b_fuzz_golden.completed` ainda `false` (mas ja existe golden master GD01_vs_GD01_seed15 commitado E o fuzz de 5000 partidas rodado agora). Nao existe nenhum campo no manifest sobre a Fase 1 (rollout: fixtures/gate/UI/kill-switch) que acabou de ser commitada.
B. NAO existe em nenhum lugar do repositorio (AI_GUIDE.md secao 6 "Checklists de Execucao Atomica") uma "Frente" dedicada a Wave GD01 — as unicas Frentes catalogadas la sao 1 (Deckbuilder/Feedback), 2 (Traducao PT-BR), 3 (ST03/ST04), 4 (Visual/UX) e 5 (WebSocket). Todo o trabalho de GD01 (motor, governanca, rollout) nao tem checklist nenhuma nesse arquivo, que é onde o projeto historicamente registra progresso "atomico" por frente.
C. O item de Fase 0 "fuzzing focado no incidente de travamento de 4h, 2000+ partidas no PAR DE DECKS EXATO do incidente" continua SEM EVIDENCIA de ter sido executado — nao existe `scripts/__fuzz_regressions__/` (diretorio proposto no debate anterior pra persistir achados, tambem nunca criado) nem nenhum relatorio/log commitado. O fuzz de 5000 partidas que RODEI agora foi contra os 4 decks NOVOS (GD01-FED/ZEON/NEWTYPE/SLEEVES), que nao sao necessariamente o deck usado no incidente manual original (esse deck original é desconhecido — pode ter usado cartas do conjunto "deferida", que meus decks de teste excluem de proposito). Ou seja: a causa raiz do incidente de 4h continua tecnicamente NAO CONFIRMADA por reproducao direta, so mitigada pelo guard (que e suficiente pra produzir seguranca, mas nao fecha o mistério "o que EXATAMENTE travou").
D. `scripts/gundam-golden.test.mjs` foi corrigido trocando o numero hardcoded de "10" pra "15" — mas continua sendo um NUMERO LITERAL na asserção do teste (`expect(out).toContain("15 pares conferem")`), nao algo calculado dinamicamente a partir de `hashes.json`. Na proxima vez que uma wave nova adicionar um par ao golden master, esse teste vai quebrar de novo pelo MESMO motivo (numero fixo desatualizado) — o mesmo padrao de bug que ja aconteceu 1 vez nesta wave.
E. As 40 cartas "deferida" de GD01 continuam bloqueadas pelos mesmos 10 gaps de motor documentados em deferred.ts (aura-concessao-keyword-grupo, target-scope-qualquer-lado, escolha-de-ate-n-alvos, busca-lixeira-para-mao, custo-dinamico-na-mao, deploy-alternativo-sacrificio, reciclagem-lixeira-deck, static-ability-condicao-generica, aura-piloto-condicional, target-group-todas-as-units-dos-2-lados) — nenhum gap foi fechado nesta sessao (o trabalho desta sessao foi 100% resiliencia/governanca/rollout, nao autoria de efeito).
F. O branch `feature/wave-gd01` continua SEM merge pra `dev`/`main` — todo o trabalho (motor+conteudo+rollout) so existe local/remoto nesta feature branch.

O QUE PRECISA SAIR DESTE DEBATE:
1. Claude deve VERIFICAR (nao so aceitar) que Fase 0 e Fase 1 realmente integram sem conflito — usar os resultados acima (suite verde, fuzz de 5000 partidas, tsc limpo) como evidencia, mas tambem procurar ativamente por qualquer INTERACAO NAO OBVIA entre as mudancas de Fase 0 (ex: mudancas no similar-specs.mjs, no golden test) e as de Fase 1 (deckCoverageGate, gd01TestDecks) que eu possa ter deixado passar.
2. Produzir o CONTEUDO ATUALIZADO exato de `gd01.manifest.json` (novo JSON completo, refletindo o estado real: Fase 2 conteudo commitado, Fase 3B fuzz/golden com dados reais, Fase 1 rollout como novo campo) e de uma nova secao "### Frente 6: Wave GD01 — Motor, Governanca e Rollout Parcial (Branch: feature/wave-gd01)" pra `AI_GUIDE.md` secao 6, no MESMO formato/estilo das Frentes 1-5 ja existentes (checklist com [x]/[ ] e nota de commit).
3. Elaborar os PROXIMOS PASSOS, SO PRA GD01 (nada de GD02+/EB01/ST05-10 — isso fica de fora por instrucao explicita do usuario), cobrindo pelo menos: (i) o que fazer com o mistério nao resolvido do item C acima (vale a pena mais investigacao, ou aceitar o guard como mitigacao suficiente e seguir em frente?); (ii) corrigir o gundam-golden.test.mjs pra nao quebrar de novo (item D) — tornar a asserção dinamica; (iii) ordem de ataque dos 10 gaps de motor que faltam pra fechar as 40 cartas deferidas (Fase 2 real: qual gap primeiro, por que, quantas cartas cada gap desbloqueia); (iv) quando/como fazer o merge de feature/wave-gd01 pra dev (pre-requisitos, o que falta rodar/confirmar antes).
4. Gemini audita: aponta se a verificacao do Claude foi rigorosa o bastante (ex: 5000 partidas com heuristicPolicy dos dois lados e representativo o bastante, ou falta testar com policy=random/mcts tambem; se falta considerar algum caso de borda na integracao Fase0+Fase1), e se a priorizacao dos 10 gaps de motor faz sentido (quais gaps sao reaproveitados por mais cartas, quais sao mais simples de implementar primeiro dado o que ja existe no motor).
5. Documento final: JSON atualizado do manifest + markdown da nova Frente 6 pro AI_GUIDE.md + lista priorizada dos proximos passos com estimativa de esforco relativo (poucas horas / dias) pra cada item.

- **Data:** 13/09/2026, 13:13:04
- **Iniciador:** CLAUDE
- **Propositor:** Claude
- **Auditor Crítico:** Gemini
- **Status:** Consenso Antecipado (>= 85%)
- **Índice de Concordância:** 90%
- **Turnos Executados:** 2 de 4

---

# Síntese do Debate Técnico: Integração GD01 (Fase 0 + Fase 1), Governança e Próximos Passos

**Tema:** Integração real do commit `ae8b247` (`feature/wave-gd01`), atualização do `gd01.manifest.json` e `AI_GUIDE.md`, e sequenciamento dos próximos passos exclusivos para a Wave GD01.  
**Participantes:** Claude (Propositor) & Gemini (Auditor Crítico)  
**Sintetizador:** Analista Sênior / Compilador Oficial  
**Taxa de Concordância:** 90% (Consenso atingido no 2º turno)

---

## [Pontos de Acordo]

1. **Estabilidade e Integração Factual do Commit `ae8b247`:**
   - A suíte de testes de integração (`972/972` passando em 2 execuções consecutivas) e a checagem do TypeScript (`tsc --noEmit` limpo) confirmam que as melhorias do motor da Fase 0 (`MAX_CASCADE_DEPTH=12`, `MAX_QUEUE_BREADTH=150`, `TriggerLoopException`) e as adições de conteúdo/rollout da Fase 1 integram sem conflitos sintáticos ou de runtime no pool atual.
   - O Fuzzing de 5.000 partidas rodado contra os 4 decks de rollout (`GD01-FED`, `GD01-ZEON`, `GD01-NEWTYPE`, `GD01-SLEEVES`) não gerou nenhum crash, estado ilegal ou disparo indevido do guard.

2. **Mitigação do Incidente de 4h vs. Investigação Forense:**
   - Recriar e investigar retroativamente o deck exato do incidente de 4h é inviável e pouco produtivo, visto que o deck original é desconhecido. O mecanismo de interrupção de loop (`TriggerLoopException` com `reason: "trigger_loop_guard"`) é suficiente do ponto de vista de infraestrutura para evitar travamentos do Node.js.

3. **Correção do Teste Golden Master (`gundam-golden.test.mjs`):**
   - A asserção hardcoded `"15 pares conferem"` é frágil e quebrará no próximo par adicionado ao golden master. O teste deve ser corrigido para calcular o número de pares dinamicamente a partir das chaves do arquivo `hashes.json`.

4. **Status e Governança dos Documentos:**
   - O `gd01.manifest.json` deve ser promovido para `PHASE_4_ROLLOUT_PARTIAL`, com a taxonomia de blockers atualizada para os **28 blockers reais** mapeados em `deferred.ts` (substituindo a estimativa antiga de 10 tags).
   - O `AI_GUIDE.md` (Seção 6) deve incorporar a **Frente 6: Wave GD01 — Motor, Governança e Rollout Parcial (Branch: `feature/wave-gd01`)** no formato exato de checklist padronizado das Frentes 1–5.

5. **Estratégia de Rollout e Fila Online:**
   - Manter a variável `ENABLE_GD01_ONLINE` desativada por padrão em produção até que os maiores gaps de motor sejam fechados, garantindo que o público de PvP ranqueado só acesse GD01 quando a cobertura de efeitos estiver mais ampla.

---

## [Divergências e Riscos]

1. **Risco de Fuzzing Estrito / Vulnerabilidade de Empate Forçado (Forced Draw Exploit):**
   - *Apontamento do Gemini:* O fuzzing com 5.000 partidas utilizando `heuristicPolicy` vs `heuristicPolicy` é totalmente determinístico e guloso. A heurística toma apenas decisões ótimas e padronizadas. Se existir um loop de gatilhos acionado por uma jogada sub-ótima ou não convencional, a heurística nunca irá descobri-lo.
   - *Impacto:* Um jogador no PvP online poderia acionar um loop intencional com jogadas não-heurísticas para forçar um empate (`winner: null`) via `TriggerLoopException` sempre que estivesse prestes a perder.
   - *Mitigação Acordada:* Executar baterias de fuzzing exploratório utilizando **`heuristicPolicy` vs `randomLegal`** e **`mctsPolicy`**.

2. **Vulnerabilidade no `deckCoverageGate.ts` (Edge Cases & Falta de Testes):**
   - *Apontamento do Claude & Gemini:* O `deckCoverageGate.ts` não possui nenhum teste unitário automatizado. Além disso, se uma requisição manipulada enviar um `cardCode` inexistente ou de outra wave (ex: `GD01-999` ou `GD02-001`), o gate poderia tratar a carta por padrão como "vanilla sem efeito" se dependesse apenas da lista de deferidas.
   - *Mitigação Acordada:* Criar `server/deckCoverageGate.test.ts` garantindo validação positiva estrita (a carta DEVE pertencer ao registro de cartas válidas do jogo e não ser deferida).

3. **Risco Arquitetural nas Auras de Pilotos vs. Habilidades Estáticas:**
   - *Ressalva do Gemini sobre a proposta do Claude:* Claude sugeriu unificar os gaps de `static-ability-keyword-condicao-generica`, `aura-piloto-condicional` e `static-ability-condicao-generica` sob um mesmo resolver de predicados em `StaticAbility`. Gemini alertou que as Auras de Piloto dependem do ciclo de vida da relação `pairedWith`. Se o piloto for destruído, enviado à lixeira ou despareado (bounce), a aura DEVE cessar imediatamente.
   - *Mitigação Acordada:* O resolver de `StaticAbility` reusará a infraestrutura de predicados de `predicates.ts`, mas verificará explicitamente se o vínculo `pairedWith !== null` está ativo no momento da concessão do bônus de piloto.

---

## [Proposta de Planejamento/Ajuste]

### Plano Sequenciado de Execução (Focado exclusivamente em GD01)

#### Etapa 1: Endurecimento Pré-Merge em `dev` (Estimativa: ~1 dia)
1. **Fix do Golden Test:** Alterar `scripts/gundam-golden.test.mjs` para validar dinamicamente a contagem de pares via `Object.keys(readHashes()).length`.
2. **Testes do Gate de Deck:** Criar `server/deckCoverageGate.test.ts` cobrindo:
   - Decks válidos (somente cartas do pool jogável de 90 cartas GD01).
   - Decks contendo cartas presentes em `DEFERRED_CLAUSES` (devem retornar HTTP 400 + `unplayableCards`).
   - Decks contendo códigos de cartas inexistentes ou desconhecidos.
3. **Fuzzing Estocástico & Regressões:** Criar o diretório `scripts/__fuzz_regressions__/` e executar bateria de fuzzing `heuristic` vs `randomLegal` (500 partidas) para garantir resiliência a jogadas não-convencionais.
4. **Validação UI/Navegador:** Confirmar manualmente a exibição do badge "BETA · PARCIAL" na Sandbox/Treino Solo.
5. **Merge PR:** Finalizar merge do branch `feature/wave-gd01` para `dev`.

#### Etapa 2: Ataque aos Gaps de Motor das 40 Cartas Deferidas (Estimativa: ~3 a 4 dias)
Ordem priorizada por relação impacto/esforço:

1. **Lote 1 — Escopos e Grupos de Ambos os Lados (Desbloqueia 6 cartas | Esforço: ~3-4h):**
   - Expandir `TargetScope` e `TargetGroup.kind` para suportar `{ enemy, friendly, both }` em `target-scope-qualquer-lado` e `target-group-todas-as-units-dos-2-lados`.
   - *Cartas salvas:* GD01-014, GD01-024, GD01-027, GD01-058, GD01-108, GD01-110.

2. **Lote 2 — Filtro Composto de Busca no Topo do Deck (Desbloqueia 2 cartas | Esforço: ~3-4h):**
   - Estender `lookAtTopFilterReveal` para aceitar múltiplos traits com operador lógico OR.
   - *Cartas salvas:* GD01-048, GD01-109.

3. **Lote 3 — Unificação de Predicados Estáticos e Auras de Piloto (Desbloqueia 9 cartas | Esforço: ~1-2 dias):**
   - Conectar o resolver de predicados (`predicates.ts`) ao campo `condition` de `StaticAbility`.
   - Implementar payload de concessão `grant: { type: "keyword", value } | { type: "stat", ap?, hp? }`.
   - Adicionar checagem rigorosa do ciclo de vida de pareamento (`pairedWith !== null`) para Auras de Piloto.
   - *Cartas salvas:* GD01-019, GD01-034, GD01-054, GD01-076, GD01-081, GD01-087, GD01-089, GD01-092, GD01-096.

4. **Lote 4 — Escolha de Até N Alvos (Desbloqueia 3 cartas | Esforço: ~1 dia):**
   - Expandir a camada de decisão (`ChoicePrimitive` / `PendingDecision`) para permitir contagem ajustável/máxima de alvos em `escolha-de-ate-n-alvos`.
   - *Cartas salvas:* GD01-044, GD01-112, GD01-114.

5. **Lote 5 — Gaps Específicos/Bespoke (20 cartas restantes):**
   - Avaliar caso a caso usando RAG (`similar-specs.mjs`) para determinar se o padrão se repete em coleções futuras antes de implementar motores sob medida para apenas 1 carta.

---

## [Documento MD com Informativo, Checklist e Prompts de Automação]

### 1. Conteúdo Completo Atualizado de `gd01.manifest.json`

```json
{
  "wave_id": "GD01",
  "name": "Newtype Rising",
  "status": "PHASE_4_ROLLOUT_PARTIAL",
  "total_cards": 130,
  "metrics": {
    "vanilla_cards": 28,
    "implemented_cards": 60,
    "implemented_with_deferred_clause": 2,
    "deferred_pure_cards": 40,
    "deferred_clauses": 42,
    "playable_cards_total": 90
  },
  "pipeline_progress": {
    "phase1_gemini_draft": {
      "completed": true,
      "agent": "gemini-3.8-flash",
      "timestamp": "2026-09-12T17:23:00Z"
    },
    "phase2_claude_core": {
      "completed": true,
      "agent": "claude-code",
      "commit": "ae8b247",
      "notes": "Revalidação carta a carta: corrigidos bugs de autoria da Fase 1, 2 cláusulas de GD01-001/GD01-066 re-rastreadas, e motor estendido para filtros e predicados compostos. 62/130 cartas jogáveis com cobertura real; 42 cláusulas seguem deferidas com razão específica."
    },
    "phase3a_rag_index": {
      "completed": true,
      "agent": "gemini-3.8-flash",
      "timestamp": "2026-09-12T18:37:00Z",
      "signatures_indexed": 147
    },
    "phase3b_fuzz_golden": {
      "completed": true,
      "agent": "claude-code",
      "commit": "ae8b247",
      "golden_master": {
        "pair_added": "GD01_vs_GD01_seed15",
        "total_pairs": 15,
        "status": "verde, determinístico"
      },
      "fuzz_new_decks": {
        "decks": ["GD01-FED", "GD01-ZEON", "GD01-NEWTYPE", "GD01-SLEEVES"],
        "pairs": 10,
        "games_per_pair": 500,
        "total_games": 5000,
        "policy": "heuristicPolicy vs heuristicPolicy",
        "max_turns": 200,
        "findings": 0,
        "trigger_loop_guard_triggers": 0
      },
      "incident_root_cause_repro": {
        "status": "NAO_CONFIRMADA",
        "note": "Guard MAX_CASCADE_DEPTH/MAX_QUEUE_BREADTH mitiga loops. Reprodução direta do deck do incidente descontinuada em favor do guard."
      }
    },
    "phase4_rollout_partial": {
      "completed": "partial",
      "agent": "claude-code",
      "commit": "ae8b247",
      "branch": "feature/wave-gd01",
      "merged_to_dev": false,
      "notes": "server/deckCoverageGate.ts plugado em queue/join, training/new e debug. fixtures/gd01TestDecks.ts com 4 decks válidos (90 cartas seguras). ENABLE_GD01_ONLINE (env var) protege Fila Online. UI com badge BETA · PARCIAL em SimulatorSandboxPage.tsx."
    }
  },
  "deferred_summary": {
    "total_clauses": 42,
    "unique_engine_blockers": 28,
    "blockers_by_cards_unlocked": [
      { "tag": "engine:static-ability-keyword-condicao-generica", "cards": ["GD01-019", "GD01-034", "GD01-054", "GD01-081"] },
      { "tag": "engine:aura-piloto-condicional", "cards": ["GD01-087", "GD01-089", "GD01-092", "GD01-096"] },
      { "tag": "engine:target-group-todas-as-units-dos-2-lados", "cards": ["GD01-024", "GD01-027", "GD01-108"] },
      { "tag": "engine:target-scope-qualquer-lado", "cards": ["GD01-014", "GD01-058", "GD01-110"] },
      { "tag": "engine:escolha-de-ate-n-alvos", "cards": ["GD01-044", "GD01-112", "GD01-114"] },
      { "tag": "engine:custo-dinamico-na-mao", "cards": ["GD01-016", "GD01-070"] },
      { "tag": "engine:busca-topo-deck-filtro-especifico", "cards": ["GD01-048", "GD01-109"] },
      { "tag": "engine:static-ability-condicao-generica", "cards": ["GD01-076"] },
      { "tag": "engine:aura-concessao-keyword-grupo", "cards": ["GD01-001"] },
      { "tag": "engine:deploy-alternativo-sacrificio", "cards": ["GD01-002"] },
      { "tag": "engine:reciclagem-lixeira-deck", "cards": ["GD01-003"] },
      { "tag": "engine:during-link-e-alvo-implicito-pos-destroy", "cards": ["GD01-005"] },
      { "tag": "engine:busca-lixeira-e-pareamento-por-efeito", "cards": ["GD01-023"] },
      { "tag": "engine:escolha-de-posicao-para-1-carta-revelada", "cards": ["GD01-039"] },
      { "tag": "engine:relaxamento-alvo-por-ap-nao-so-nivel", "cards": ["GD01-043"] },
      { "tag": "engine:deploy-direto-do-topo-do-deck", "cards": ["GD01-045"] },
      { "tag": "engine:gatilho-por-uso-de-keyword", "cards": ["GD01-046"] },
      { "tag": "engine:keyword-condicional-a-combate-especifico", "cards": ["GD01-063"] },
      { "tag": "engine:gatilho-por-evento-de-pareamento", "cards": ["GD01-065"] },
      { "tag": "engine:atacar-no-turno-do-deploy-fora-de-link", "cards": ["GD01-066"] },
      { "tag": "engine:busca-lixeira-para-mao", "cards": ["GD01-067"] },
      { "tag": "engine:imunidade-a-reducao-de-stat", "cards": ["GD01-090"] },
      { "tag": "engine:protecao-continua-condicional", "cards": ["GD01-091"] },
      { "tag": "engine:target-filter-relativo-a-propria-carta", "cards": ["GD01-093"] },
      { "tag": "engine:combat-trigger-filtro-link-unit", "cards": ["GD01-094"] },
      { "tag": "engine:condicional-a-resultado-de-primitiva-anterior", "cards": ["GD01-095"] },
      { "tag": "engine:multiplos-escopos-de-alvo-no-mesmo-spec", "cards": ["GD01-103"] },
      { "tag": "engine:filtro-alvo-condicional", "cards": ["GD01-122"] }
    ]
  },
  "known_gaps": {
    "test_coverage": ["server/deckCoverageGate.ts sem teste dedicado (a ser corrigido na Etapa 1)"],
    "tech_debt": ["scripts/gundam-golden.test.mjs com asserção hardcoded de pares (a ser corrigido na Etapa 1)"]
  }
}
```

---

### 2. Nova Seção para `AI_GUIDE.md` (§ 6 - Frente 6)

```markdown
### Frente 6: Wave GD01 — Motor, Governança e Rollout Parcial (Branch: `feature/wave-gd01`)
- [x] Endurecer o motor contra travamentos por loop de gatilhos: `MAX_CASCADE_DEPTH=12`/`MAX_QUEUE_BREADTH=150` + `TriggerLoopException` (`abilityDispatch.ts`, `dispatcher.ts`) substituem `MAX_DESTROYED_CHAIN`; `GameOverInfo` registra `reason: "trigger_loop_guard"` para empate seguro.
- [x] Governança de vocabulário de efeitos: `content/primitives-claims.json` (65 entradas registradas) + gate automático em `scripts/gundam-coverage.mjs` (exit 1 se não registrado).
- [x] Testkit compartilhado: `engine/__testkit__/cardHarness.ts` (`placeCard`), adotado em `gd01.test.ts` e `st01-04.test.ts`.
- [x] Conteúdo GD01 (Fase 2): `content/gd01.ts` (130 CardDefs, 62 jogáveis: 60 EffectSpec + 2 implementada*), `content/deferred.ts` (42 cláusulas com razões específicas de deferimento), Golden Master `GD01_vs_GD01_seed15` adicionado (15 pares totais).
- [x] Rollout Fase 1: `server/deckCoverageGate.ts` (`validateDeckPayload`) ativado em `queue/join`, `training/new` e debug endpoint. `fixtures/gd01TestDecks.ts` com 4 decks seguros (FED/ZEON/NEWTYPE/SLEEVES, 90 cartas liberadas).
- [x] Proteção e UI: `ENABLE_GD01_ONLINE` protege a Fila Online; Treino Solo liberado com gate. `SimulatorSandboxPage.tsx` ganha badge "BETA · PARCIAL".
- [x] Verificação de Integração (2026-09-13): Suíte Vitest 972/972 verde, `tsc --noEmit` limpo, fuzzing de 5.000 partidas nos decks novos sem achados/crashes.
- [ ] **Ação pendente (Etapa 1):** Adicionar suíte dedicada de testes unitários para `server/deckCoverageGate.ts` (incluindo validação contra cartas inexistentes/desconhecidas).
- [ ] **Ação pendente (Etapa 1):** Tornar dinâmica a asserção de pares em `scripts/gundam-golden.test.mjs` lendo a quantidade de chaves de `hashes.json`.
- [ ] **Ação pendente (Etapa 1):** Executar fuzzing estocástico exploratório (`heuristic` vs `randomLegal`) e criar `scripts/__fuzz_regressions__/`.
- [ ] Merge de `feature/wave-gd01` -> `dev`.
- [ ] Commit / PR de referência: `ae8b247`
```

---

### 3. Checklist Executável de Homologação e Merge GD01

- [ ] **[Pré-Merge 1] Fix Golden Test:**  
  Editar `scripts/gundam-golden.test.mjs` trocando `"15 pares conferem"` por verificação dinâmica usando `Object.keys(readHashes()).length`.
- [ ] **[Pré-Merge 2] Testes do Gate Server-Side:**  
  Criar `server/deckCoverageGate.test.ts` e validar:
  - Acceptance de decks válidos de 90 cartas.
  - Rejeição (HTTP 400) para decks contendo cartas de `DEFERRED_CLAUSES`.
  - Rejeição estrita para códigos de cartas inexistentes (`GD01-999`, `GD02-001`).
- [ ] **[Pré-Merge 3] Fuzzing Estocástico:**  
  Criar pasta `scripts/__fuzz_regressions__/` e rodar script ad-hoc de 500 partidas `heuristicPolicy` vs `randomLegal`.
- [ ] **[Pré-Merge 4] Suíte Verde Local:**  
  Rodar `npx vitest run` + `pnpm tsc --noEmit` e confirmar 0 falhas.
- [ ] **[Merge] Git Operations:**  
  Efetuar merge de `feature/wave-gd01` para `dev`.

---

### 4. Prompts Prontos para Execução com Claude Code / Antigravity

#### Prompt 1: Executar Ações Pré-Merge (Etapa 1)
> ````text
> Atue como Engenheiro Sênior de Software no repositório Gundam Card Game Simulator.
> Execute exatamente as seguintes 3 tarefas de hardening no branch `feature/wave-gd01`:
>
> 1. Altere `scripts/gundam-golden.test.mjs` para que a asserção de pares verificados não seja uma string fixa ("15 pares conferem"), mas sim calculada dinamicamente lendo o total de chaves do arquivo `hashes.json` (usando a função/método de leitura de hashes do projeto).
> 2. Crie o arquivo `server/deckCoverageGate.test.ts` cobrindo unitariamente `server/deckCoverageGate.ts`:
>    - Deve aprovar decks montados exclusivamente com as 90 cartas válidas de GD01.
>    - Deve rejeitar com erro estruturado decks contendo qualquer carta listada em `content/deferred.ts`.
>    - Deve rejeitar estritamente decks contendo códigos de cartas inexistentes no dataset (ex: 'GD01-999', 'GD02-001').
> 3. Crie o diretório `scripts/__fuzz_regressions__/` e adicione um script executável de fuzzing que simule 500 partidas usando `heuristicPolicy` no Jogador 1 e `randomLegal` no Jogador 2 sobre os decks de `fixtures/gd01TestDecks.ts`.
>
> Ao finalizar, execute `npx vitest run` e `pnpm tsc --noEmit` para garantir que tudo permaneça 100% verde.
> ````

#### Prompt 2: Implementar Lote 1 de Motor (Escopos e Grupos Ambos os Lados)
> ````text
> Atue como Engenheiro de Motor de Regras do Gundam Card Game Simulator.
> Nosso objetivo é desbloquear as cartas GD01-014, GD01-024, GD01-027, GD01-058, GD01-108 e GD01-110 (Lote 1 de Gaps):
>
> 1. Estenda as definições e resolvers de `TargetScope` e `TargetGroup.kind` no motor para suportar o escopo 'both' / 'all' (unidades de AMBOS os lados da mesa: amigáveis e inimigas).
> 2. Registre as novas variantes em `content/primitives-claims.json` para manter o gate de governança em `scripts/gundam-coverage.mjs` passando.
> 3. Atualize `content/gd01.ts` movendo as 6 cartas mencionadas de deferidas para implementadas com seus respectivos `EffectSpec`.
> 4. Remova as cláusulas dessas 6 cartas de `content/deferred.ts`.
> 5. Adicione testes unitários em `src/cards/gd01.test.ts` cobrindo o comportamento de cada uma das 6 cartas.
>
> Ao finalizar, rode `npx vitest run` e `pnpm tsc --noEmit`.
> ````

---

Aguardando a confirmação do usuário para iniciar os trabalhos de execução.

---

<details>
<summary><b>Clique para ver a transcrição bruta dos turnos</b></summary>

### 1. Proposta Inicial (Claude - Propositor)

# Proposta técnica — Verificação de integração GD01 (Fase 0 + Fase 1) e próximos passos

## 0. Metodologia desta verificação (transparência)

Nesta sessão eu não tive acesso a execução de `node`/`vitest` (o sandbox bloqueou `node scripts/gundam-coverage.mjs` e variantes — tentei 3x e desisti, conforme a regra de não repetir comando que falha). Toda a verificação abaixo é por **leitura estática do código, do diff do commit `ae8b247` e da configuração de teste** — não é uma re-execução. Onde isso importa, sinalizo explicitamente.

---

## 1. Verificação de integração Fase 0 + Fase 1

### 1.1 O que confirma integração sem conflito

- `vitest.config.*` inclui `scripts/**/*.test.mjs` no `test: vitest run`. Isso significa que `gundam-coverage.test.mjs`, `gundam-golden.test.mjs` e `similar-specs.test.mjs` (todos tocados pela Fase 0) **já rodaram dentro da mesma suíte de 972 testes** que também cobre `gd01.test.ts`, `deferred.test.ts` e o motor (`abilityDispatch.ts`/`dispatcher.ts`) tocados pela Fase 1/2. Não são dois mundos separados nunca exercitados juntos — o "972/972 verde" já É a prova de integração ao nível de teste automatizado.
- Confirmei por leitura direta: `MAX_CASCADE_DEPTH=12`/`MAX_QUEUE_BREADTH=150`/`TriggerLoopException` existem em `abilityDispatch.ts:264-312`, com `reason: "trigger_loop_guard"` propagado a `GameOverInfo`. `primitives-claims.json` tem a seção `primitiveOps`/`targetRefKinds`/etc. com metadados reais (não placeholder). `hashes.json` tem exatamente 15 entradas (bate com o golden test).
- `content/deferred.ts`: 42 `cardCode` únicos com prefixo `GD01-`, todos com `blockedBy` preenchido — bate exatamente com `gd01.manifest.json.deferred_summary.total_clauses: 42`.
- `gd01.ts`: 130 `code: "GD01-..."` únicos; 60 `cardCode` únicos dentro de `EffectSpec` (implementada "pura"); mais 2 cartas cobertas via `staticAbilities`/`combatTriggers` estruturados (as "implementada*") = 62, batendo com o relato do commit.
- `server/index.ts`: `validateDeckPayload` (de `deckCoverageGate.ts`) está de fato plugado nos 3 pontos citados — `/api/simulator/queue/join` (4325), `training/new` (4395, cobre **também** deck do próprio jogador via `buildDeckListFromUserDeck`, não só decks fixos) e `/api/simulator/matches` hoster-only (4648). `ENABLE_GD01_ONLINE` existe e protege só a fila (4281-4288).

### 1.2 Achado novo #1 — gap real, não cosmético: `deckCoverageGate.ts` tem **zero teste automatizado**

Procurei por `deckCoverageGate.test.ts`, por qualquer teste que bata em `queue/join`/`training/new`, e por qualquer referência a `isCardPlayable`/`unplayableCards` fora dos 2 arquivos de produção (`server/index.ts` e o próprio `deckCoverageGate.ts`). **Não existe nenhuma.** `server/*.test.ts` só tem `simulatorSocket.test.ts` e `metagameTrendsService.test.ts`.

Isso é significativo porque `deckCoverageGate.ts` é literalmente o mecanismo que devia impedir a *classe* de bug que causou o incidente de 4h (deck com carta sem cobertura real chegando no motor). Hoje ele funciona **por construção correta dos 4 fixtures** (`gd01TestDecks.ts` foi montado manualmente respeitando `DEFERRED_CLAUSES`), não porque um teste afirma "deck com carta deferida → HTTP 400". Se alguém editar `isCardPlayable`/`hasBespokeText` amanhã (ex. um regex mal ajustado) e quebrar a lógica, nenhum teste vermelho vai avisar — só um incidente em produção. Isso é uma lacuna de verificação real que nem o item A-F do usuário nem o commit mencionavam.

**Recomendação:** criar `server/deckCoverageGate.test.ts` com casos: deck 100% vanilla/implementada → válido; deck com 1 carta em `DEFERRED_CLAUSES` → inválido com o código certo em `unplayableCards`; deck com carta de GD02+ (inexistente em `ALL_EFFECT_SPECS` e sem `effect` no dataset oficial teórico) → inválido. Esforço: **poucas horas**.

### 1.3 Achado novo #2 — a lista de "10 gaps de motor" no manifest está **desatualizada e subestimada**

O `gd01.manifest.json.deferred_summary.common_blockers` lista 10 tags, e o prompt do usuário herdou esse número como fato. Fiz a extração de **todos** os 42 valores de `blockedBy:` em `deferred.ts` (não só os "comuns") e o resultado é diferente:

**São 28 tags únicas**, não 10. A maioria dos 10 listados no manifest nem bate literalmente com o texto usado em `deferred.ts` (ex.: manifest diz `engine:static-ability-condicao-generica`; o arquivo real usa majoritariamente `engine:static-ability-keyword-condicao-generica`, uma tag mais específica que nem consta no manifest). Isso é razoável — o manifest foi escrito na Fase 2 antes da revalidação carta-a-carta que deu "razão específica" a cada cláusula (a própria nota `phase2_claude_core` do manifest admite isso) — mas ficou sem atualização depois. Distribuição real por nº de cartas desbloqueadas:

| Tag (`engine:...`) | Cartas | Cartas GD01 |
|---|---|---|
| `static-ability-keyword-condicao-generica` | 4 | 019, 034, 054, 081 |
| `aura-piloto-condicional` | 4 | 087, 089, 092, 096 |
| `target-group-todas-as-units-dos-2-lados` | 3 | 024, 027, 108 |
| `target-scope-qualquer-lado` | 3 | 014, 058, 110 |
| `escolha-de-ate-n-alvos` | 3 | 044, 112, 114 |
| `custo-dinamico-na-mao` | 2 | 016, 070 |
| `busca-topo-deck-filtro-especifico` | 2 | 048, 109 |
| (21 tags restantes) | 1 cada | os demais 21 códigos |

Isso muda a matemática do item (iii) dos próximos passos — ver seção 4.

---

## 2. `gd01.manifest.json` atualizado (proposta de conteúdo completo)

```json
{
  "wave_id": "GD01",
  "name": "Newtype Rising",
  "status": "PHASE_4_ROLLOUT_PARTIAL",
  "total_cards": 130,
  "metrics": {
    "vanilla_cards": 28,
    "implemented_cards": 60,
    "implemented_with_deferred_clause": 2,
    "deferred_pure_cards": 40,
    "deferred_clauses": 42,
    "playable_cards_total": 90
  },
  "pipeline_progress": {
    "phase1_gemini_draft": {
      "completed": true,
      "agent": "gemini-3.8-flash",
      "timestamp": "2026-09-12T17:23:00Z"
    },
    "phase2_claude_core": {
      "completed": true,
      "agent": "claude-code",
      "commit": "ae8b247",
      "notes": "Revalidação carta a carta: corrigidos bugs de autoria da Fase 1 (targetFilter 'isRested' inexistente, 'oncePerTurn' faltante em 4 CardDefs, CardDef GD01-127 com keyword estática indevida), 2 cláusulas de GD01-001/GD01-066 que a Fase 1 nunca tinha rastreado em deferred.ts, e um bug de motor pré-existente (pareamento não simetricamente limpo ao sair de campo, exposto pelas cartas de bounce). Extensões aditivas ao motor: filtros de alvo compostos (';'), 'trait:X', 'ap>=N', 'color:X', 'linkUnit'; predicados compostos + 'enemyUnitCountAtLeast', 'controllerOtherUnitCountAtLeast', 'selfIsLinkUnit', 'selfIsPaired', 'attackingEnemyUnit'/'attackingPlayer', etc.; TargetGroup 'allFriendlyUnits'. 62/130 cartas jogáveis com cobertura real (60 com EffectSpec + 2 implementada* via campos estruturados); 42 cláusulas seguem deferidas com razão específica (não mais o placeholder genérico da Fase 1)."
    },
    "phase3a_rag_index": {
      "completed": true,
      "agent": "gemini-3.8-flash",
      "timestamp": "2026-09-12T18:37:00Z",
      "signatures_indexed": 147
    },
    "phase3b_fuzz_golden": {
      "completed": true,
      "agent": "claude-code",
      "commit": "ae8b247",
      "golden_master": {
        "pair_added": "GD01_vs_GD01_seed15",
        "total_pairs": 15,
        "status": "verde, determinístico (2 execuções consecutivas do mesmo relatório de hash)"
      },
      "fuzz_new_decks": {
        "decks": ["GD01-FED", "GD01-ZEON", "GD01-NEWTYPE", "GD01-SLEEVES"],
        "pairs": 10,
        "games_per_pair": 500,
        "total_games": 5000,
        "policy": "heuristicPolicy vs heuristicPolicy",
        "max_turns": 200,
        "findings": 0,
        "trigger_loop_guard_triggers": 0,
        "note": "cobre só os decks NOVOS de rollout (90 cartas seguras). Não é reprodução do deck exato do incidente manual original."
      },
      "incident_root_cause_repro": {
        "status": "NAO_CONFIRMADA",
        "note": "o guard MAX_CASCADE_DEPTH/MAX_QUEUE_BREADTH mitiga qualquer loop de gatilho, mas o par de decks exato usado no incidente manual de ~4h nunca foi reproduzido programaticamente (scripts/__fuzz_regressions__/ não existe). Ver próximos passos (i)."
      }
    },
    "phase4_rollout_partial": {
      "completed": "partial",
      "agent": "claude-code",
      "commit": "ae8b247",
      "branch": "feature/wave-gd01",
      "merged_to_dev": false,
      "notes": "server/deckCoverageGate.ts (validateDeckPayload) plugado em queue/join, training/new e no endpoint de debug hoster-only — cobre também deck próprio do jogador via deckbuilder, não só fixtures. fixtures/gd01TestDecks.ts: 4 decks (FED/ZEON/NEWTYPE/SLEEVES) só com as 90 cartas seguras. ENABLE_GD01_ONLINE (env var) protege Fila Online/Convite Direto; Treino Solo libera GD01 incondicionalmente, sempre atrás do gate. DECK_OPTIONS em SimulatorSandboxPage.tsx com badge BETA · PARCIAL. GAP: deckCoverageGate.ts não tem teste automatizado dedicado (achado desta revisão, 2026-09-13)."
    }
  },
  "deferred_summary": {
    "total_clauses": 42,
    "unique_engine_blockers": 28,
    "note": "lista abaixo substitui 'common_blockers' antigo (10 tags), que estava desatualizado/incompleto em relação às tags reais em deferred.ts (levantamento 2026-09-13).",
    "blockers_by_cards_unlocked": [
      { "tag": "engine:static-ability-keyword-condicao-generica", "cards": ["GD01-019", "GD01-034", "GD01-054", "GD01-081"] },
      { "tag": "engine:aura-piloto-condicional", "cards": ["GD01-087", "GD01-089", "GD01-092", "GD01-096"] },
      { "tag": "engine:target-group-todas-as-units-dos-2-lados", "cards": ["GD01-024", "GD01-027", "GD01-108"] },
      { "tag": "engine:target-scope-qualquer-lado", "cards": ["GD01-014", "GD01-058", "GD01-110"] },
      { "tag": "engine:escolha-de-ate-n-alvos", "cards": ["GD01-044", "GD01-112", "GD01-114"] },
      { "tag": "engine:custo-dinamico-na-mao", "cards": ["GD01-016", "GD01-070"] },
      { "tag": "engine:busca-topo-deck-filtro-especifico", "cards": ["GD01-048", "GD01-109"] },
      { "tag": "engine:static-ability-condicao-generica", "cards": ["GD01-076"] },
      { "tag": "engine:aura-concessao-keyword-grupo", "cards": ["GD01-001"] },
      { "tag": "engine:deploy-alternativo-sacrificio", "cards": ["GD01-002"] },
      { "tag": "engine:reciclagem-lixeira-deck", "cards": ["GD01-003"] },
      { "tag": "engine:during-link-e-alvo-implicito-pos-destroy", "cards": ["GD01-005"] },
      { "tag": "engine:busca-lixeira-e-pareamento-por-efeito", "cards": ["GD01-023"] },
      { "tag": "engine:escolha-de-posicao-para-1-carta-revelada", "cards": ["GD01-039"] },
      { "tag": "engine:relaxamento-alvo-por-ap-nao-so-nivel", "cards": ["GD01-043"] },
      { "tag": "engine:deploy-direto-do-topo-do-deck", "cards": ["GD01-045"] },
      { "tag": "engine:gatilho-por-uso-de-keyword", "cards": ["GD01-046"] },
      { "tag": "engine:keyword-condicional-a-combate-especifico", "cards": ["GD01-063"] },
      { "tag": "engine:gatilho-por-evento-de-pareamento", "cards": ["GD01-065"] },
      { "tag": "engine:atacar-no-turno-do-deploy-fora-de-link", "cards": ["GD01-066"] },
      { "tag": "engine:busca-lixeira-para-mao", "cards": ["GD01-067"] },
      { "tag": "engine:imunidade-a-reducao-de-stat", "cards": ["GD01-090"] },
      { "tag": "engine:protecao-continua-condicional", "cards": ["GD01-091"] },
      { "tag": "engine:target-filter-relativo-a-propria-carta", "cards": ["GD01-093"] },
      { "tag": "engine:combat-trigger-filtro-link-unit", "cards": ["GD01-094"] },
      { "tag": "engine:condicional-a-resultado-de-primitiva-anterior", "cards": ["GD01-095"] },
      { "tag": "engine:multiplos-escopos-de-alvo-no-mesmo-spec", "cards": ["GD01-103"] },
      { "tag": "engine:filtro-alvo-condicional", "cards": ["GD01-122"] }
    ]
  },
  "known_gaps": {
    "test_coverage": ["server/deckCoverageGate.ts sem teste dedicado (achado 2026-09-13)"],
    "tech_debt": ["scripts/gundam-golden.test.mjs afirma '15 pares' como literal hardcoded — quebra de novo no próximo par adicionado (achado 2026-09-13, ver próximos passos)"]
  }
}
```

---

## 3. Nova seção para `AI_GUIDE.md` § 6 (mesmo formato das Frentes 1-5)

```markdown
### Frente 6: Wave GD01 — Motor, Governança e Rollout Parcial (Branch: `feature/wave-gd01`)
- [x] Endurecer o motor contra o incidente real de travamento (~4h, playtest manual): `MAX_CASCADE_DEPTH=12`/`MAX_QUEUE_BREADTH=150` + `TriggerLoopException` (`abilityDispatch.ts`, `dispatcher.ts`) substituem o `MAX_DESTROYED_CHAIN` antigo (só cobria Destroyed→Destroyed); `GameOverInfo` aceita `winner:null`/`reason:"trigger_loop_guard"` para empate determinístico.
- [x] Governança de vocabulário de efeitos: `content/primitives-claims.json` (registro append-only de `primitiveOps`/`targetRefKinds`/`targetGroupKinds`/`targetScopes`/predicados/filtros) + gate automático em `scripts/gundam-coverage.mjs` (exit 1 se algo novo entrar sem registro).
- [x] Testkit compartilhado `engine/__testkit__/cardHarness.ts` (`placeCard`), substituindo o helper duplicado `place` em `gd01.test.ts`/`st01-04.test.ts`.
- [x] Conteúdo GD01 (Fase 2): `content/gd01.ts` (130 CardDefs, 62 jogáveis: 60 com EffectSpec + 2 implementada*), `content/deferred.ts` (42 cláusulas com razão específica por carta, 40 cartas puramente deferidas + 2 implementada* com resíduo), golden master `GD01_vs_GD01_seed15` adicionado (append-only, 15 pares totais).
- [x] Rollout Fase 1 — GD01 jogável com gate de segurança server-side: `server/deckCoverageGate.ts` (`validateDeckPayload`) plugado em `queue/join`, `training/new` (cobre também deck do próprio jogador via deckbuilder, não só decks fixos) e no endpoint de debug hoster-only.
- [x] `fixtures/gd01TestDecks.ts`: 4 decks (GD01-FED branco/azul, GD01-ZEON verde/vermelho, GD01-NEWTYPE azul/verde, GD01-SLEEVES vermelho/branco), só com as 90 cartas seguras (62 prontas + 28 vanilla), validados programaticamente (50+10, ≤2 cores, ≤4 cópias).
- [x] `ENABLE_GD01_ONLINE` (env var, sem rebuild) protege GD01 na Fila Online/Convite Direto; Treino Solo libera incondicionalmente, sempre atrás do `deckCoverageGate`. `SimulatorSandboxPage.tsx` ganha os 4 decks com badge "BETA · PARCIAL".
- [x] Verificação de integração Fase 0 + Fase 1 (2026-09-13): `npx vitest run` 972/972 verde (2 execuções), `tsc --noEmit` limpo, fuzz dedicado aos 4 decks novos (10 pares × 500 partidas = 5000 partidas, `heuristicPolicy` × `heuristicPolicy`, `maxTurns=200`) — 0 achados, guard nunca disparado contra eles.
- [ ] **Gap encontrado:** `server/deckCoverageGate.ts` não tem teste automatizado dedicado — a proteção contra a classe de bug do incidente de 4h depende hoje só dos fixtures estarem corretos por construção, não de um teste que afirme "deck com carta deferida é rejeitado".
- [ ] **Gap encontrado:** causa raiz exata do incidente manual de ~4h segue **não reproduzida** — o fuzz de 5000 partidas rodou contra os decks NOVOS (que excluem de propósito as 40 cartas deferidas), não contra o par de decks original do incidente (desconhecido, pode ter usado cartas deferidas). O guard mitiga qualquer loop, mas não confirma o mecanismo exato.
- [ ] **Gap encontrado:** `scripts/gundam-golden.test.mjs` afirma `"15 pares conferem"` como string literal — vai quebrar de novo no próximo par de golden master adicionado (mesmo padrão de bug que já ocorreu 1x nesta wave, corrigido de "10" pra "15" manualmente).
- [ ] **Gap conhecido (não é bug):** 40 cartas seguem deferidas por 28 gaps de motor distintos (não 10, como a taxonomia antiga do manifest sugeria) — ver `gd01.manifest.json.deferred_summary` e Próximos Passos.
- [ ] Merge `feature/wave-gd01` → `dev` (pré-requisitos na seção de Próximos Passos abaixo).
- [ ] Commit: `feat(simulador): wave GD01 - conteudo, motor resiliente e rollout parcial` (`ae8b247`, já commitado nesta branch — falta o merge)
```

---

## 4. Próximos passos — SOMENTE GD01

**(i) Mistério do incidente de 4h — investigar mais ou aceitar o guard como mitigação suficiente?**
Recomendação: **aceitar o guard e seguir em frente, mas fechar o buraco de evidência com uma ação barata.** Não vale caçar retroativamente o deck exato do incidente (nem é sabido com certeza, o texto do usuário já assume que é desconhecido) — isso é tempo caro por um retorno só forense. Em vez disso: criar `scripts/__fuzz_regressions__/` (proposto e nunca criado) e rodar fuzz **contra decks sintéticos que usam propositalmente as 40 cartas deferidas** (mesmo sem `EffectSpec`, `hasBespokeText` bloquearia — então o teste teria que forçar a carta como "jogável" ignorando o gate, só para fins de fuzzing exploratório do motor, não de rollout real) usando `mctsPolicy` além de `heuristicPolicy` (existe em `engine/bot/mctsPolicy.ts`, não usado no fuzz desta sessão — MCTS tende a explorar sequências mais agressivas/incomuns que heurística pura, maior chance de achar cascatas). Isso fecha a pergunta "o guard segura even o pior caso plausível?" sem prometer achar a causa raiz exata. **Esforço: poucas horas.**

**(ii) Corrigir `gundam-golden.test.mjs` para não quebrar de novo**
Trocar `expect(out).toContain("15 pares conferem")` por algo que lê `hashes.json` (já importado como `HASHES_FILE` no script gêmeo `gundam-golden.mjs`) e monta a asserção dinamicamente: `expect(out).toContain(\`${Object.keys(readHashes()).length} pares conferem\`)`. **Esforço: poucas horas** (é reescrever 1 asserção + garantir que o teste ainda falha corretamente se o script real quebrar).

**(iii) Ordem de ataque dos gaps de motor para as 40 cartas deferidas**
A tabela da seção 1.3/2 mostra que os **7 gaps recorrentes cobrem 21 das 42 cláusulas (metade)**; os outros 21 são bespoke (1 carta cada). Ordem recomendada por impacto/esforço:

1. **`target-scope-qualquer-lado` + `target-group-todas-as-units-dos-2-lados` juntos** (mesma família: estender de {enemy, friendly} para {enemy, friendly, both} em `TargetScope`/`TargetGroup.kind`) — mecânico, reusa quase todo o resolver existente. **6 cartas. Esforço: poucas horas.**
2. **`busca-topo-deck-filtro-especifico`** — provavelmente só estender `lookAtTopFilterReveal` para aceitar múltiplos traits (OR), já existe composição AND (`;`) documentada em `primitives-claims.json.compositionRule`; falta um separador OR. **2 cartas. Esforço: poucas horas.**
3. **Unificar `static-ability-keyword-condicao-generica` + `aura-piloto-condicional` + `static-ability-condicao-generica`** — os 3 são variações do MESMO gap real: `StaticAbility.condition` só aceita `duringPair`/`duringLink`, e só concede stat, nunca keyword. Proposta: trocar `condition` por uma string de predicado genérico (**reusar o resolver de predicados que `predicates.ts`/`defaultPredicateResolver` já tem** para `targetFilter`/`EffectSpec.condition`, em vez de inventar um novo formato) + adicionar `grant: {type: "keyword", value} | {type: "stat", ap?, hp?}`. Essa é a maior alavanca do backlog: **1 mudança arquitetural, 9 cartas** (GD01-019, 034, 054, 081, 087, 089, 092, 096, 076). **Esforço: 1-2 dias** (é o item que a própria nota do manifest já apontava como "a maior parte" do problema).
4. **`escolha-de-ate-n-alvos`** — reusar a camada de decisão (`ChoicePrimitive`/`PendingDecision`) que a Classe A (ST02-015/ST04-002/ST04-012, já fechada) construiu para "escolha nomeada", estendendo para contagem exata/variável de alvos. **3 cartas. Esforço: ~1 dia.**
5. **`custo-dinamico-na-mao`** — genuinamente novo (recompute contínuo de custo de carta NA MÃO, não em jogo — hoje só `StaticAbility` recomputa cartas em campo). **2 cartas. Esforço: 1-2 dias**, maior risco por ser subsistema novo — só vale se houver mais cartas de GD02+ com o mesmo padrão (checar via RAG `similar-specs.mjs` antes de investir).
6. **Os 21 gaps de 1 carta cada** — não atacar em lote. Antes de implementar qualquer um, rodar `gundam_similar_specs`/checar `primitives-claims.json` para ver se GD02+ (fora de escopo deste debate, mas informa prioridade) repete o mesmo padrão — se sim, sobe de prioridade; se não, deixar deferido é uma decisão de produto válida (são cartas já corretamente excluídas do pool jogável pelo gate).

Sequenciando 1→2→3→4, fecham-se **21 das 42 cláusulas (50%)** com só **4 mudanças de motor**, todas reaproveitando infraestrutura já existente (resolver de predicado, camada de decisão, resolver de escopo/grupo).

**(iv) Merge de `feature/wave-gd01` → `dev`: pré-requisitos**
Antes do merge:
- [ ] Criar `server/deckCoverageGate.test.ts` (achado 1.2) — é a proteção mais crítica do rollout e está sem rede de segurança de teste.
- [ ] Aplicar o fix do item (ii) em `gundam-golden.test.mjs`.
- [ ] Rodar mais uma vez `npx vitest run` + `tsc --noEmit` limpos **depois** dos 2 itens acima (não só confiar no estado pré-fix).
- [ ] Confirmar critério já existente da seção 7 do `AI_GUIDE.md` ("Critérios de Homologação para Merge Final em `dev`") — validação manual em navegador de uma partida com os 4 decks GD01 novos (Sandbox/Treino Solo), já que a Frente 6 introduz UI nova (`DECK_OPTIONS` badge) não coberta por esse critério até agora.
- [ ] Decisão explícita (produto, não engenharia) sobre manter `ENABLE_GD01_ONLINE` desligado por padrão em produção até fechar pelo menos o item (iii.3) — reduz a superfície de "cartas GD01 completas" visível a jogadores reais no PvP ranqueado enquanto 40/130 seguem deferidas.

**Esforço total estimado até merge-ready:** ~1 dia (itens de teste/fix) + decisão de produto (não é esforço de engenharia).

---

Isso encerra minha proposta. Pontos que quero que o Gemini escrutine com prioridade: (a) se a metodologia de fuzz de 5000 partidas com `heuristicPolicy`×`heuristicPolicy` é representativa o bastante ou se `mctsPolicy`/`randomLegal` deveriam ter entrado nesta rodada mesmo sem reproduzir o incidente exato; (b) se a unificação proposta em (iii.3) (`static-ability-keyword-condicao-generica` + `aura-piloto-condicional` + `static-ability-condicao-generica` num único mecanismo de predicado+grant) é arquiteturalmente sã ou esconde uma divergência sutil entre os 3 casos que eu não capturei só lendo os comentários de `deferred.ts`.

---

### 2. Resposta / Auditoria Crítica (Gemini - Auditor)

[CONCORDANCIA: 90%]

Como Auditor Crítico, valido a proposta do Claude como **altamente rigorosa, factual e madura**. O trabalho de auditoria estática do Claude trouxe à tona dois achados de valor incalculável que nem o prompt nem o commit mencionavam: a **ausência total de testes unitários em `server/deckCoverageGate.ts`** e a **defasagem da taxonomia de gaps no manifest (28 tags reais vs 10 no manifest)**.

No entanto, como Auditor, identifico **3 riscos ocultos, 1 vulnerabilidade de segurança/gameplay e 1 ressalva de arquitetura** na proposta que precisam ser ajustados antes da execução.

---

## 1. Auditoria da Verificação de Integração e Achados Ocultos

### 1.1 O Fuzzing de 5.000 partidas com `heuristicPolicy` vs `heuristicPolicy`
* **Crítica de Segurança/Escala:** O teste de 5.000 partidas ter retornado 0 travamentos é um ótimo sinal, mas **não é suficiente para declarar ausência de loops no pool jogável**. A `heuristicPolicy` é determinística e gulosa: ela sempre toma decisões "racionais" padronizadas (ex: ataca a unidade mais fraca, joga cartas na curva). Se um loop de gatilhos depender de uma jogada sub-ótima (ex: alvejar a própria unidade em uma situação específica ou ativar uma habilidade em momento inusitado), a `heuristicPolicy` **jamais executará essa sequência**, mesmo em 1.000.000 de partidas.
* **Impacto Oculto (Forced Draw Exploit):** Com a introdução do `TriggerLoopException`, o servidor agora interrompe loops e decreta empate (`winner: null`). Se existir um loop acessível por cartas válidas do pool de 90 cartas que só ocorre via jogadas "não-heurísticas", um jogador mal-intencionado no PvP online pode executar essa sequência intencionalmente para **forçar um empate sempre que estiver prestes a perder**.
* **Recomendação:** O fuzzing para fechamento de segurança DEVE incluir pelo menos 1.000 partidas usando **`heuristicPolicy` vs `randomLegal`** ou **`mctsPolicy`**.

### 1.2 Edge Case no `deckCoverageGate.ts` (Além da falta de testes)
* O Claude notou que `deckCoverageGate.ts` não possui testes automatizados. O risco fica pior ao analisar requisições manipuladas:
* **Edge Case:** O que acontece se uma requisição maliciosa ou um payload corrompido enviar um `cardCode` de GD02+ (ou uma string inválida como `"GD01-999"`) para os endpoints `/api/simulator/queue/join` ou `/training/new`?
* Se o gate se basear unicamente em `DEFERRED_CLAUSES` ou `ALL_EFFECT_SPECS`, uma carta desconhecida (que não está nem no `gd01.ts` nem no `deferred.ts`) pode passar pelo gate se o parser a tratar como "vanilla sem efeito" por padrão, quebrando a engine no momento do deploy.
* **Recomendação:** O `deckCoverageGate.ts` deve validar estritamente que a carta pertence ao registro conhecido de cartas válidas do jogo, e não apenas que ela "não está no arquivo de deferidas".

---

## 2. Validação dos Documentos (Manifest JSON + AI_GUIDE.md § 6)

### 2.1 Manifest JSON (`gd01.manifest.json`)
* **Status:** **APROVADO.** A transição para `PHASE_4_ROLLOUT_PARTIAL`, a inclusão da chave `known_gaps` e a expansão detalhada dos 28 blockers em `blockers_by_cards_unlocked` refletem com precisão milimétrica a realidade do repositório no commit `ae8b247`.

### 2.2 AI_GUIDE.md (§ 6 - Frente 6)
* **Status:** **APROVADO COM RESSALVA.** O formato de checklist atomizado está perfeito e segue exatamente o padrão das Frentes 1-5.
* **Ajuste Fino Recomendado:** Adicionar um item explícito na checklist sobre a limitação do fuzzing (ex: `- [ ] Fuzzing de resiliência com políticas estocásticas/randomLegal`).

---

## 3. Auditoria dos Próximos Passos para GD01

### (i) Mistério do Incidente de 4h
* **Veredito do Auditor:** Concordo com o Claude. Tentar recriar forensicamente o deck exato de 4h é perda de tempo. O `TriggerLoopException` previne o crash/lockup do Node.js (que era o risco infraestrutural real).
* **Ação Corretiva:** Criar a pasta proposta `scripts/__fuzz_regressions__/` e persisitir um script de fuzzing exploratório que force o uso do pool jogável contra políticas `randomLegal`.

### (ii) Ajuste no `gundam-golden.test.mjs`
* **Veredito do Auditor:** **APROVADO.** A asserção dinâmica lendo a quantidade de chaves de `hashes.json` elimina o risco de regressão frágil no próximo commit de golden master.

### (iii) Ordem de Ataque dos Gaps de Motor (Análise Arquitetural)
O Claude propôs sequenciar:
1. Scope/Group ambos os lados (6 cartas)
2. Filtro de busca no topo (2 cartas)
3. Unificação de `static-ability-keyword-condicao-generica` + `aura-piloto-condicional` + `static-ability-condicao-generica` (9 cartas)
4. Escolha de até N alvos (3 cartas)

* **Alerta Arquitetural no Item 3 (Auras de Piloto vs Habilidades Estáticas):**
  * O Claude sugere tratar Auras de Piloto Condicionais no mesmo resolver de `StaticAbility` reusando predicados de `predicates.ts`.
  * **Cuidado com o Lifecycle do Pareamento:** Uma habilidade estática em uma Unidade é avaliada continuadamente enquanto a Unidade está em campo. Já a Aura de um Piloto depende da existência da relação em `pairedWith`. Se o Piloto for destruído ou despareado (bounce), a aura DEVE cessar imediatamente.
  * Se unificarmos na mesma estrutura sem isolar a origem do efeito, corremos o risco de criar um efeito-fantasma onde o bônus do piloto permanece na unidade mesmo após a separação.
  * **Ajuste Técnico:** O reuso do resolver de predicados é excelente, mas o motor deve garantir que a reavaliação da `StaticAbility` oriunda de um piloto cheque primeiro a validade do vinculo de pareamento (`pairedWith !== null`).

### (iv) Pré-requisitos para Merge de `feature/wave-gd01` -> `dev`
* **Veredito do Auditor:** A lista de gating proposta pelo Claude está correta. A ordem de execução sugerida antes do merge deve ser:
  1. Criar `server/deckCoverageGate.test.ts` (cobrindo cartas válidas, deferidas e códigos desconhecidos/inválidos).
  2. Tornar dinâmica a asserção de `scripts/gundam-golden.test.mjs`.
  3. Adicionar bateria de fuzzing `heuristic` vs `randomLegal` no pool de 90 cartas.
  4. Validação manual UI do badge BETA na Sandbox/Solo.
  5. Merge em `dev`.

---

## 4. Documento Final e Veredito

Com as ressalvas técnicas acima integradas, o plano do Claude é o **caminho mais rápido e seguro** para estabilizar a Wave GD01.

### Resumo das Estimativas de Esforço Ajustadas:

| Item de Ação | Descrição / Ajuste de Segurança | Esforço Estimado |
|---|---|---|
| **1. Tests do Gate** | Criar `server/deckCoverageGate.test.ts` (incluindo testes com cartas inexistentes/GD02+) | ~2 a 3 horas |
| **2. Fix Golden Test** | Asserção dinâmica em `gundam-golden.test.mjs` lendo `hashes.json` | ~30 minutos |
| **3. Fuzzing Estocástico** | Bateria de fuzzing `heuristic` vs `randomLegal` (pesquisa de Forced Draw Exploit) + `scripts/__fuzz_regressions__/` | ~2 a 4 horas |
| **4. Gap Motor Grupo 1** | Implementar `target-scope-qualquer-lado` + `target-group-todas-as-units-dos-2-lados` (desbloqueia 6 cartas) | ~3 a 4 horas |
| **5. Gap Motor Grupo 2** | Unificação de predicados de `StaticAbility` + Auras de Piloto respeitando lifecycle de pareamento (desbloqueia 9 cartas) | ~1 a 2 dias |
| **6. Merge Prep** | Validação em navegador e PR de `feature/wave-gd01` -> `dev` | ~1 hora |

O debate cumpriu seu papel de mapear a integração real, atualizar a governança e definir os passos exatos de engenharia para fechar GD01 com segurança.

</details>
