# Plano Estratégico & Técnico: Pivot Visual do Simulador Gundam TCG (Nível Arena)

> **Documento de Arquitetura Visual, Game Design e UX/UI**  
> **Status:** Proposta para Validação (Planning Mode)  
> **Autor:** Antigravity / Pair Programming  
> **Base de Código:** `portal-gundam-tcg-br` (Branch base: `dev`)  
> **Invariante Fundamental:** O motor de regras (`src/modules/simulator/engine/*`), o estado de rede (`viewState.ts`), as APIs e o `matchStore.ts` do servidor permanecem **100% intocados**.

---

## 1. Diagnóstico do Estado Atual vs. Referências de Mercado

### 1.1 Análise da Imagem 1 (Estado Atual do Simulador)
O simulador atual alcançou um marco impressionante em termos de regras (295 testes verdes, cobrindo 100% de ST01/ST02 com prioridade, combate, burst e gatilhos). Contudo, a camada visual sofre de uma crise de identidade entre **documento web responsivo** e **mesa de jogo tático (digital playmat)**:

1. **Mentalidade de Documento Web (`flex-wrap` / Fluxo Dinâmico)**:
   - Ao tentar usar `flex-wrap`, `gap-y-1` e `clamp()` dispersos em um layout livre, as zonas quebram de linha aleatoriamente dependendo do aspect-ratio da tela.
   - Na Imagem 1, o texto `◆ 1 ativos • nível 1` e o medidor de recursos quebraram a linha e foram parar no meio do vazio, flutuando de forma desordenada acima dos slots de batalha.
2. **Sensação de Dashboard Administrativo em vez de Jogo Mecha**:
   - Base, Shields, Deck, Trash e Exílio aparecem como uma linha de "chips" ou botões de métricas (`TRASH 0`, `EXÍLIO 0`, `DECK 39`), perdendo a espacialidade física de um card game real.
   - Não há distinção clara de "meu lado da arena" vs "lado inimigo" além de uma linha vermelha fina no centro.
3. **Desconexão da Mão (Gaveta / Drawer Retrátil)**:
   - A mão do jogador fica escondida dentro de um accordion/drawer no rodapé (`✋ MÃO (6) • 6 JOGÁVEIS ^`).
   - Isso adiciona fricção mecânica contínua: para jogar, o jogador precisa abrir a gaveta, olhar as cartas, tocar em "Jogar", a gaveta fecha para revelar os recursos, o jogador clica nos recursos e confirma no ActionDock. A sensação de "segurar e manipular cartas" foi suprimida.
4. **Falta de Inspetor Contínuo de Cartas (Fadiga de Modais)**:
   - Ler uma carta exige abrir um modal em tela cheia que tampa o campo de batalha, quebrando o raciocínio tático.
5. **Slots de Batalha Desproporcionais e "Vazios"**:
   - Os 6 slots aparecem como retângulos wireframe finos e esticados, sem textura de playmat, sem indicação de piloto acoplado de forma intuitiva, e sem presença de palco.

---

### 1.2 Análise da Imagem 2: Yu-Gi-Oh! Master Duel
*Master Duel* é a referência de ouro na indústria de TCG digital para alta densidade de informação com clareza cristalina:

| Característica Master Duel | Como Funciona | Aplicação no Gundam TCG |
| :--- | :--- | :--- |
| **Virtual Canvas Fixo (16:9 Landscape)** | O jogo **nunca** tenta refazer o grid conforme o viewport estica. A arena inteira vive em um container com aspect-ratio virtual de 16:9 que escala uniformemente (`contain`), preservando posições relativas milimétricas em 4K, 1080p, iPad ou celular em paisagem. | **Pilar Central:** Fixar a Arena em proporção paisagem 16:9/16:10. Acabar com as quebras de linha acidentais (`flex-wrap`). |
| **HUD de Cantos Táticos** | Top-Right: Oponente (Avatar, Nome, LP, cartas na mão).<br>Bottom-Left: Jogador (Avatar, Nome, LP). | Remove textos soltos pelo campo e ancora dados vitais onde o olho humano busca naturalmente. |
| **Botão de Fase / Turno Centralizado no HUD** | Canto direito central: Indicador claro de Turno, Fase ativa (Draw, Main, Battle) e botão tático de avanço. | O `ActionDock` deixa de ser um card solto no canto e se torna o **Console de Comando Tático**. |
| **Pedestais e Pilhas Físicas** | Cemitério, Extra Deck e Banished não são textos: são pedestais 3D com a última carta no topo e um contador nítido. | Deck e Trash passam a ter a representação física de baralho e pilha de descarte. |
| **Inspetor Lateral Estático** | Clicar ou passar o mouse sobre qualquer carta projeta instantaneamente a imagem em alta resolução e o texto no painel lateral esquerdo (em telas wide), sem abrir modais. | Elimina a necessidade de modais para leitura de cartas durante o jogo. |

