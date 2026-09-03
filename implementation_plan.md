# Plano de Implementação: Pivot Visual do Simulador Gundam TCG (Nível Arena)

Proposta de redesenho e pivot visual do simulador PvP do Gundam TCG, corrigindo a dispersão de elementos e falta de coesão do layout responsivo atual, adotando uma arquitetura de **Virtual Canvas 16:9** (Master Duel) com a **topologia oficial de zonas** do Gundam TCG (Mobile Suit Arena) e **estética tática mecha**.

---

## User Review Required

> [!IMPORTANT]
> **Decisão Chave: Adoção do Virtual Canvas 16:9 com Landscape Obrigatório no Mobile**
> Como evidenciado em jogos digitais de alta performance tática (*Master Duel*, *MTG Arena*), arenas de card game com 6 colunas de batalha, escudos, bases e recursos não funcionam bem com flexbox livre que quebra linhas. Propomos fixar a proporção da arena em **16:9 / 16:10**, exigindo que dispositivos móveis joguem na horizontal ("tela deitada", padrão Master Duel), substituindo o antigo truque de rotação CSS de 90°.

> [!NOTE]
> **Invariante Crítica:** Toda a alteração é restrita à **camada de apresentação (UI)**. O motor de regras puro (`src/modules/simulator/engine/*`), a serialização de rede (`viewState.ts`), as APIs e o servidor (`matchStore.ts`) permanecem **100% intactos**.

---

## Open Questions

1. **Posicionamento do Inspetor de Cartas em Telas Menores (Laptops e Tablets)**:
   - Em telas Widescreen (>16:9), o inspetor de cartas ficará fixo na lateral esquerda em tempo real (hover/click). Em telas 16:9 justas ou tablets, prefere que o clique em uma carta abra um painel retrátil lateral (slide-over) ou mantenha um modal compacto de overlay?
2. **Representação dos Recursos no Campo**:
   - Prefere que os recursos continuem com a opção de tokens geométricos minimalistas (`◆◆◇` estilizados como mini-cartas) ou que renderizem as ilustrações reais de verso de carta com selo de facção?

---

## Proposed Changes

### Camada de Apresentação e Tabuleiro (`src/modules/simulator/ui/`)

O layout será desacoplado da orquestração da página, introduzindo componentes dedicados que garantem proporção estável e zonas bem delineadas.

---

#### [NEW] [ArenaPlaymat.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/ArenaPlaymat.tsx)
- Container de proporção virtual 16:9 (`aspect-[16/9] max-w-full max-h-full`).
- Define as regiões táticas oficiais de forma estática (sem quebras de linha acidentais):
  - **Coluna Esquerda:** `ShieldRail` vertical + `BaseCardGauge`.
  - **Teatro Central:** Battle Area do oponente (6 slots), Linha Central (*The Seam*), Battle Area do jogador (6 slots), Linha de Recursos horizontal.
  - **Coluna Direita:** Deck (com profundidade 3D), Descarte (Trash com preview da última carta) e Exílio.
  - **Rodapé:** Leque de cartas da mão (`HandFan`) ancorado e acessível.

#### [MODIFY] [ShieldRail.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/ShieldRail.tsx)
- Suporte a orientação vertical em cascata mecha (borda esquerda da arena).
- Estados visuais aprimorados para escudos intactos, quebrados e animação de alerta de Burst.

#### [MODIFY] [ResourceMeter.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/ResourceMeter.tsx)
- Reorganizar a disposição de recursos para que nunca transborde ou flutue sobre os slots de batalha.
- Apresentar mini-cartas de recursos (ativos em pé, gastos em 90°, EX Resource com acabamento dourado `--accent`).
- Feedback explícito de pagamento de custos (`Pago: X / Y`).

#### [MODIFY] [BattleSlot.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/BattleSlot.tsx)
- Melhorar a textura de fundo do slot (moldura de acoplamento de Mobile Suit).
- Refinar a renderização do piloto acoplado (`DockedPilot`) para que pareça uma extensão natural da unidade.
- Badges de combate de alta visibilidade: AP e HP efetivos calculados dinamicamente com cores de status tático.

#### [NEW] [CardInspectorPanel.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/CardInspectorPanel.tsx)
- Painel lateral fixo nas asas de telas widescreen.
- Mostra instantaneamente a arte em alta resolução, atributos, traços e texto de habilidade da carta sob foco, sem interrupção de jogo.

#### [MODIFY] [ActionDock.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/ActionDock.tsx)
- Integrar harmoniosamente o console de ações com o botão de avanço/fim de turno no estilo Master Duel.
- Manter clareza cirúrgica dos estados (jogando, atacando, defendendo, prioridade de action step).

#### [NEW] [RotateDevicePrompt.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/RotateDevicePrompt.tsx)
- Overlay amigável para dispositivos móveis no modo retrato convidando a girar a tela para a horizontal, eliminando o hack instável de CSS `transform: rotate(90deg)`.

---

### Orquestração da Página de Partida (`src/pages/`)

---

#### [MODIFY] [SimulatorMatchPage.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/pages/SimulatorMatchPage.tsx)
- Remover o antigo grid de 5 faixas fragmentado (`renderLeftColumn`, `renderRightColumn`, `frontStrip` com `flex-wrap`).
- Integrar o novo `ArenaPlaymat` passando as props de estado puro já disponíveis (`view`, `art`, `selected`, `attackerId`, `combat`, etc.).
- Remover o `MOBILE_ROTATE_QUERY` legado em favor do `RotateDevicePrompt`.
- Redução líquida de linhas e complexidade na página principal.

---

## Verification Plan

### Automated Tests
Execução da suíte completa de testes para garantir que nenhuma lógica funcional ou de renderização foi quebrada:
```bash
# Rodar todos os 295 testes de motor, lógica e UI
pnpm test

# Validação estrita de tipos TypeScript (zero erros)
pnpm run check:types

# Checagem de lint do módulo do simulador
pnpm run lint:simulator
```

### Manual Verification
1. **Inspeção nos Breakpoints (Playwright / Browser DevTools)**:
   - **4K / Full HD (1920x1080)**: Arena perfeitamente centralizada em 16:9; painel esquerdo exibe o inspetor de carta ao passar o mouse; painel direito exibe o log de batalha; zero quebras de linha no medidor de recursos.
   - **Notebook (1366x768 / 1440x900)**: Arena escala suavemente sem rolagem vertical ou horizontal; cartas e textos permanecem 100% nítidos.
   - **Mobile Paisagem (844x390 landscape)**: Arena ocupa toda a tela; botões de ação e cartas mantêm área de toque >= 44px.
   - **Mobile Retrato (390x844 portrait)**: Tela exibe prompt mecha orientando a girar o aparelho.
2. **Validação do Fluxo PvP Real (2 Contas Conectadas)**:
   - Iniciar sessão com duas contas pareadas em `/simulador`.
   - Executar ciclo completo de jogo:
     - Comprar carta na Draw Phase.
     - Pagar recurso ativo e fazer deploy de Mobile Suit.
     - Acoplar Piloto e verificar o badge `LINK` e cálculo de AP/HP.
     - Declarar ataque com feixe de mira `CombatLane`.
     - Responder com Blocker ou tomar dano no Shield.
     - Verificar quebra de shield e resolução de Burst.
     - Encerrar turno e passar prioridade no `ActionDock`.
