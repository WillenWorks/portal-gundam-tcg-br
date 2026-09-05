# Roteiro de Orquestração para Claude Code: Redesenho Visual do Simulador Gundam TCG (Nível Arena)

> **Documento Operacional para Execução com Claude Code e Subagentes Spartan**  
> **Referência Técnica e Arquitetura:** `PLANO_REDESENHO_VISUAL_SIMULADOR.md` e `implementation_plan.md`  
> **Branch de Trabalho:** `feature/simulador-pivot-visual-arena` (partindo de `dev`)  
> **Comandos de Validação Contínua:** `pnpm test` (295+ testes), `pnpm run check:types`, `pnpm run lint:simulator`

---

## 1. Análise Técnica da Stack, Ferramentas e Invariantes

### 1.1 Stack de Frontend e Tooling
- **Framework & Runtime:** React 19 + TypeScript (modo estrito configurado em `tsconfig.app.json` e `tsconfig.json`).
- **Bundler & Dev Server:** Vite 6 (`vite.config.ts`) com alias `@` mapeando para `./src`.
- **Roteamento:** `wouter` (NÃO é Next.js). Usa hooks leves como `useLocation()`.
- **Estilização & Design System:**
  - Tailwind CSS + Tokens OKLCH / CSS custom properties definidos em `src/index.css`.
  - **Tokens Obrigatórios:**
    - Primária: `--primary` (ciano ~215, usado em seleções legais, alvos e estrutura).
    - Acento: `--accent` (dourado ~92, usado em EX Resource, bônus LINK e destaque).
    - Superfícies: `.hero-surface`, `.surface-panel`, `.surface-strong`, `.panel-cut`.
    - Tipografia: `.font-heading`, `.font-body`, `.heading-portal`, `.text-soft`, `.text-muted-portal`.
    - Cantos: `rounded-none` estrito (estética militar mecha, cantos retos).
    - Semântica: Esmeralda = alvo legal / pagamento ok; Vermelho = combate / dano / seam; Âmbar = aviso / restrição.