---

### 1.3 Análise das Imagens 3 e 4: Mobile Suit Arena (Gundam TCG)
O *Mobile Suit Arena* (Images 3 e 4) é o referencial direto das regras oficiais do Gundam TCG, trazendo a topologia exata das zonas:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   [MÃO DO OPONENTE]                                         │
│  [SHIELDS OPONENTE]    [BASE]      [RECURSOS OPONENTE (Fileira Horizontal)]    [DECK / LIXO]│
│  (Pilha vertical       (Carta      (Cartas viradas / EX Resource dourado)      (Pilhas      │
│   na borda esquerda)    com HP)                                                 na direita) │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                         BATTLE AREA DO OPONENTE (6 SLOTS DE UNITS)                          │
│                         [Unit 1] [Unit 2] [Unit 3] [Unit 4] [Unit 5] [Unit 6]               │
│                            └─ Pilotos acoplados em cascata vertical                         │
├═════════════════════════════════════ A SEAM CENTRAL ════════════════════════════════════════┤
│                         BATTLE AREA DO JOGADOR (6 SLOTS DE UNITS)                           │
│                         [Unit 1] [Unit 2] [Unit 3] [Unit 4] [Unit 5] [Unit 6]               │
│                            └─ Pilotos acoplados em cascata vertical                         │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  [SEUS SHIELDS]        [SUA BASE]  [SEUS RECURSOS (Fileira Horizontal)]        [SEU DECK]   │
│  (6 shields verticais)  (Carta)     (Cartas deitadas = rested / em pé = ativas) [SEU TRASH] │
│                                                                                             │
│                                    [SUA MÃO NA BASE]                                        │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Problemas Identificados no Mobile Suit Arena a Corrigir no Nosso Design:
1. **Contraste e Legibilidade**: Fundo branco clínico/estéril ("laboratório") faz com que cartas brancas e textos claros se percam. O nosso tema de **cockpit mecha escuro (`bg-slate-950` com acentos ciano/dourado e texturas de hangar/hud)** é infinitamente superior em ergonomia visual e imersão.
2. **Responsividade Estática**: No Mobile Suit Arena original, telas menores cortam elementos ou sobrepõem o leque de cartas sem adaptação.
3. **Falta de Feedback de Ações (Action Dock)**: Falta uma barra de comando que diga explicitamente ao jogador "O que você precisa fazer agora" (ex: "Selecione 2 recursos para pagar o custo").

---

## 2. Decisão Arquitetural: Correção Superficial vs. Pivot Visual

### Por que NÃO fazer uma correção superficial?
Tentar "consertar" o layout atual apenas ajustando CSS no `SimulatorMatchPage.tsx` continuará gerando problemas crônicos:
- O `flex-wrap` continuará quebrando elementos dependendo da largura e altura da janela.
- A mão continuará precisando de um drawer retrátil para não espremer a Battle Area.
- O campo continuará parecendo um formulário HTML em vez de um cockpit tático de Gundam.

### A Decisão: **Pivot Visual para o "Arena Virtual Canvas (16:9 Landscape)"**
Pivotaremos a tela de partida para uma arquitetura consagrada de jogos de cartas digitais:
1. **Container Principal `ArenaPlaymat`**:
   - Aspect ratio fixo de 16:9 (com suporte responsivo a 16:10 / ultrawide).
   - Ocupa o máximo de espaço possível na tela sem nunca transbordar (`max-w-full max-h-full aspect-[16/9]`).
   - Em telas ultrawide (> 16:9), as sobras laterais são aproveitadas para:
     - **Esquerda:** Painel Fixo de Inspeção de Carta (Hover/Click Inspector).
     - **Direita:** Feed de Log de Batalha em tempo real + Console do ActionDock.
2. **Mobile / Telas Verticais**:
   - Alinhado com *Master Duel*, o simulador TCG **exige orientação horizontal (landscape)**.
   - Em smartphones no modo retrato, exibiremos um overlay tático com animação mecha instruindo: *"Gire o dispositivo para o modo paisagem para combater"*, eliminando o antigo truque de `rotate(90deg)` no CSS que gerava bugs de toque e overflow.

---

## 3. Blueprint Detalhado do Novo HUD e Playmat

