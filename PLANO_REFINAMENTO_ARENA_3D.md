# Plano de Ação: Refinamento Visual Arena 3D, Ergonomia e Espelhamento

> **Documento de Especificação Técnica e Guia para Claude Code**  
> **Base:** Análise das 5 imagens enviadas após os Sprints 1–4  
> **Branch de Execução:** `feature/simulador-pivot-visual-arena` (merge futuro em `dev`)  
> **Invariante:** Motor de regras (`engine/*`), `viewState.ts` e servidor (`matchStore.ts`) permanecem 100% intocados.

---

## 1. Diagnóstico Detalhado das 5 Imagens

### 1.1 Imagem 1 (100% Zoom) — Colisão e Sobreposição na Battle Area
- **Causa Raiz:** No `BattleSlot.tsx`, o botão de ação rápida (`Atacar` / `Mirar aqui` / `Blocker`) foi inserido como um elemento de bloco (`h-11`, 44px) **abaixo** da carta de Unit.
- Ao somar a altura da carta (aspecto 63:88) + piloto acoplado + botão de 44px, o slot da Unit do jogador expande para baixo e invade a linha central (*The Seam*) e a Battle Area do oponente.
- **Correção:** Os botões de ação rápida devem ser **overlays flutuantes sobre a própria carta** (posicionados na base ou topo do CardFace, com z-index alto), mantendo a altura externa do slot rigorosamente constante em `aspect-[63/88]`.

### 1.2 Imagem 2 (75% Zoom) — Escala Reduzida e Vazio Horizontal
- Ao reduzir o zoom do navegador para 75%, tudo encolheu proporcionalmente, tornando as cartas difíceis de ler.
- A proporção das cartas no viewport estava contida demais (`--card: clamp(2.5rem, 5.2vw, 5.2rem)`).
- **Correção:** Aumentar a escala base `--card` para `clamp(3.5rem, 6.5vw, 6.2rem)` e aplicar uma **camada de perspectiva 3D (estilo Master Duel)**, trazendo o campo do jogador para o primeiro plano (maior e com destaque) e o campo do oponente levemente recuado em profundidade.

### 1.3 Imagem 3 e 4 — Topologia Oficial por Cores & Espelhamento do Oponente
As anotações coloridas do usuário nas Imagens 3 e 4 definem a arquitetura exata do campo:

| Cor / Zona | Localização no Lado do Jogador | Comportamento e Regras |
| :--- | :--- | :--- |
| **Vermelho (Base)** | Lateral esquerda, no topo da área de shields | Exibe a carta da Base com gauge de durabilidade. Mostra apenas o dano recebido/HP restante. Sem textos redundantes. |
| **Laranja (Shields)** | Lateral esquerda, logo abaixo da Base | 6 escudos em cascata vertical sobreposta (ordenados de cima para baixo). O número de escudos é deduzido visualmente pelas cartas/pips. |
| **Verde (Battle Area)** | Centro da tela (6 slots fixos) | Slots com moldura tática. O piloto fica acoplado **por baixo da unidade**, revelando apenas a faixa do rosto e bônus (estilo Mobile Suit Arena). |
| **Azul Claro (Cartas)** | Dentro dos slots de batalha | Mostra a carta inteira. Apenas números de AP e HP atuais sobrepostos nos cantos. |
| **Branco (Recursos)** | Faixa horizontal na base do campo | Deck de recursos à esquerda + fileira horizontal de recursos. Ativos em pé (ciano), gastos virados a 90°, EX em dourado. |
| **Roxo (Exílio)** | Lateral direita, topo | Pilha e contador numérico sobreposto. |
| **Bege (Lixo / Trash)** | Lateral direita, centro | Pilha de descarte exibindo a última carta com contador numérico. |
| **Marrom (Deck)** | Lateral direita, base | Pilha de compra. **Regra de Informação:** Mostra o número de cartas restantes **apenas para o dono**. O deck do oponente **NÃO** exibe o número de cartas (mantém segredo de jogo). |
| **Preto (Eliminação de Texto)** | Todo o campo | **Remover todos os rótulos de texto redundantes:** `6 SHIELDS`, `TRASH 0`, `EXÍLIO 0`, `DECK 38`, `RECURSO 8`, `1 ativos • nível 2`. A visualização limpa com tooltips substitui o texto. |