- **Componentes Base:** Radix UI primitives (`@radix-ui/*`), ícones da `lucide-react`, toasts via `sonner`.
- **Testes Unitários e de Componente:**
  - Vitest + Testing Library React (`@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `jsdom`).
  - Cada teste de componente em `src/modules/simulator/ui/*.test.tsx` usa `// @vitest-environment jsdom`.

### 1.2 Arquitetura do Simulador e Mecânica de Estado
- **Motor Puro de Regras (`src/modules/simulator/engine/`):**
  - Totalmente funcional, imutável e determinístico (`types.ts`, `events.ts`, `combat.ts`, `dispatcher.ts`, `effectSpec.ts`, `deploy.ts`).
  - **INVARIANTE CRÍTICA:** Nenhuma linha dentro de `engine/`, `viewState.ts` ou `server/matchStore.ts` pode ser modificada.
- **Fluxo de Dados Cliente-Servidor:**
  - O cliente escuta eventos via SSE (`buildSimulatorStreamUrl`) e recebe o estado projetado `ViewGameState` filtrado para o assento do jogador (`seat: "A" | "B"`).
  - O jogador envia intenções através de `api.runSimulatorAction(matchId, action)`.
- **Sistema de Coordenadas e Linha de Mira (`CombatLane` + `useBoardElements`):**
  - O `useBoardElements` registra `ref`s DOM indexados por `instanceId` das Units ou `playerAreaKey(playerId)`.
  - O `CombatLane` desenha um overlay SVG com coordenadas absolutas de tela via `getBoundingClientRect()`.
  - **Atenção no Design:** O tabuleiro não pode sofrer transformações CSS arbitrarias (como o antigo `rotate(90deg)`) que quebrem a fidelidade do `getBoundingClientRect()`.

---

## 2. Mapa de Skills e Agentes do Repositório

Ao rodar tarefas com Claude Code, utilize a ativação das seguintes **Skills** e **Agentes** já configurados no projeto em `.claude/`:

| Skill / Agente | Localização | Como Claude Code deve utilizar |
| :--- | :--- | :--- |
| **`frontend-design`** | `.claude/skills/frontend-design` | **Ativação Obrigatória no Build:** Constrói os componentes com acabamento mecha industrial, evitando layouts genéricos de IA, respeitando os tokens `--primary`, `--accent` e `rounded-none`. |
| **`game-development`** | `.claude/skills/game-development` | **Ativação no Playmat:** Garante clareza espacial de TCG (zonas com proporção de carta 63:88, feedback visual de descanso 90°, mira e alvos legais). |
| **`ui-ux-pro-max`** | `.claude/skills/ui-ux-pro-max` | **Ativação em Componentes Interativos:** Micro-interações do leque de cartas (`HandFan`), transições acessíveis (respeitando `prefers-reduced-motion`) e feedback de botões com hit-area >= 44px. |
| **`react-best-practices`**| `.claude/skills/react-best-practices` | **Ativação em Re-renders:** Memoização estratégica (`React.memo`) para evitar re-renderizar 30 cartas a cada evento de ping/SSE. |
| **`mobile-design`** | `.claude/skills/mobile-design` | **Ativação em Mobile:** Enforce de orientação paisagem (landscape) e ergonomia de toque para dedos em tablets. |
| **`clean-code`** | `.claude/skills/clean-code` | **Ativação na Integração:** Garante redução líquida de complexidade e remoção de código morto no `SimulatorMatchPage.tsx`. |
| **`ai-designer`** | `.claude/agents/ai-designer.md` | **Agente de Prototipação:** Responsável por checar os 5 estados obrigatórios da tela (`default`, `loading`, `empty`, `error`, `edge`). |
| **`design-critic`** | `.claude/agents/design-critic.md` | **Agente Revisor de Design:** Avalia contraste (4.5:1), fidelidade de tokens e consistência visual contra o `PLANO_REDESENHO_VISUAL_SIMULADOR.md`. |
| **`phase-reviewer`** | `.claude/agents/phase-reviewer.md` | **Agente de Gate 3.5:** Executa a verificação pré-merge garantindo zero regressões e builds verdes. |

---

## 3. Estrutura de Sprints e Prompts de Execução para Claude Code

A reformulação está dividida em **4 Sprints Sequenciais**. Cada prompt abaixo é autocontido e pronto para ser copiado/colado no Claude Code, ou orquestrado via subagentes.

```
┌────────────────────────────────────────────────────────────────────────┐
│ SPRINT 1: Fundação do Virtual Canvas 16:9 & Grid Tático               │
│   Cria: RotateDevicePrompt.tsx, CardInspectorPanel.tsx, ArenaPlaymat.tsx│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ SPRINT 2: Modernização das Zonas (Shields, Recursos e Slots)           │
│   Refina: ShieldRail.tsx, ResourceMeter.tsx, BattleSlot.tsx           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ SPRINT 3: Mão em Leque Ancorada & Inspetor Lateral                     │
│   Integração: HandFan.tsx estático, eliminação da gaveta retrátil      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ SPRINT 4: Integração no SimulatorMatchPage & Validação Completa        │
│   Fiação completa, remoção de layout legado, pnpm test, check:types    │
└────────────────────────────────────────────────────────────────────────┘
```

---

### SPRINT 1: Fundação do Virtual Canvas 16:9 & Grid Tático

#### Explicação Técnica:
Cria o container principal da mesa de jogo com proporção estável de 16:9 (`ArenaPlaymat.tsx`), acabando com os problemas de `flex-wrap` que quebravam o layout. Também cria o prompt de orientação mobile para tela deitada (`RotateDevicePrompt.tsx`) e o painel de telemetria lateral para cartas em tempo real (`CardInspectorPanel.tsx`).

#### Prompt para Copiar/Colar no Claude Code:

````markdown
INVARIANTES DE EXECUÇÃO:
- Branch: feature/simulador-pivot-visual-arena (saindo de dev).
- NÃO alterar: src/modules/simulator/engine/*, src/modules/simulator/server/*, viewState.ts.
- Tokens: usar exclusivamente as variáveis do portal em src/index.css (--primary ciano, --accent dourado, panel-cut, hero-surface, rounded-none).
- Validação contínua: pnpm test && pnpm run check:types && pnpm run lint:simulator.

OBJETIVO DO SPRINT 1:
Implementar os 3 componentes de fundação do novo layout "Nível Arena" em src/modules/simulator/ui/:

1. Criar `src/modules/simulator/ui/RotateDevicePrompt.tsx`:
   - Componente exibido em dispositivos móveis no modo retrato (< 900px e orientation portrait).
   - Apresenta mensagem mecha convidando a girar para modo paisagem (landscape).
   - Ícone animado tático, tipografia font-heading, sem CSS transform rotate(90deg).

2. Criar `src/modules/simulator/ui/CardInspectorPanel.tsx`:
   - Painel de telemetria fixo para as asas de monitores largos (> 1400px ou container lateral).
   - Props: { card: CardInstance | null; art: ArtLookup; inPlay?: boolean; blockedReason?: string; className?: string }.
   - Quando vazio: exibe estado de "Sensor Tático em Espera".
   - Quando com carta: exibe arte em tamanho grande (CardFace lg), nome, código, tipo, atributos (nível, custo, AP, HP com highlight), traits, link conditions, keywords e modificadores ativos com badges estritos rounded-none.

3. Criar `src/modules/simulator/ui/ArenaPlaymat.tsx`:
   - Canvas com proporção virtual de 16:9 (aspect-[16/9] max-w-full max-h-full mx-auto relative flex flex-col justify-between overflow-hidden).
   - Estrutura de zonas oficiais do Gundam TCG (conforme PLANO_REDESENHO_VISUAL_SIMULADOR.md):
     - Topo (Oponente): Coluna esquerda (Shields + Base), Centro (Recursos + Mão do oponente), Coluna direita (Deck + Trash + Exílio).
     - Battle Area Superior: 6 slots de batalha do oponente.
     - Linha Central (The Seam): Canal de combate com gradiente vermelho/ciano sutil.
     - Battle Area Inferior: 6 slots de batalha do jogador.
     - Base (Jogador): Coluna esquerda (Shields + Base), Centro (Linha de Recursos), Coluna direita (Deck + Trash + Exílio).
     - Rodapé: Faixa ancorada para a mão do jogador.
   - Variável de escala única: define `--card: clamp(2.5rem, 5.2vw, 5.2rem)` para manter proporção perfeita sem overflow.

4. Atualizar `src/modules/simulator/ui/index.ts` exportando os 3 novos componentes.

Ao terminar: rode `pnpm test` e `pnpm run check:types` para assegurar que nenhum erro de sintaxe ou tipos foi introduzido.
````

---

### SPRINT 2: Modernização das Zonas (Shields, Recursos e Slots)

#### Explicação Técnica:
Adequa os componentes existentes de zona (`ShieldRail.tsx`, `ResourceMeter.tsx` e `BattleSlot.tsx`) para se encaixarem na topologia do Gundam TCG: escudos em cascata vertical na esquerda, linha horizontal de recursos sem quebra caótica, e slots de batalha com moldura táctica e piloto acoplado evidente.

#### Prompt para Copiar/Colar no Claude Code:

````markdown
INVARIANTES DE EXECUÇÃO:
- Branch: feature/simulador-pivot-visual-arena.
- NÃO alterar: src/modules/simulator/engine/*, src/modules/simulator/server/*, viewState.ts.
- Tokens: usar exclusivamente as variáveis do portal em src/index.css (--primary ciano, --accent dourado, rounded-none).
- Validação contínua: pnpm test && pnpm run check:types && pnpm run lint:simulator.

OBJETIVO DO SPRINT 2:
Refinar e modernizar os componentes de zona em src/modules/simulator/ui/ para a topologia do ArenaPlaymat:

1. Atualizar `src/modules/simulator/ui/ShieldRail.tsx`:
   - Adicionar prop opcional `orientation?: "horizontal" | "vertical"` (padrão "horizontal").
   - Em modo vertical: empilhar os pips de shield em uma coluna tática elegante (estilo Mobile Suit Arena, borda esquerda).
   - Manter hit-area de >= 44px quando `selectable` for true.
   - Atualizar `ShieldRail.test.tsx` com teste cobrindo a renderização vertical.

2. Atualizar `src/modules/simulator/ui/ResourceMeter.tsx`:
   - Adicionar prop `className?: string`.
   - Reestruturar o layout dos recursos: em vez de flex-wrap aleatório que quebra sobre o campo, dispor em linha contínua e compacta.
   - Cada recurso ativo é representado como mini-carta vertical com moldura ciano suave; recursos gastos (rested) rotacionados a 90°; EX Resource com destaque dourado (`--accent`).
   - Se `costProgress` for informado, exibir a barra de pagamento de custo com contraste alto (esmeralda).
   - Garantir que `ResourceMeter.test.tsx` continue passando com 100% de sucesso.

3. Refinar `src/modules/simulator/ui/BattleSlot.tsx`:
   - Ajustar proporção estrita aspect-[63/88].
   - Slot vazio: textura sutil de hangar com borda tracejada de alta visibilidade (`border-cyan-500/20 bg-slate-900/40`).
   - Slot ocupado: destacar o acoplamento do piloto (`DockedPilot`) na base da carta com badge LINK luminoso quando ativado.
   - Badges de combate: AP em ciano/dourado no canto inferior esquerdo, HP no canto inferior direito com indicador de dano acumulado.
   - Ações de combate (Atacar, Mirar aqui, Blocker) com botões de acionamento nítidos e área de toque >= 44px.

Ao terminar: rode `pnpm test` e `pnpm run check:types`.
````

---

### SPRINT 3: Mão em Leque Ancorada & Inspetor Lateral

#### Explicação Técnica:
Substitui o antigo drawer retrátil (`HandDrawer.tsx`) por uma prateleira tática inferior onde a mão do jogador fica sempre presente e visível (`HandFan.tsx`), com elevação suave em hover/focus. Elimina o atrito de ter que abrir e fechar gavetas para jogar cartas.

#### Prompt para Copiar/Colar no Claude Code:

````markdown
INVARIANTES DE EXECUÇÃO:
- Branch: feature/simulador-pivot-visual-arena.
- NÃO alterar: src/modules/simulator/engine/*, src/modules/simulator/server/*, viewState.ts.
- Tokens: usar exclusivamente as variáveis do portal em src/index.css (--primary ciano, --accent dourado, rounded-none).
- Validação contínua: pnpm test && pnpm run check:types && pnpm run lint:simulator.

OBJETIVO DO SPRINT 3:
Aprimorar a apresentação da mão do jogador e a experiência de inspeção de cartas:

1. Refinar `src/modules/simulator/ui/HandFan.tsx`:
   - Permitir exibição na base da arena como prateleira de comando permanente.
   - As cartas mostram o terço superior em repouso (custo, cor, nome, nível).
   - No hover/foco (e toque no mobile): a carta se eleva suavemente (lift de -1.5rem) sem cobrir os slots da Battle Area.
   - Cartas jogáveis exibem brilho de prontidão ciano (`border-primary shadow-[0_0_10px_rgba(6,182,212,0.4)]`).
   - Cartas cujo custo não pode ser pago permanecem com tom atenuado e badge sutil de bloqueio.
   - Clicar na carta dispara o evento de preview ou pagamento direto.

2. Integrar evento de Hover no `ArenaPlaymat`:
   - Passar callback `onHoverCard?: (card: CardInstance | null) => void` para as Units em campo, Base e cartas da mão.
   - Esse callback alimenta o `CardInspectorPanel` em telas largas, permitindo leitura instantânea sem abrir modais.

Ao terminar: rode `pnpm test` e verifique que `HandFan.test.tsx` e todos os testes continuam verdes.
````

---

### SPRINT 4: Integração no SimulatorMatchPage & Validação Completa

#### Explicação Técnica:
Conecta a tela principal (`SimulatorMatchPage.tsx`) ao novo `ArenaPlaymat` e ao `RotateDevicePrompt`. Remove os métodos legados de renderização dispersa (`renderSide`, `renderLeftColumn`, `renderRightColumn`, `MOBILE_ROTATE_QUERY`), integrando o `ActionDock` no canto tático estilo Master Duel.

#### Prompt para Copiar/Colar no Claude Code:

````markdown
INVARIANTES DE EXECUÇÃO:
- Branch: feature/simulador-pivot-visual-arena.
- NÃO alterar: src/modules/simulator/engine/*, src/modules/simulator/server/*, viewState.ts.
- Tokens: usar exclusivamente as variáveis do portal em src/index.css.
- Validação contínua: pnpm test && pnpm run check:types && pnpm run lint:simulator.

OBJETIVO DO SPRINT 4:
Fazer a fiação completa da nova arena em `src/pages/SimulatorMatchPage.tsx`:

1. Substituição de Layout:
   - Substituir o container do grid de 5 faixas e os métodos legados (`renderSide`, `renderLeftColumn`, `renderRightColumn`) pela invocação direta do `<ArenaPlaymat />`.
   - Passar as props estruturadas:
     - Estado dos jogadores (`view.players[seat]` e `view.players[opponentSeat]`).
     - Lookups de arte (`art`).
     - Handlers de combate, mira (`CombatLane`), seleção e bloqueio.
     - Registro de elementos do tabuleiro (`board.register`).
   - Em telas largas (> 1400px): posicionar `<CardInspectorPanel />` na asa esquerda e `<BattleLogDrawer />` na asa direita de forma integrada.

2. Substituição do Truque de Rotação Mobile:
   - Remover o hook de rotação CSS 90° (`MOBILE_ROTATE_QUERY` e transform rotate(90deg)).
   - Exibir `<RotateDevicePrompt />` quando o dispositivo for detectado em modo retrato (< 900px e portrait).

3. Integração do Console de Ações (`ActionDock`):
   - Ancorar o `ActionDock` de forma harmoniosa no canto inferior direito, integrado visualmente à moldura do playmat.
   - Assegurar que botões de "Passar", "Encerrar Turno" e "Confirmar" tenham visibilidade e resposta instantânea.

4. Validação Rigorosa:
   - Executar `pnpm test` (garantir 295+ testes passando).
   - Executar `pnpm run check:types` (tsc -b deve passar com zero erros).
   - Executar `pnpm run lint:simulator` (eslint no módulo do simulador deve passar limpo).
   - Conferir redução de linhas de código e ausência de código morto.

Ao terminar: gere um resumo com o diff do que foi criado e do que foi deletado.
````

---

## 4. Guia de Validação Visual & QA Pós-Implementação

Após a execução dos 4 sprints pelo Claude Code, utilize o seguinte roteiro para validação funcional no navegador com duas contas de teste:

1. **Subir os servidores locais:**
   ```bash
   pnpm dev:full
   ```
2. **Abrir duas sessões pareadas:**
   - Janela 1 (Normal): `http://localhost:5173/simulador` (Jogador A).
   - Janela 2 (Anônima): `http://localhost:5173/simulador` (Jogador B).
   - Entrar na fila e parear a partida para navegar para `/simulador/partida/:matchId`.
3. **Checklist de Verificação:**
   - [ ] A arena permanece perfeitamente centralizada em 16:9 em qualquer resolução (1080p, 1440p, tela redimensionada).
   - [ ] Nenhum texto ou elemento (`ResourceMeter`, contadores) quebra de linha de forma desordenada.
   - [ ] Passar o mouse sobre uma Unit do oponente ou da sua mão reflete instantaneamente seus dados no `CardInspectorPanel` (em telas largas).
   - [ ] A linha tracejada de mira (`CombatLane`) continua ligando com precisão milimétrica a Unit atacante ao alvo.
   - [ ] Jogar carta, pagar recursos ativos e encerrar turno responde com fluidez e feedback visual claro no `ActionDock`.
   - [ ] Em celulares no modo retrato, o aviso tático para girar a tela é acionado corretamente.