### 3.1 Anatomia da Tela (Zonas Estáveis)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP HUD: [Sair] [Bug] | OPONENTE: ZeonAce (ST02) • Presença: Ativo | Turno 3 - Main Phase | Timer: 75s [Ping]│
├─────────────────┬─────────────────────────────────────────────────────────────────────────────┬──────────────┤
│ PAINEL LATERAL  │ ARENA DE BATALHA (16:9 VIRTUAL CANVAS)                                      │ PAINEL       │
│ ESQUERDO        │                                                                             │ DIREITO      │
│                 │ [ZONA SUPERIOR - OPONENTE]                                                  │              │
│ [CARD INSPECTOR]│ [Shields] [Base]     [Fileira de Recursos do Oponente]         [Deck/Trash] │ [BATTLE LOG] │
│ • Arte Grande   │ --------------------------------------------------------------------------- │ • Feed de    │
│ • Nome & Tipo   │ [BATTLE AREA DO OPONENTE - 6 SLOTS]                                         │   eventos    │
│ • Custo & Cor   │ [Slot 1]  [Slot 2]  [Slot 3]  [Slot 4]  [Slot 5]  [Slot 6]                  │   em tempo   │
│ • AP / HP       │                                                                             │   real       │
│ • Habilidade    │ ============================== THE SEAM =================================== │              │
│   Formatada     │ [SUA BATTLE AREA - 6 SLOTS]                                                 │ [ACTION DOCK]│
│                 │ [Slot 1]  [Slot 2]  [Slot 3]  [Slot 4]  [Slot 5]  [Slot 6]                  │ • Instrução  │
│                 │ --------------------------------------------------------------------------- │   tática     │
│                 │ [ZONA INFERIOR - JOGADOR]                                                   │ • Botoes de  │
│                 │ [Shields] [Base]     [Seus Recursos: 5 Ativos / Nível 4]       [Deck/Trash] │   Ação       │
│                 │ --------------------------------------------------------------------------- │ • Passar /   │
│                 │ [SUA MÃO: LEQUE TÁTICO SOBREPOSTO NA BORDA INFERIOR]                        │   Encerrar   │
└─────────────────┴─────────────────────────────────────────────────────────────────────────────┴──────────────┘
```

### 3.2 Detalhamento Zona a Zona

#### A. A Zona de Escudos (Shield Rail Vertical)
- **Localização:** Borda esquerda de cada lado da arena (assim como no Mobile Suit Arena).
- **Aparência:** 6 slots de escudos empilhados verticalmente em cascata mecha.
- **Feedback:**
  - Shield intacto: Moldura luminosa ciano/branca com verso da carta Gundam estilizado.
  - Shield quebrado: Slot esgotado em cinza escuro/wireframe.
  - Gatilho de Burst: Quando atacado, o shield pisca em âmbar/dourado antes de abrir o modal de decisão.

#### B. A Base (Base Section)
- **Localização:** Ao lado da pilha de escudos.
- **Aparência:** Slot destacado com a carta de Base em ângulo reto.
- **Gauges:** Barra de integridade tática (HP da Base) renderizada como um medidor de escudo mecha (verde -> amarelo -> vermelho conforme recebe dano).

#### C. A Linha de Recursos (Resource Runway)
- **Localização:** Faixa horizontal adjacente à Base.
- **Representação:**
  - Em vez de apenas um textomono `◆◆◆◇`, representamos as cartas de recursos como **mini-cartas tácticas**:
    - **Ativo:** Em pé, brilho ciano suave nas bordas.
    - **Rested (Gasto):** Inclinado 90°, diminuído em brilho.
    - **EX Resource:** Destaque dourado (`--accent`) com etiqueta `EX` inconfundível.
  - Clicabilidade no pagamento de custos: Os recursos ativos brilham em esmeralda; o jogador clica para pagar e o contador indica: `Pago: 2/3`.

#### D. A Battle Area (6 Slots Fixos com Pilotos Acoplados)
- **Localização:** O coração da tela, dividida ao meio pela linha central (*The Seam*).
- **Proporção:** Aspect ratio oficial de carta (63:88).
- **Acoplamento de Pilotos (Docked Pilots):**
  - O piloto não fica solto em um slot separado! Ele fica posicionado **embaixo da Unit**, projetando sua borda inferior (estilo Mobile Suit Arena), mostrando:
    - Retrato do piloto.
    - Modificador impresso de combate (ex: `+2/+2`).
    - Badge luminoso `LINK` quando o par for compatível com a característica da Unit.
- **Badges de Combate nos Slots:**
  - Canto inferior esquerdo: **AP Atual** (Ciano se normal, Dourado se buffado).
  - Canto inferior direito: **HP Restante** (Cinza/Verde se cheio, Vermelho se danificado).
  - Estado **Rested**: A Unit gira visualmente com badge tático `RESTED` e redução de opacidade.
  - Estado **Blocker**: Badge no topo `[BLK]` com borda azul elétrica.

#### E. A Linha de Conflito (*The Seam*) & Mira de Ataque
- A divisão entre as duas Battle Areas possui um canal emissor de dados:
  - Em espera: Linha tênue ciano/vermelha.
  - Ao declarar ataque: A linha SVG tracejada (`CombatLane`) projeta um feixe de mira do Mobile Suit atacante diretamente até o alvo (Unit inimiga ou Jogador/Shields).

#### F. O Deck, Descarte (Trash) e Exílio
- **Localização:** Borda direita de cada lado.
- **Deck:** Bloco com profundidade 3D (camadas de cartas) exibindo o número exato restante (ex: `38`).
- **Trash:** Mostra a última carta descartada no topo. Passar o mouse ou clicar abre a bandeja deslizante `PileTray` para inspecionar todas as cartas do descarte.
- **Exílio:** Ícone e contador tático de cartas removidas da partida.

#### G. A Mão do Jogador (Bottom Command Rail)
- **Como resolver o conflito da mão sem esconder o campo?**
  - A mão fica ancorada na borda inferior em um leque inteligente (`HandFan`).
  - Em estado de repouso: As cartas mostram seu terço superior (custo, cor, nome, nível).
  - Em hover/foco: A carta se eleva suavemente (lift tático), revelando o texto e a arte sem cobrir a Battle Area.
  - As cartas jogáveis no momento têm uma aura de prontidão ciano (`border-primary shadow-glow`). Cartas cujo custo não pode ser pago ficam sutilmente escurecidas.
  - **Jogar com 1 clique/arraste:** Clicar na carta inicia o fluxo de pagamento; se os recursos forem suficientes, o `ActionDock` solicita a confirmação ou alvos.

#### H. O Console Tático (ActionDock & HUD)
- O `ActionDock` deixa de flutuar como um bloco aleatório cobrindo a base:
  - Fica posicionado no canto inferior direito, integrado com o botão de **Passar / Encerrar Turno**.
  - Exibe com clareza máxima:
    - Estado atual: *"Sua Vez • Main Phase"*, *"Declarando Ataque"*, *"Selecione o Alvo"*, *"Aguardando Oponente"*.
    - Timer regressivo com barra de tempo (evita surpresa de timeout).
    - Botão primário com área de toque ampla (mínimo 48px).

---

## 4. Análise de Agentes e Skills do Projeto

O ecossistema do repositório já conta com ferramentas avançadas configuradas em `.claude/`. Mapeamos exatamente quais agentes e skills devem ser convocados em cada etapa da implementação:

### 4.1 Skills Específicas e Seu Uso Prático
1. **`frontend-design`**:
   - **Papel:** É a skill mais importante. Garante que os novos componentes em `src/modules/simulator/ui/` tenham linguagem de design mecha de alta patente (bordas chanfradas, glassmorphism sutil, tipografia mono/heading sem ser genérica, uso estrito das variáveis CSS `--primary`, `--accent`, `.hero-surface`).
2. **`game-development`**:
   - **Papel:** Rege a integridade espacial do tabuleiro (relação 63:88 das cartas, zona de colisão de mira, feedback visual de descanso/ativação de cartas, clareza de leitura instantânea do estado de jogo).
3. **`ui-ux-pro-max`**:
   - **Papel:** Refinamento dos estados dos botões, gauges de HP da Base, micro-interações do leque da mão (`HandFan`) e transições acessíveis (respeitando `prefers-reduced-motion`).
4. **`react-best-practices`**:
   - **Papel:** O simulador recebe atualizações frequentes via Server-Sent Events (SSE). O tabuleiro não pode re-renderizar todas as 30 instâncias de carta a cada ping de presença! Aplicação de `React.memo` cirúrgico e separação pura entre `ArenaPlaymat` (apresentação) e `SimulatorMatchPage` (orquestração).
5. **`mobile-design`**:
   - **Papel:** Padronização da regra de Landscape obrigatório em celulares e ajuste de targets de toque (>= 44px) em telas de tablet e monitores touch.
6. **`clean-code`**:
   - **Papel:** Eliminação do código legado no `SimulatorMatchPage.tsx`. O novo layout deve gerar **redução líquida de complexidade e linhas de código**.

### 4.2 Agentes Especializados e Gates de Qualidade
- **`ai-designer` (Ideação e Prototipação)**:
  - Gera protótipos de interface e valida os 5 estados obrigatórios da tela (`default`, `loading`, `empty`, `error`, `edge`).
- **`design-critic` (Gate Visual de Design)**:
  - Revisa rigorosamente o protótipo contra padrões genéricos de IA, checando contraste de cores (mínimo 4.5:1), fidelidade aos tokens do portal e ergonomia tática.
- **`phase-reviewer` (Gate 3.5 Pré-Merge)**:
  - Valida antes de qualquer merge em `dev` se os testes continuam 100% verdes (`pnpm test`), se o motor não foi alterado e se os tipos TypeScript passam ilesos (`pnpm run check:types`).

---

## 5. Roteiro de Implementação em 4 Etapas (Faseamento Seguro)

Para que o desenvolvimento seja seguro, sem quebrar o PvP atual nem o motor de regras, a transição será executada nas seguintes fases ordenadas:

### Fase 1: Fundação do Virtual Canvas 16:9 & Grid Tático
- **Objetivo:** Criar o container mestre `ArenaCanvas.tsx` e o novo `ArenaPlaymat.tsx` em `src/modules/simulator/ui/`.
- **Ações:**
  - Estabelecer a proporção 16:9 auto-contida (`max-w-[100vw] max-h-[100vh] aspect-[16/9] mx-auto`).
  - Desenhar as marcações das zonas no playmat com a nova topologia mecha (Shields verticais à esquerda, Battle Area central, Deck/Trash à direita).
  - Substituir o antigo `renderSide` disperso pelo grid estruturado do `ArenaPlaymat`.

### Fase 2: Reestruturação das Zonas Específicas
- **Objetivo:** Adaptar os componentes existentes para encaixar perfeitamente no novo canvas.
  - **`ShieldRail.tsx`:** Atualizar para renderizar como coluna vertical em cascata na borda esquerda.
  - **`BaseCardGauge.tsx`:** Posicionar ao lado dos Shields com barra de durabilidade integrada.
  - **`ResourceMeter.tsx`:** Transformar a linha de texto em mini-cartas de recursos (ativos em pé, gastos deitados, EX dourado) abaixo ou ao lado da Base.
  - **`BattleSlot.tsx`:** Aumentar a proeminência do slot; manter o acoplamento inferior do `DockedPilot` com identificação nítida de bônus de combate.

### Fase 3: Mão em Leque Ancorada & Inspetor Lateral
- **Objetivo:** Acabar com a gaveta que cobria a tela e fornecer leitura instantânea de cartas.
  - Integrar o `HandFan.tsx` de forma estática na base do canvas, com elevação suave em foco (`hover`/`active`).
  - Implementar o `CardInspectorPanel.tsx`: em telas largas (Desktop/Tablet), passar o mouse ou clicar em qualquer carta do campo/mão exibe instantaneamente a carta ampliada e formatada no painel lateral esquerdo, sem bloquear a visão do jogo.

### Fase 4: Console Tático (HUD & ActionDock Integrado) & Responsividade Landscape
- **Objetivo:** Unificar toda a interação do jogador em um console de comando imersivo.
  - Integrar o timer, indicador de turno e botão de avanço/fim de turno no canto inferior direito da arena.
  - Remover o antigo wrapper `MOBILE_ROTATE_QUERY` e implementar o bloqueio amigável de orientação em smartphones (`RotateDevicePrompt.tsx`).
  - Execução de testes de regressão (`pnpm test`), checagem de tipos e validação com 2 browsers pareados.

---

## 6. Critérios de Sucesso e Validação

1. **Zero Impacto no Motor de Regras**: O motor (`engine/`), `matchStore.ts` e `viewState.ts` permanecem intocados. Todos os 295 testes de regras continuam passando.
2. **Fim dos Elementos Deslocados**: Nenhum texto ou medidor (`ResourceMeter`) quebra linha de forma errática ou invade outras zonas.
3. **Ergonomia e Rapidez no PvP**: O jogador consegue olhar para o campo e identificar em menos de 2 segundos:
   - Quantos Shields restam para cada jogador.
   - Quantos recursos estão ativos e disponíveis para pagar cartas.
   - O AP e HP exato de cada Mobile Suit em campo.
   - O que sua mão tem disponível para jogar.
4. **Legibilidade sem Modais Intrusivos**: Capacidade de ler o texto completo de qualquer carta sem que um modal cubra o campo de batalha.