#### O Espelhamento Obrigatório do Oponente:
Conforme especificado pelo usuário:
> *"A visão do lado do oponente deve ser o espelho oposto do lado do jogador. Se o shield area na visão da aba aberta está à esquerda, a shield area do oponente está no lado direito."*

```
[LADO DO OPONENTE - ESPELHADO]
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [DECK / LIXO / EXÍLIO]        [BATTLE AREA DO OPONENTE]          [BASE / SHIELDS]│
│  (Esquerda do oponente)       [Slot 1] [Slot 2] ... [Slot 6]     (Direita do opp)│
│                               [Recursos do Oponente]                             │
├═══════════════════════════════════ THE SEAM ═════════════════════════════════════┤
│ [BASE / SHIELDS]              [SUA BATTLE AREA]                  [DECK / LIXO]   │
│  (Sua Esquerda)               [Slot 1] [Slot 2] ... [Slot 6]     (Sua Direita)   │
│                               [Seus Recursos Horizontais]                        │
│                               [SUA MÃO ANCORADA]                                 │
└──────────────────────────────────────────────────────────────────────────────────┘
[SEU LADO - PRIMEIRO PLANO]
```

### 1.4 Imagem 5 — Simplificação de Modais e Ações Rápidas
- Clicar numa carta para ver detalhes atualmente abre um modal pequeno cheio de texto burocrático (`Nível 2, Custo 1, AP 2, HP 2, TRAITS: Earth Federation`, etc.).
- **Regra de Ação Rápida:**
  - Cartas em campo têm botão direto de ação rápida: `Atacar` (se ativa), `Blocker` (se puder bloquear).
  - Cartas na mão jogáveis têm botão direto: `Jogar` / `Baixar`.
- **Regra de Abertura de Modal:**
  - O modal de escolha só deve abrir se a carta for **modal/dual** (ex: carta Comando que pode ser jogada como Comando ou acoplada como Piloto: `[Usar Comando]` vs `[Equipar como Piloto]`), ou se houver escolha de alvos.
  - Para inspeção pura da arte, o `CardInspectorPanel` lateral já cumpre o papel sem cobrir a mesa.

### 1.5 Filtro de Preto e Branco na Mão
- **Carta sem recursos ou nível suficiente:** Filtro preto e branco (`filter: grayscale(100%) brightness(0.65)`).
- **Carta jogável no momento:** Colorida com brilho ciano suave (`box-shadow: 0 0 10px rgba(6,182,212,0.45)`).

---

## 2. Camada 3D e Profundidade Tática (Master Duel)

Para criar a sensação de imersão de mesa de card game real:
1. O container do `ArenaPlaymat` recebe perspectiva CSS:
   ```css
   perspective: 1200px;
   perspective-origin: 50% 65%;
   ```
2. A mesa recebe uma inclinação tática controlada:
   ```css
   transform: rotateX(8deg);
   transform-style: preserve-3d;
   ```
3. O lado do jogador fica no primeiro plano (`scale(1.0)` com contraste vívido), enquanto o lado do oponente fica levemente recuado em perspectiva e escala (`scale(0.95)` e `opacity-90`), gerando a profundidade de arena sem distorcer o `getBoundingClientRect` da linha de mira do `CombatLane`.

---

## 3. Plano de Ação para o Claude Code (Sprint 5: Refinamento Arena 3D)

O Claude Code deve executar as correções nos seguintes arquivos de `src/modules/simulator/ui/`:

