# Plano de Implementação: Refinamento Arena 3D, Ergonomia e Espelhamento

Baseado na análise forense das 10 imagens enviadas pelo usuário, este plano estabelece os refinamentos críticos para corrigir a dispersão de elementos em monitores widescreen, eliminar colisões verticais na Battle Area e modernizar o inspetor de cartas com suporte a telemetria lateral e hover de pilotos linkados.

---

## User Review Required

> [!IMPORTANT]
> **Decisão Chave 1: Reagrupamento Espacial (Fim do `justify-between`)**
> Os recursos deixam de ficar nas extremidades do canvas e passam a ficar **colados diretamente às suas respectivas Battle Areas** (recursos do oponente logo acima dos slots inimigos; seus recursos logo abaixo dos seus slots), eliminando o abismo central vazio (destacado na Imagem 2).

> [!IMPORTANT]
> **Decisão Chave 2: Espelhamento Completo do Oponente**
> Conforme a Imagem 8: No lado do jogador, Base/Shields ficam na **esquerda** e Deck/Trash na **direita**. No lado do oponente, a disposição é espelhada: Base/Shields na **direita** e Deck/Trash na **esquerda**, simulando a perspectiva real de dois jogadores frente a frente.

> [!IMPORTANT]
> **Decisão Chave 3: Botões de Ação em Overlay**
> Os botões `Atacar`, `Mirar aqui` e `Blocker` no `BattleSlot.tsx` deixam de ser uma div abaixo da carta (que aumentava a altura em 44px e causava a colisão da Imagem 1) e viram **overlays flutuantes no rodapé da própria carta**, mantendo a altura externa travada em `aspect-[63/88]`.

---

## Proposed Changes

### Camada de Apresentação e Tabuleiro (`src/modules/simulator/ui/`)

---

#### [MODIFY] [ArenaPlaymat.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/ArenaPlaymat.tsx)
- Reorganizar a estrutura em 3 colunas principais:
  - **Coluna Esquerda:** Base no topo + Cascata vertical de 6 Shields sobrepostos.
  - **Coluna Central (Teatro de Batalha):**
    - Linha de Recursos do oponente (horizontal, colada no topo dos slots dele).
    - Battle Area do oponente (6 slots).
    - Linha Central (The Seam).
    - Battle Area do jogador (6 slots).
    - Linha de Recursos do jogador (horizontal, colada na base dos slots dele).
  - **Coluna Direita:** Coluna tática vertical com Exílio, Lixo (Trash) e Deck.
- Implementar o espelhamento do oponente (Base/Shields na direita do oponente, Deck na esquerda).
- Elevar a escala base `--card` para `clamp(3.5rem, 6.5vw, 6.2rem)` para preencher o espaço do monitor com impacto visual.

#### [MODIFY] [BattleSlot.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/BattleSlot.tsx)
- Transformar botões de combate em overlay absoluto (`absolute bottom-1 inset-x-1 z-20`) sem alterar a altura do slot.
- Exibir AP e HP nos cantos inferiores da carta sem rótulos textuais redundantes.

#### [MODIFY] [DockedPilot.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/DockedPilot.tsx)
- Posicionar a carta do piloto acoplada por baixo da Unit, mostrando apenas a faixa do rosto e bônus de combate `+AP/+HP` (estilo Mobile Suit Arena).

#### [MODIFY] [ShieldRail.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/ShieldRail.tsx) & [BaseCardGauge.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/BaseCardGauge.tsx)
- Eliminar textos redundantes (`"6 SHIELDS"`, `"BASE EX"`, etc.).
- Cascata vertical sobreposta de 6 escudos de cima para baixo.

#### [MODIFY] [CardInspectorModal.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/CardInspectorModal.tsx)
- Renderizar a arte da carta em tamanho grande no centro da tela (70-80% do viewport).
- Botão flutuante na lateral da carta que abre uma gaveta deslizante (*slide-out*) com telemetria, traits e regras.
- Link de Piloto interativo: passar o mouse sobre o nome do piloto (ex: `Suletta Mercury`) abre um popover flutuante exibindo a carta do piloto correspondente e sinaliza se está disponível no deck do jogador.

#### [MODIFY] [HandFan.tsx](file:///c:/WillenWorks/portal-gundam-tcg-br/src/modules/simulator/ui/HandFan.tsx)
- Cartas injogáveis: filtro preto e branco (`grayscale(100%) brightness(0.65)`).
- Cartas jogáveis: cores vivas + glow ciano.
- Clique em cartas de ação direta inicia o deploy/pagamento sem abrir modal intermediário burocrático.

---

## Verification Plan

### Automated Tests
```bash
# Execução da suíte completa de testes (317+ testes devem passar)
pnpm test

# Validação estrita de tipos TypeScript
pnpm run check:types

# Checagem de linter no simulador
pnpm run lint:simulator
```

### Manual Verification
1. **Widescreen e Notebook 14"**: Verificar que o vazio central desapareceu e as cartas preenchem o campo de forma proporcional.
2. **Colisão de Unidades**: Confirmar que o botão "Atacar" não empurra a unidade para a linha central.
3. **Espelhamento do Oponente**: Checar que os Shields e Base do oponente estão no lado direito do campo dele, e o Deck na esquerda.
4. **Deck do Oponente Oculto**: Confirmar que o deck do oponente não exibe contagem numérica de cartas.
5. **Modal com Gaveta Lateral & Pilot Link**: Abrir uma unidade com link (ex: Aerial), alternar a gaveta lateral e passar o mouse sobre o nome do piloto para ver a carta flutuante da Suletta.
