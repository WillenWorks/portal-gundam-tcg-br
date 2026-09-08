# docs/49: Simulador — Modo Solo (Treino contra Bot), Telemetria de Partidas e Infraestrutura Render

Data: 2026-09-08  
Status: Implementado e Alinhado nas branches `dev` e `main`

---

## 1. Visão Geral

Esta entrega expande o Simulador de Partidas do **Portal Gundam TCG BR** com três pilares fundamentais:
1. **Modo Solo (Treino contra o Bot)** para prática individual de jogadores logados.
2. **Telemetria e Persistência de Partidas (`SimulatorMatchLog`)** para coleta de dados de jogos, análise estatística e criação de datasets de IA.
3. **Conformidade de Infraestrutura com o Render**, com runner de bot assíncrono embutido no web server para garantir zero complexidade operacional e custo mínimo em produção.

---

## 2. Modo Solo e Políticas de Bot

### Acesso na Interface
- **Página de Treino**: [`/simulador/treino`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/pages/SimulatorTrainingPage.tsx) permite selecionar o starter deck (ST01 a ST04) e o nível de dificuldade desejado.
- **Atalhos no Portal**: 
  - Botão de destaque "Modo Solo — Treinar contra o Bot" no lobby principal do simulador ([`SimulatorSandboxPage.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/pages/SimulatorSandboxPage.tsx)).
  - Item "Treino Solo" no menu lateral do usuário logado ([`PortalShell.tsx`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/components/layout/private/PortalShell.tsx)).

### Níveis de Dificuldade
1. **Fácil (`facil`)**: Heurística simplificada, ideal para novatos testarem regras e fluxo básico de turnos.
2. **Normal (`normal`)**: Política heurística completa e determinística. Avalia agressividade de campo, trocas eficientes de combate e priorização de escudos e bases.
3. **Difícil (`dificil`)**: Monte Carlo Tree Search (MCTS) com rollouts e busca prospectiva de turnos futuros.

---

## 3. Telemetria e Coleta de Logs (`SimulatorMatchLog`)

### Persistência de Partidas
Ao término de qualquer partida (seja amistosa entre jogadores, rankeada ou treino contra bot), o motor autoritativo aciona o `matchLogSink`, persistindo uma entrada detalhada na tabela `SimulatorMatchLog`:
- **Metadados**: `matchId`, `mode` (`casual`, `ranked`, `training`), `turnCount`, `winnerSeat`, `endReason` (`shield_destruction`, `deck_out`, `resignation`).
- **Decks e Jogadores**: Decks utilizados, nomes e identificadores.
- **Histórico Completo de Ações (`actionHistory`)**: Sequência JSON detalhada contendo assento, ação aplicada, carimbo de tempo e número do turno.

### Estatísticas e Agregação
O módulo [`src/modules/simulator/server/matchStats.ts`](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/server/matchStats.ts) processa esses logs para computar:
- Taxa de vitória por arquétipo/deck (ST01–ST04).
- Vantagem de primeiro jogador (Seat A vs Seat B).
- Distribuição de duração média de partidas em turnos e minutos.

---

## 4. Pipeline de Machine Learning e Salvaguardas de Produção

### Extração de Dataset
- Script [`scripts/train/dataset-from-logs.mjs`](file:///c:/WillenWorks/portal-gundam-tcg-br/scripts/train/dataset-from-logs.mjs) (`pnpm train:dataset-from-logs`):
  - Consulta a tabela `SimulatorMatchLog`.
  - Filtra partidas concluídas legitimamente.
  - Anonimiza dados e extrai tuplas `(viewState, legalActions, chosenAction, gameOutcome)` formatadas para treinamento de rede neural.

### Salvaguarda Estrita de Produção
Conforme definido em [`services/sim-bot/driveBotTurn.mjs`](file:///c:/WillenWorks/portal-gundam-tcg-br/services/sim-bot/driveBotTurn.mjs):
```javascript
const enableNeural =
  process.env.NODE_ENV !== "production" &&
  process.env.SIM_BOT_ENABLE_ML === "true";
```
- **Em Produção (`NODE_ENV=production`)**: A inferência neural via TensorFlow.js é **estritamente desabilitada**. O bot solo joga exclusivamente através da engine com política heurística determinística autoritativa.
- **Em Desenvolvimento (`dev`)**: A flag `SIM_BOT_ENABLE_ML=true` pode ser habilitada para rodar baterias de validação prática e auto-play com redes neurais.

---

## 5. Infraestrutura e Conformidade com o Render

### Arquitetura Oficial
- **Frontend**: Vercel (distribuição estática a partir da branch `main`).
- **Backend / API**: **Render** (`render.yaml`).
- **Banco de Dados**: Supabase PostgreSQL 16 (Session Pooler porta 5432).

### Execução do Bot no Render
1. **Runner Embutido (Padrão e Recomendado)**:
   - Em [`server/index.ts`](file:///c:/WillenWorks/portal-gundam-tcg-br/server/index.ts), configuramos `setBotTurnSink(...)` com um executor assíncrono.
   - Quando é a vez do bot, uma task assíncrona não-bloqueante joga no motor e notifica via Socket.IO com delay humanizado (~450ms).
   - **Vantagem**: Não requer provisionar container ou serviço secundário no Render, eliminando custos de infraestrutura no plano gratuito/starter.
2. **Worker Dedicado (Opcional para Alta Concorrência)**:
   - Se o volume de partidas crescer significativamente, o arquivo `render.yaml` possui a estrutura documentada para ativar um Background Worker (`type: worker`) rodando `node --import tsx services/sim-bot/index.mjs`.

---

## 6. Pendências e Próximos Passos (Roadmap)

1. **Validação Prática dos Logs de Jogo**:
   - Deixar o Modo Solo ativo em produção com o bot heurístico coletando partidas de jogadores reais.
   - Analisar o volume de logs acumulados em `SimulatorMatchLog` e a dispersão de jogadas.
2. **Ciclo de Treino e Homologação de ML**:
   - Rodar o treinamento com TensorFlow.js em ambiente local/dev via `pnpm sim:train`.
   - Validar se o modelo neural atinge winrate > 55% contra o bot heurístico em partidas golden.
   - Somente após essa validação prática o modelo será considerado para promoção.
3. **Ranking e Matchmaking no Simulador**:
   - Implementação de filas competitivas com cálculo de ELO e tabelas de classificação por temporada.
4. **Suporte a Novas Coleções (GD01 e EB01)**:
   - Extensão das specs de efeitos para cobrir habilidades complexas das expansões (alvos múltiplos, efeitos relativos).