### Arquivo 1: `src/modules/simulator/ui/ArenaPlaymat.tsx`
- Adicionar a perspectiva 3D (`perspective-[1200px]`, `rotate-x-[8deg]`).
- Implementar o espelhamento do oponente no `StateZone`:
  - Se `orientation === "opponent"`: Renderiza `[Deck/Trash/Exílio]` na esquerda, `[Recursos]` no centro, e `[Base/Shields]` na direita.
  - Se `orientation === "self"`: Renderiza `[Base/Shields]` na esquerda, `[Recursos]` no centro, e `[Deck/Trash/Exílio]` na direita.
- Ajustar a escala base `--card` para `clamp(3.25rem, 6.2vw, 6rem)`.

### Arquivo 2: `src/modules/simulator/ui/BattleSlot.tsx`
- **Mudar botões de ação para Overlay:**
  - Remover a div inferior de botões que adicionava 44px de altura.
  - Os botões `Atacar`, `Mirar aqui` e `Blocker` tornam-se botões compactos em overlay absoluto (`absolute bottom-1.5 inset-x-1 z-20 shadow-lg`), sem alterar as dimensões externas do slot.
- Manter o slot rigorosamente em `aspect-[63/88]`.
- Badges de AP e HP sobrepostos nos cantos inferiores da carta.

### Arquivo 3: `src/modules/simulator/ui/DockedPilot.tsx`
- Ajustar o posicionamento do piloto acoplado para ficar sobreposto por baixo da Unit, revelando apenas o terço superior (rosto do piloto e bônus de combate `+AP/+HP`), idêntico à referência do Mobile Suit Arena (Imagem 4).

### Arquivo 4: `src/modules/simulator/ui/ShieldRail.tsx` & `BaseCardGauge.tsx`
- **ShieldRail:** Remover rótulo `"Shields"` e `"N SHIELDS"`. Exibir os 6 escudos em cascata vertical sobreposta de cima para baixo.
- **BaseCardGauge:** Remover rótulos textuais como `"BASE EX"`, `"3/3 EX BASE"`. Mostrar a carta da base com a barra de HP e número de dano sobrepostos.

### Arquivo 5: `src/modules/simulator/ui/CounterChip.tsx` & `PileTray.tsx`
- Remover textos estáticos longos.
- No Deck do oponente: Não exibir a contagem de cartas (apenas o verso da carta de compra).
- No Deck do jogador: Exibir o contador numérico em badge discreto sobre o deck.
- Adicionar tooltips com ícones intuitivos em todas as pilhas e botões.

### Arquivo 6: `src/modules/simulator/ui/ResourceMeter.tsx`
- Remover o texto `"◆ X ativos • nível Y"` e `"RECURSO Z"`.
- Exibir a linha limpa de recursos horizontais (ativos em pé ciano, descansados deitados, EX dourado).

### Arquivo 7: `src/modules/simulator/ui/HandFan.tsx`
- Aplicar o filtro preto e branco (`grayscale(100%) brightness(0.65)`) nas cartas não-jogáveis.
- Aplicar o brilho de prontidão ciano (`shadow-[0_0_12px_rgba(6,182,212,0.5)] border-primary`) nas cartas jogáveis.
- Ao clicar em carta de modo único: disparar diretamente a intenção de jogar.
- Abrir modal de seleção apenas se a carta tiver múltiplos modos (ex: Piloto vs Comando).

---

## 4. Prompt para o Claude Code Executar o Refinamento

Copie e cole o bloco abaixo no terminal do Claude Code:

