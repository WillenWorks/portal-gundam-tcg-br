# Plano Mestre de Reestruturação Visual: Arena 3D, Topologia de Zonas e Inspeção de Cartas

> **Documento de Arquitetura Visual e Guia de Execução para Claude Code**  
> **Base de Análise:** Análise forense das 10 imagens reais de teste (Widescreen, 14" Notebook, DevTools, Esboço Mestre de Zonas e Modal de Piloto).  
> **Branch de Trabalho:** `feature/simulador-pivot-visual-arena`  
> **Invariante Absoluta:** Motor de regras (`engine/*`), serialização (`viewState.ts`) e servidor (`matchStore.ts`) permanecem 100% intocados. Todos os testes unitários (`pnpm test` — 317 testes) devem permanecer verdes.

---

## 1. Diagnóstico Forense das 10 Imagens Enviadas

### 1.1 O Problema do Vazio Widescreen & `justify-between` (Imagens 1, 2, 3, 4, 5 e 6)
- **Sintoma Observado:** Em monitores Widescreen e notebooks de 14", o `ArenaPlaymat` com `flex-col justify-between` empurrou os elementos para os cantos extremos do monitor, criando um **abismo vazio colossal no centro** (rabiscado em amarelo na Imagem 2).
- **Causa Raiz:** As StateZones (Base, Shields, Recursos e Deck) foram colocadas nas extremidades superior e inferior do canvas, isolando a Battle Area no centro. Além disso, a escala `--card` estava excessivamente tímida (`clamp(2.5rem, 5.2vw, 5.2rem)`), fazendo as cartas parecerem selos postais perdidos no deserto (Imagem 9).
- **Correção:** Eliminar o `justify-between`. Agrupar os recursos **diretamente colados** às suas respectivas Battle Areas e aumentar a escala das cartas para preencher a tela de forma imponente.

### 1.2 O Esboço Mestre de Zonas e Cores do Usuário (Imagem 7 e 8)
A Imagem 8 estabelece a topologia definitiva do Gundam TCG:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [LADO DO OPONENTE - ESPELHADO]                                                                         │
│ ┌──────────────────────┐  ┌─────────────────────────────────────────────────┐  ┌─────────────────────┐ │
│ │ DECK / LIXO / EXÍLIO │  │ [Branco] RECURSOS DO OPONENTE (Fileira Horizon.)│  │ BASE & SHIELDS      │ │
│ │ [Exílio] [Trash]     │  ├─────────────────────────────────────────────────┤  │ [Vermelho] Base     │ │
│ │ [Marrom] Deck (sem N)│  │ [Verde] BATTLE AREA DO OPONENTE (6 SLOTS)       │  │ [Laranja] 6 Shields │ │
│ │ (Pilha na esquerda)  │  │ [Slot 1]  [Slot 2]  [Slot 3]  [Slot 4] ...      │  │ Cascata descendente │ │
│ └──────────────────────┘  └─────────────────────────────────────────────────┘  └─────────────────────┘ │
├═══════════════════════════════════════════ THE SEAM ═══════════════════════════════════════════════════┤
│ [SEU LADO - PRIMEIRO PLANO]                                                                            │
│ ┌──────────────────────┐  ┌─────────────────────────────────────────────────┐  ┌─────────────────────┐ │
│ │ BASE & SHIELDS       │  │ [Verde] SUA BATTLE AREA (6 SLOTS GRANDES)       │  │ DECK / LIXO / EXÍLIO│ │
│ │ [Vermelho] Base      │  │ [Slot 1]  [Slot 2]  [Slot 3]  [Slot 4] ...      │  │ [Roxo] Exílio       │ │
│ │ [Laranja] 6 Shields  │  ├─────────────────────────────────────────────────┤  │ [Bege] Lixo (Trash) │ │
│ │ Cascata descendente  │  │ [Branco] SEUS RECURSOS (Fileira Horiz. + Deck)  │  │ [Marrom] Deck (N)   │ │
│ └──────────────────────┘  └─────────────────────────────────────────────────┘  └─────────────────────┘ │
│                           [SUA MÃO: LEQUE TÁTICO ANCORADO NA BASE]                                     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Regras Visuais Críticas por Zona:
1. **Base (Vermelho) & Shields (Laranja) - Coluna Esquerda do Jogador:**
   - **Base no Topo:** Exibe a carta da base com a barra de HP/dano sobreposta. **Zero textos redundantes** (sem `"BASE EX"`, `"TOKEN-EX BASE"`).
   - **Shields em Cascata Vertical:** 6 escudos dispostos verticalmente, sobrepondo-se suavemente de cima para baixo como cartas empilhadas. A leitura visual das 6 cartas dispensa o texto `"6 SHIELDS"`.
2. **Coluna Central (Verde & Branco) - O Teatro de Combate:**
   - **Battle Area (Verde):** Ocupa o centro com grande destaque visual. Cada slot com moldura de ancoragem nítida. Cartas exibindo AP no canto inferior esquerdo e HP no direito.
   - **Resource Runway (Branco):** Fica **imediatamente colada** à Battle Area!
     - Recursos do Oponente: Fileira horizontal logo acima dos 6 slots inimigos.
     - Seus Recursos: Fileira horizontal logo abaixo dos seus 6 slots de batalha.
     - Recursos ativos em pé (brilho ciano), descansados virados 90°, EX Resource com moldura dourada.
3. **Deck, Lixo e Exílio (Marrom, Bege, Roxo) - Coluna Direita do Jogador:**
   - Coluna tática vertical com os 3 montes de cartas.
   - **Regra de Informação do Deck:** O deck do jogador exibe o número de cartas restantes (ex: `35`). O deck do oponente **NÃO exibe número** (apenas o verso da carta).
4. **Espelhamento do Lado do Oponente:**
   - Para simular uma partida real de frente para o oponente:
     - No lado do oponente, **Base & Shields ficam na DIREITA**, enquanto **Deck, Lixo e Exílio ficam na ESQUERDA**.
5. **Remoção de Textos Redundantes (Marcados em Preto pelo Usuário):**
   - Eliminar os rótulos de texto: `"6 SHIELDS"`, `"TRASH 0"`, `"EXÍLIO 0"`, `"DECK 38"`, `"RECURSO 8"`, `"◆ 1 ativos • nível 2"`. A informação é transmitida pela representação física e números sobrepostos.

---

### 1.3 O Novo Inspetor de Cartas com Gaveta Lateral & Pilot Link (Imagem 10)

- **O Problema Atual:** O modal abre com uma imagem pequena cercada de textos e badges estáticos.
- **A Nova Arquitetura do `CardInspectorModal`:**
  1. **Arte em Destaque:** O centro do modal exibe a **carta em tamanho grande e glorioso** (ocupando 70-80% da altura da tela), permitindo admirar a arte e os detalhes originais da carta.
  2. **Botão Flutuante Lateral:** Na borda direita da carta, um botão tático com ícone (ex: `[Info / Telemetria]`) permite alternar a abertura de uma **caixa lateral deslizante (slide-out drawer)**.
  3. **Caixa Lateral de Telemetria:**
     - AP, HP, Nível, Custo, Traits e Efeito formatado.
     - **Link de Piloto Interativo (Hover Preview):**
       - Se a unidade tiver `link.kind === "pilotName"` (ex: *Gundam Aerial* com Link `Suletta Mercury`):
       - O nome do piloto vira um elemento interativo (`hover`/`focus`).
       - Ao passar o mouse sobre o nome do piloto, um popover/preview flutuante exibe a **carta do piloto** (ex: `ST01-011 Suletta Mercury`).
       - O componente verifica se o piloto existe no deck da partida. Se sim, sinaliza *"Piloto disponível no deck"*, auxiliando a tomada de decisão tática do jogador!

---

### 1.4 Ações Rápidas nas Cartas & Acoplamento do Piloto

1. **Botões de Ação sem Expansão de Slot (Solução da Imagem 1):**
   - No `BattleSlot.tsx`, os botões `Atacar`, `Mirar aqui` e `Blocker` não ficam mais em uma div abaixo da carta.
   - Ficam como **overlays flutuantes no rodapé da própria carta** (`absolute bottom-1 inset-x-1 z-20`), com botão semitransparente tático. O slot mantém a proporção fixa `aspect-[63/88]`, eliminando 100% das colisões na linha central.
2. **Piloto Acoplado (`DockedPilot.tsx`):**
   - O piloto fica fisicamente encaixado **por baixo da Unit**, projetando apenas a faixa superior com o rosto do piloto e o modificador `+AP/+HP`, idêntico à referência do Mobile Suit Arena (Imagem 4).
3. **Mão do Jogador (`HandFan.tsx`):**
   - Cartas sem recursos/nível: Filtro preto e branco (`grayscale(100%) brightness(0.65)`).
   - Cartas jogáveis: Coloridas com aura luminosa ciano (`shadow-[0_0_12px_rgba(6,182,212,0.5)]`).
   - Clique em carta de ação única: inicia o fluxo de jogar direto sem modal.

---

## 2. Roteiro de Prompts Operacionais para o Claude Code

Para aplicar essas correções cirurgicamente na branch `feature/simulador-pivot-visual-arena`, dividimos o trabalho em **3 Prompts Sequenciais**.

---

### PROMPT 1: Reestruturação do Playmat (Nova Topologia de Zonas e Espelhamento)

#### Explicação Técnica:
Reescreve o `ArenaPlaymat.tsx` para eliminar os vazios do `justify-between`, aproximar os recursos da Battle Area, criar a coluna de Shields em cascata vertical, a coluna de Deck/Trash/Exile e aplicar o espelhamento completo do oponente.

#### Copiar e Colar no Claude Code:

````markdown
INVARIANTES:
- Branch: feature/simulador-pivot-visual-arena
- NÃO alterar: engine/*, viewState.ts, server/matchStore.ts.
- Tokens: usar exclusivamente as variáveis de src/index.css (--primary, --accent, rounded-none).
- Validação: pnpm test && pnpm run check:types.

OBJETIVO DO SPRINT 5.1 — REESTRUTURAÇÃO DO PLAYMAT E ESPELHAMENTO:
Refatorar `src/modules/simulator/ui/ArenaPlaymat.tsx` conforme especificado no PLANO_REFINAMENTO_ARENA_3D.md:

1. Layout Geral e Escala:
   - Ajustar a escala base `--card` para `clamp(3.5rem, 6.5vw, 6.2rem)`.
   - Eliminar o `flex-col justify-between` que gerava o vazio central.
   - O canvas deve ter estrutura de 3 colunas principais:
     * Coluna Esquerda: Largura fixa (Base + Shields).
     * Coluna Central: Flex-1 (Teatro de Batalha com Battle Areas e Recursos colados).
     * Coluna Direita: Largura fixa (Deck, Trash, Exílio).

2. Coluna Central (Teatro de Batalha):
   - A linha horizontal de recursos do oponente deve ficar COLADA IMEDIATAMENTE ACIMA da Battle Area do oponente.
   - A Battle Area do oponente e a do jogador se encontram na linha central (The Seam).
   - A linha horizontal de recursos do jogador deve ficar COLADA IMEDIATAMENTE ABAIXO da Battle Area do jogador.
   - Isso agrupa unidades e recursos juntos, eliminando os grandes espaços vazios.

3. Coluna de Shields (ShieldStation):
   - No topo: Base com gauge de durabilidade/dano. Sem textos redundantes.
   - Abaixo da Base: 6 escudos em cascata vertical sobreposta de cima para baixo.
   - O número de escudos é transmitido pela própria pilha física (sem texto "6 SHIELDS").

4. Coluna de Deck (DeckStation):
   - Pilha vertical alinhada contendo: Exílio no topo, Lixo (Trash) no centro, e Deck na base.
   - O deck do jogador exibe o contador numérico restante.
   - O deck do oponente NÃO exibe número (mostra apenas o verso).

5. Espelhamento do Lado do Oponente:
   - No lado do oponente (topo da mesa):
     * A coluna de Base/Shields fica no lado DIREITO da tela.
     * A coluna de Deck/Trash/Exílio fica no lado ESQUERDO da tela.
   - No lado do jogador (base da mesa):
     * Base/Shields fica no lado ESQUERDO da tela.
     * Deck/Trash/Exílio fica no lado DIREITO da tela.

Ao terminar, atualize os testes em `ArenaPlaymat.test.tsx` e rode `pnpm test && pnpm run check:types`.
````

---

### PROMPT 2: Ações em Overlay nos Slots & Acoplamento de Piloto

#### Explicação Técnica:
Elimina o bug de sobreposição da Imagem 1 no `BattleSlot.tsx`, convertendo botões de ação em overlays internos da carta e alinhando o `DockedPilot.tsx` para aparecer por baixo da carta como no Mobile Suit Arena.

#### Copiar e Colar no Claude Code:

````markdown
INVARIANTES:
- Branch: feature/simulador-pivot-visual-arena
- NÃO alterar: engine/*, viewState.ts, server/matchStore.ts.
- Tokens: src/index.css (--primary, --accent, rounded-none).
- Validação: pnpm test && pnpm run check:types.

OBJETIVO DO SPRINT 5.2 — BOTÕES EM OVERLAY E DOCKED PILOT:
Corrigir a sobreposição das unidades e o acoplamento de pilotos:

1. Refatorar `src/modules/simulator/ui/BattleSlot.tsx`:
   - REMOVER a div inferior de botões que adicionava 44px de altura e empurrava as cartas para a seam central.
   - Os botões de ação (`Atacar`, `Mirar aqui`, `Blocker`) devem ser renderizados como OVERLAY ABSOLUTO sobre o rodapé da própria carta:
     `className="absolute bottom-1 inset-x-1 z-20 flex flex-col gap-0.5"`
     com botões translúcidos de alto contraste (`bg-primary text-black font-bold h-7 text-[10px] rounded-none hover:bg-primary/90`).
   - O slot externo DEVE manter rigorosamente a proporção `aspect-[63/88]`, nunca expandindo de tamanho quando há ações disponíveis.
   - Os números de AP e HP devem ficar sobrepostos nos cantos inferiores da carta (AP inferior esquerdo, HP inferior direito).

2. Refatorar `src/modules/simulator/ui/DockedPilot.tsx`:
   - Posicionar a carta do piloto acoplada por baixo da Unit, projetando apenas a faixa superior com o retrato do piloto e os bônus de combate (+AP/+HP e badge LINK).
   - Não adicionar overflow nem expandir a largura dos slots vizinhos.

Ao terminar, rode `pnpm test && pnpm run check:types`.
````

---

### PROMPT 3: Inspetor de Cartas com Arte Grande, Gaveta Lateral & Pilot Link

#### Explicação Técnica:
Substitui o modal burocrático atual pelo novo `CardInspectorModal.tsx` com arte em tamanho dominante, gaveta lateral retrátil de telemetria e o hover preview de pilotos linkados no deck.

#### Copiar e Colar no Claude Code:

````markdown
INVARIANTES:
- Branch: feature/simulador-pivot-visual-arena
- NÃO alterar: engine/*, viewState.ts, server/matchStore.ts.
- Tokens: src/index.css (--primary, --accent, rounded-none).
- Validação: pnpm test && pnpm run check:types.

OBJETIVO DO SPRINT 5.3 — INSPETOR DE CARTAS COM GAVETA LATERAL E HOVER DE PILOTO:
Modernizar o `src/modules/simulator/ui/CardInspectorModal.tsx`:

1. Apresentação Central da Carta:
   - Em vez de um modal pequeno com textos espremidos, o modal deve exibir a ARTE DA CARTA EM TAMANHO GRANDE (70% a 80% da altura da viewport).
   - O visual principal deve ser limpo e focado na ilustração da carta.

2. Botão Flutuante Lateral & Gaveta de Telemetria:
   - Na borda lateral direita da carta grande, incluir um botão tático com ícone (`<ChevronRight />` ou `<Info />`) para abrir/fechar a gaveta lateral de telemetria.
   - Ao abrir a gaveta lateral:
     * Exibe atributos formatados: Custo, Nível, AP, HP, Traits e Efeito em texto claro.
     * Exibe os modificadores ativos na instância.

3. Pilot Link Interativo (Hover Preview):
   - Se a carta inspecionada for uma Unit com `card.def.link` do tipo `pilotName`:
     * Exibir o nome do piloto linkado em destaque (ex: `Suletta Mercury`).
     * O nome do piloto deve ter comportamento de hover/focus interativo.
     * Ao passar o mouse sobre o nome do piloto, exibir um popover/tooltip flutuante com a imagem da carta do piloto correspondente (buscada via `art[pilotCode]` a partir das cartas disponíveis do set/partida).
     * Se o piloto estiver no deck do jogador, adicionar um badge sutil: "Disponível no seu deck".

4. Mão do Jogador (`HandFan.tsx`):
   - Garantir que cartas não-jogáveis fiquem com filtro `grayscale(100%) brightness(0.65)`.
   - Cartas jogáveis: cores vibrantes e brilho ciano nas bordas.
   - Clicar em carta de ação única dispara o fluxo de jogar direto sem modal intermediário. Modal só abre para cartas modais (Comando vs Piloto) ou inspeção explícita.

Ao terminar, rode `pnpm test`, `pnpm run check:types` e `pnpm run lint:simulator`.
````

---

## 3. Validação e Merge Seguro para `dev`

Depois que o Claude Code rodar os 3 prompts acima na branch `feature/simulador-pivot-visual-arena`:
1. Suba os servidores com `pnpm dev:full`.
2. Abra `http://localhost:5173/simulador` com 2 contas e teste:
   - [ ] As Units não colidem mais na linha central (botões em overlay).
   - [ ] O campo preenche o monitor Widescreen sem buracos vazios no meio.
   - [ ] Os recursos estão colados diretamente embaixo/em cima das Battle Areas.
   - [ ] O lado do oponente está espelhado (Shields/Base na direita, Deck na esquerda).
   - [ ] Clicar na carta abre a arte grande com a gaveta lateral de telemetria e o hover do piloto linkado.
3. Estando 100% aprovado, execute o merge direto da branch para `dev`:
   ```bash
   git checkout dev
   git merge feature/simulador-pivot-visual-arena
   git push origin dev
   ```
