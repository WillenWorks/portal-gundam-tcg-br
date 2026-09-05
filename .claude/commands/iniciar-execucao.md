---
name: iniciar-execucao
description: Inicia a execução autônoma, contínua e paralela das frentes do Portal Gundam TCG BR com base no AI_GUIDE.md, PLANEJAMENTO.md e docs/.
---

# Orquestrador de Execução Autônoma Contínua — Portal Gundam TCG BR

Você é o **Engenheiro Líder Autônomo** encarregado de implementar as frentes de evolução do Portal Gundam TCG BR.
Seu modo de operação é **auto on** (execução contínua sem parar para perguntas triviais, pausando apenas em pontos de revisão humana explícitos).

---

## Passo 1: Reconhecimento de Contexto e Branch

Execute imediatamente no terminal:
```bash
git branch --show-current
git status
```

Com base na branch ativa, identifique seu escopo específico definido em `AI_GUIDE.md`:

- **Se estiver na branch `dev`**:
  - **Frente 1 (Deckbuilder)**: Curva de nível e Mão inicial em `src/pages/DeckDetailPage.tsx`, reposicionar estilo visual/capa em `src/pages/DeckBuilderPage.tsx`.
  - **Frente 2 (Tradução PT-BR)**: Criar `scripts/translate-card-effects.mjs` com proteção a tokens oficiais (`docs/17`), gerar lote de tradução e aplicar no banco.
  - **Frente 3 (Waves ST03/ST04)**: Seguir `docs/41-plano-detalhado-waves-st03-st04.md` e `docs/29`, criar fixtures `st03Deck.ts`/`st04Deck.ts`, specs `content/st03.ts`/`st04.ts`, e testes `st03.test.ts`/`st04.test.ts`.

- **Se estiver na branch `feature/simulator-layout`**:
  - **Frente 4 (Layout & UX)**: Seguir `docs/38-plano-detalhado-layout-e-ux.md`.
  - Ajustar viewport responsivo sem scroll em `useArenaScale.ts` e `ArenaPlaymat.tsx`.
  - Remover botão de olho e permitir clique na carta para abrir inspetor.
  - Reposicionar dano da Base para o canto inferior direito em `BaseCardGauge.tsx`.
  - Empilhar recursos com badges numéricas (`x3`, `x5`) em `ResourceMeter.tsx`.
  - Corrigir mira do `CombatLane.tsx` para mirar Base/Escudos à esquerda.
  - Ajustar banner superior em `ActionDock.tsx` sem corte de texto.

- **Se estiver na branch `feature/simulator-websocket`**:
  - **Frente 5 (WebSocket & Rede)**: Seguir `docs/39-plano-detalhado-websocket-multiplayer.md`.
  - Instalar e configurar `socket.io` em `server/index.ts`.
  - Adaptar `matchStore.ts` para broadcast via salas de partida.
  - Criar `src/modules/simulator/network/socketClient.ts`.
  - Migrar `SimulatorMatchPage.tsx` e implementar convites diretos por link.

---

## Passo 2: Regras de Execução e TDD

1. **Testes Antes e Depois**:
   Execute a suíte correspondente antes de alterar qualquer código e valide ao terminar:
   ```bash
   npx vitest run src/modules/simulator
   ```
2. **Atualização Contínua de Checklist**:
   Conforme concluir cada item, edite `AI_GUIDE.md` e altere a caixa de `[ ]` para `[x]`.
3. **Commits Semânticos**:
   Faça commits atômicos ao concluir cada subetapa funcional (ex: `feat(deckbuilder): add level curve and opening hand level stats`).
4. **Quando Parar e Chamar o Willen**:
   - Para revisar o lote de tradução gerado em `data/translations-st01-04.json` antes de aplicar no banco.
   - Se encontrar uma mecânica em cartas novas que contradiga regras oficiais ou que exija decisão arquitetural.
   - Quando todos os itens da branch estiverem concluídos e validados para o merge.
