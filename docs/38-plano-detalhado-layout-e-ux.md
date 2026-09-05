# Plano Detalhado: Layout do Simulador, Ergonomia & Microinterações (Doc 38)

> **Frente 3 & Frente 1 (Feedback.pdf)**  
> **Branch**: `feature/simulator-layout` (Simulador) & `dev` (Deckbuilder)  
> **Inspirações**: Playmat Oficial Gundam TCG, Master Duel, Magic Arena, Hearthstone, Wing Table, Mobile Suit Arena.

---

## 1. Diagnóstico do Estado Atual e Feedback Real (`Feedback.pdf`)

O simulador atual provou a solidez das regras de jogo, mas apresenta gargalos de experiência do usuário:
1. **HUD Reduzida em Monitores Full HD**: Cartas pequenas dificultam a leitura de estatísticas e ativam cliques acidentais em botões adjacentes.
2. **Botão de Inspeção ("Olho") Inconveniente**: O botão sobrepõe elementos cruciais e obstrui o contador de dano na carta de Base.
3. **Barra de Rolagem Horizontal nos Recursos**: Quando o jogador acumula recursos normais e EX, surge uma barra de rolagem horizontal indesejada no `ResourceMeter`.
4. **Seta de Ataque Desalinhada (`CombatLane`)**: Ao declarar ataque contra o jogador/vida, a seta aponta para o centro da mesa, enquanto a Base e a Zona de Escudos estão localizadas na lateral esquerda.
5. **Banner Central Superior Cortando Texto**: A palavra "Ação" no banner de fase/ação é cortada no canto direito em certas resoluções.
6. **Deckbuilder**: Falta de visualização da curva de nível e cálculo de nível na mão inicial; seletor de estilo visual posicionado muito abaixo na página.

---

## 2. Especificação da Arquitetura Visual e Geometria

### 2.1 Viewport Dinâmico Sem Scroll (`useArenaScale.ts` & `ArenaPlaymat.tsx`)
- O tabuleiro deve ser contido em um canvas centralizado com proporção fixa de playmat oficial (~16:9 ou 16:10).
- Em telas ultrawide (21:9), o espaço lateral é preenchido pelo log de batalha fixo (`BattleLogDrawer`) e painel de informações de carta, sem distorcer o campo.
- Em mobile, o componente `RotateDevicePrompt.tsx` continuará forçando a orientação paisagem (landscape). O grid utiliza escala proporcional para garantir que todas as zonas caibam sem scroll.
- O piso da variável CSS `--card-w` é elevado de `3.5rem` para um mínimo confortável que garanta botões de ação tátil com espaçamento de pelo menos `8px`.

### 2.2 Zonas do Tabuleiro (Grid Oficial)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ [OPONENTE] Mão Oculta | Decks & Descarte (Topo Direito)                 │
│ [OPONENTE] Base & Escudos (Esq) │ 6 Slots Battle Area │ Recursos (Dir)   │
├─────────────────────────────── SEAM CENTRAL ─────────────────────────────┤
│ [VOCÊ]     Base & Escudos (Esq) │ 6 Slots Battle Area │ Recursos (Dir)   │
│ [VOCÊ]     Deck & Descarte (Dir)│ Mão Aberta & ActionDock (Inferior)     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Resolução dos Pontos Críticos de Ergonomia

### 3.1 Inspeção de Cartas Direta (Eliminação do "Olhinho")
- O botão `<Eye />` em `CardCornerActions.tsx` é removido.
- **Novo Comportamento**: Clicar em qualquer área neutra da carta (corpo da carta, arte ou texto) dispara `openInspector(card)`.
- Os botões operacionais (Rest, Declarar Ataque, Bloquear, Skill) continuam ativos, posicionados com separação nítida para evitar toques acidentais.

### 3.2 Reposicionamento do Dano da Base (`BaseCardGauge.tsx`)
- O contador de dano acumulado da Base é movido para o **canto inferior direito** da carta de Base.
- Estilo: Badge com fundo escurecido semi-translúcido (`rgba(0, 0, 0, 0.85)`), borda sutil ciano/vermelho e tipografia monospace (`IBM Plex Mono`) de alto contraste.

### 3.3 Empilhamento de Recursos com Badges (`ResourceMeter.tsx`)
- Recursos idênticos (ex: cartas de recurso padrão da mesma cor ou múltiplos `EX Resource`) são agrupados visualmente em uma única pilha.
- Um badge numérico (ex: `x3`, `x5`) é exibido no topo direito da pilha de recursos.
- Isso reduz a largura total necessária em mais de 60%, garantindo que mesmo com 10+ recursos em jogo nunca surja barra de rolagem horizontal.

### 3.4 Seta Tática Alinhada (`CombatLane.tsx`)
- Quando a ação de ataque tem como alvo o jogador ou a zona de escudo, a curva de Bézier do SVG calcula o vetor de destino direcionado à coordenada real do `BaseCardGauge` / `ShieldRail` na lateral esquerda.
- Adiciona um pulso sutil na borda do escudo que está sob mira direta.

### 3.5 Banner Superior e Tipografia (`ActionDock.tsx` / `MatchPrompt.tsx`)
- Container do banner com `min-w-fit`, `padding-x: 1.25rem` e `white-space: nowrap`, com auto-ajuste de fonte para garantir que termos longos ("Fase Principal - Ação") nunca sejam truncados.

---

## 4. Microinterações e Efeitos Visuais Suaves

1. **Draw de Carta**: Transição suave via framer-motion da pilha do Deck para a mão do jogador (duração ~250ms, easing `easeOut`).
2. **Revelação de Escudo & Burst**: Ao perder um escudo, a carta sobe para o centro da tela em escala 1.2x com pulso de luz neon (ciano para recurso/unidade, dourado para Burst ativo).
3. **Declaração de Ataque / Bloqueio**: Elevação de 6px da unidade com leve inclinação na direção do alvo.
4. **Embaralhamento**: Efeito rápido de três cartas deslizando lateralmente ao reordenar o deck.

---

## 5. Ajustes de Plataforma no Deckbuilder (`dev`)

1. **Curva de Nível de Units**:
   - Componente de gráfico em barras em `src/pages/DeckDetailPage.tsx`, espelhando o gráfico existente de Curva de Custo.
   - Distribuição de Units por nível: Lv.1, Lv.2, Lv.3, Lv.4, Lv.5, Lv.6+.
2. **Probabilidade de Nível na Mão Inicial**:
   - Exibir na aba de Mão Inicial a chance percentual de comprar Units de nível baixo (Lv.1 a Lv.3) para garantir abertura sólida no turno 1.
3. **Reposicionamento do Estilo Visual (Capa e Sleeves)**:
   - Mover o bloco de seleção de estilo visual em `src/pages/DeckBuilderPage.tsx` para o topo, adjacente aos botões de Salvar Deck e Configurações Básicas.