````markdown
INVARIANTES DE EXECUÇÃO:
- Branch: feature/simulador-pivot-visual-arena.
- NÃO alterar: src/modules/simulator/engine/*, src/modules/simulator/server/*, viewState.ts.
- Tokens do portal em src/index.css (--primary ciano, --accent dourado, rounded-none).
- Validação contínua: pnpm test && pnpm run check:types && pnpm run lint:simulator.

OBJETIVO DO SPRINT 5 (REFINAMENTO ARENA 3D & ERGONOMIA):
Aplicar as correções visuais detalhadas no PLANO_REFINAMENTO_ARENA_3D.md com base no feedback real do usuário:

1. `src/modules/simulator/ui/BattleSlot.tsx`:
   - ELIMINAR a div inferior de botões que adicionava 44px de altura e fazia as Units colidirem na seam central.
   - Transformar os botões de ação ("Atacar", "Mirar aqui", "Blocker") em OVERLAY ABSOLUTO dentro da carta (absolute bottom-1 inset-x-1 z-20), preservando o aspect-[63/88] exato do slot.
   - Manter os números de AP e HP sobrepostos nos cantos inferiores da carta.

2. `src/modules/simulator/ui/DockedPilot.tsx`:
   - Posicionar a carta do piloto por baixo da Unit, mostrando apenas a faixa superior com o rosto do piloto e o bônus de combate (+AP/+HP), estilo Mobile Suit Arena.

3. `src/modules/simulator/ui/ArenaPlaymat.tsx`:
   - Adicionar perspectiva 3D na mesa (perspective: 1200px, transform: rotateX(8deg)), dando profundidade (lado do jogador em primeiro plano, lado do oponente sutilmente recuado).
   - ESPELHAR o lado do oponente no StateZone:
     * Oponente: [Deck/Trash/Exílio] na ESQUERDA | [Recursos] no CENTRO | [Base/Shields] na DIREITA.
     * Jogador: [Base/Shields] na ESQUERDA | [Recursos] no CENTRO | [Deck/Trash/Exílio] na DIREITA.
   - Ajustar escala base --card para clamp(3.25rem, 6.2vw, 6rem).

4. `src/modules/simulator/ui/ShieldRail.tsx` e `BaseCardGauge.tsx`:
   - Remover rótulos textuais redundantes ("6 SHIELDS", "BASE EX", "TOKEN-EX BASE").
   - ShieldRail vertical: exibir os escudos em cascata sobreposta de cima para baixo.
   - BaseCardGauge: exibir carta com barra de HP e dano sobreposto.

5. Pilhas (Deck, Trash, Exílio):
   - Remover textos como "TRASH 0", "EXÍLIO 0", "DECK 38". Exibir o número sobreposto no topo da pilha.
   - Deck do oponente: OCULTAR o número de cartas restantes (mostrar apenas o verso).
   - Deck do jogador: Exibir o número restante.

6. `src/modules/simulator/ui/ResourceMeter.tsx`:
   - Remover o texto "◆ X ativos • nível Y" e "RECURSO Z". Manter a fileira horizontal de mini-cartas limpa com tooltips.

7. `src/modules/simulator/ui/HandFan.tsx` e `SimulatorMatchPage.tsx`:
   - Cartas não-jogáveis: filtro grayscale(100%) brightness(0.65).
   - Cartas jogáveis: cores normais + glow ciano.
   - Ao clicar em carta da mão: se for modo único, disparar ação direta sem abrir modal burocrático. Modal de decisão só abre se for carta dual (Piloto vs Comando) ou exigir seleção de alvo.

Ao finalizar: execute `pnpm test`, `pnpm run check:types` e `pnpm run lint:simulator`.
````

---

## 5. Estratégia de Merge para a Branch `dev`

1. **Situação Atual do Git:**
   - A branch `dev` está estável na versão anterior.
   - A branch `feature/simulador-pivot-visual-arena` possui os Sprints 1–4 commitados (`bad1a4d`).
2. **Recomendação:**
   - Aplicar as correções deste Sprint 5 diretamente na branch `feature/simulador-pivot-visual-arena`.
   - Você roda `pnpm run dev` e valida no navegador que a sobreposição sumiu, o espelhamento está correto e os textos limpos.
   - Assim que você aprovar visualmente, executamos o merge de `feature/simulador-pivot-visual-arena` diretamente em `dev`.
