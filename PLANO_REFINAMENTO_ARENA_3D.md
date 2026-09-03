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

---

## 4. Sprint 6 — Nova Rodada de Correções (Widescreen, Zonas, Mão, Modal e Bug Urgente de Alvo)

> **Origem:** 4 screenshots anotados enviados pelo Willen em 2026-09-03 (widescreen,
> notebook 14" com marcação branca/vermelha, modal da "Aries" e a mesma modal marcada
> pedindo o botão lateral) + 1 relato de bug com o toast de erro visível na 1ª imagem.
> **Branch:** `feature/simulador-pivot-visual-arena` (Sprints 5.1–5.3 já mergeados nela).
> **Ordem de execução:** o PROMPT 1 é bug de motor/dados (dado como jogada perdida —
> severidade alta); os PROMPTs 2–4 são CSS/layout/interação (severidade visual). Rode
> nessa ordem, um de cada vez, com a validação de cada um verde antes do próximo.

### 4.0 Comando de inicialização (colar ANTES do PROMPT 1)

````markdown
Você vai resolver a Sprint 6 do redesenho visual do Simulador — seção 4 de
PLANO_REFINAMENTO_ARENA_3D.md, na branch feature/simulador-pivot-visual-arena (Sprints
5.1–5.3 já mergeados nela; ver implementation_plan.md pro histórico de decisões).

Antes de tocar em qualquer arquivo:
1. `git branch --show-current` — confirme que está em feature/simulador-pivot-visual-arena.
2. `pnpm test && pnpm run check:types` — baseline tem que estar 100% verde ANTES de
   começar. Se não estiver, PARE e reporte, não misture correção de baseline com Sprint 6.
3. Leia a seção 4 inteira (diagnóstico de cada item a–g) antes de implementar qualquer
   PROMPT — o diagnóstico explica a causa raiz encontrada por leitura de código real
   (arquivo + linha), não é só a descrição visual do usuário.

Depois disso, execute os PROMPTs 1 → 2 → 3 → 4 abaixo em ordem. Rode a validação de
cada PROMPT (`pnpm test && pnpm run check:types` [+ `lint:simulator` onde indicado)
antes de seguir pro próximo. NÃO pule o PROMPT 1 pros últimos — é o único que mexe em
lógica de jogo (não é só estética) e outros jogadores podem estar perdendo jogadas por
causa dele agora.

INVARIANTES (valem pra todos os 4 PROMPTs abaixo):
- Branch: feature/simulador-pivot-visual-arena. NUNCA commitar/pushar em main.
- NÃO alterar semântica de: engine/effectSpec.ts (compilePrimitive/resolveTarget),
  engine/deploy.ts (payCostEvents/PAIR_CARDS), viewState.ts, server/matchStore.ts —
  o PROMPT 1 SÓ mexe em como o CLIENTE monta e valida `targets`/`pairWithUnitId`
  antes de mandar a `PlayerAction`; a forma do motor já suporta o caso (ver diagnóstico).
- Tokens: variáveis de src/index.css (--primary, --accent, panel-cut, hero-surface,
  rounded-none). Nunca cor Tailwind crua nem fonte genérica.
- Toda a saída ao usuário em português.
````

---

### 4.1 PROMPT 1 (urgente) — Bug de alvo não resolvido ao parear Piloto com efeito 【When Paired】 direcionado

#### Diagnóstico (causa raiz confirmada por leitura de código, não é suposição)

O toast de erro (`Alvo nomeado "target" não foi resolvido antes da execução do efeito`)
vem de `src/modules/simulator/engine/effectSpec.ts:78`, disparado quando um
`EffectSpec` usa `{ kind: "named", name: "target" }` e `ctx.targets.target` chega
vazio no `resolveTarget()`.

ST01-010 Amuro Ray tem DUAS habilidades, e o bug é especificamente sobre a 2ª:
- `AMURO_RAY_BURST` (`content/st01.ts:63-69`) — `self`, nunca precisa de alvo.
- `AMURO_RAY_WHEN_PAIRED` (`content/st01.ts:72-78`) — **"Choose 1 enemy Unit with 5
  or less HP. Rest it."** — precisa de `ctx.targets.target` = 1 Unit **inimiga**.
  (ST01-002 Gundam tem o mesmo formato em `GUNDAM_MA_FORM_WHEN_PAIRED`, então este
  bug afeta qualquer Pilot/Unit cujo 【When Paired】 exija alvo — não é exclusivo do
  Amuro.)

`deployCard()` (`engine/deploy.ts:102-128`) já despacha os dois lados corretamente
quando um Pilot é jogado pareando com uma Unit: `MOVE_CARD` + `PAIR_CARDS`, depois
`dispatchTrigger(..., "When Paired", specs, { targets: options.targets, ... })` pros
dois lados (Unit e Pilot). **O motor já sabe fazer isso — o problema é que
`options.targets` chega vazio do cliente.**

A causa é em `src/pages/SimulatorMatchPage.tsx`, função `confirmPending()` (linhas
519-554), ramo `pending.kind === "deploy"` (530-543):

```ts
if (card?.def.cardType === "PILOT" || !!card?.def.pilotMode) {
  pairWithUnitId = selected.find((id) => myBattleArea.some((u) => u.instanceId === id && u.def.cardType === "UNIT" && !u.pairedPilotId));
  ...
}
const targetIds = selected.filter((id) => id !== pairWithUnitId);
const targets = targetIds.length ? { target: targetIds, shield: targetIds } : undefined;
```

`selected` é o ÚNICO array de cliques que a tela mantém. Pra jogar Amuro Ray, o
jogador clica em 1 Unit (a própria, pra parear) — esse clique some inteiro dentro de
`pairWithUnitId` e `targetIds` fica vazio, porque é literalmente `selected` menos o
que virou `pairWithUnitId`. O motor então dispara `AMURO_RAY_WHEN_PAIRED` com
`ctx.targets.target === undefined` → `resolveTarget()` explode.

**Veredito: não é regressão nem corrupção de dado — é lacuna de implementação.** O
`PlayerAction["deployCard"]` e o motor já suportam `pairWithUnitId` + `targets.target`
como coisas SEPARADAS (ver `actions.ts:110-118`); a tela nunca foi ensinada a pedir
os DOIS cliques quando o Pilot que está sendo pareado (ou a Unit que recebe o pareio)
tem um 【When Paired】 que precisa de alvo. Hoje ela só sabe pedir 1 clique (o de
pareio) e nunca valida, antes de confirmar, se falta um 2º clique — o erro só aparece
depois, vindo cru do motor.

#### Prompt para Copiar/Colar no Claude Code:

````markdown
INVARIANTES: ver §4.0. NÃO alterar engine/effectSpec.ts, engine/deploy.ts,
engine/dispatcher.ts, engine/actions.ts — a forma deles já está correta (`targets` e
`pairWithUnitId` são campos independentes de `PlayerAction["deployCard"]`). Esta
correção é 100% client-side em src/pages/SimulatorMatchPage.tsx.
Validação: pnpm test && pnpm run check:types && pnpm run lint:simulator.

OBJETIVO — CORRIGIR O FLUXO DE PAREAMENTO DE PILOTO COM EFEITO DIRECIONADO:

1. Em `confirmPending()` (`SimulatorMatchPage.tsx`, ramo `pending.kind === "deploy"`),
   ANTES de montar `targets`, descubra se o Pilot que está sendo jogado (ou a Unit
   que vai recebê-lo) tem algum EffectSpec de trigger "When Paired" cujas `actions`
   usem `{ kind: "named", name: "target" }` (ver `content/st01.ts` /
   `content/st02.ts` — os specs já estão importados/usados em algum lugar da página
   ou de `dispatcher.ts`; reaproveite `findTriggerSpecs`). Se existir, este deploy
   PRECISA de 1 alvo adicional além do pareamento.

2. Quando esse alvo adicional for necessário:
   - Avise o jogador (banner/texto no lugar onde hoje mostra "Selecione a Unit
     própria pra parear") explicando que, depois de escolher a Unit pra parear, ele
     ainda precisa clicar em 1 Unit **inimiga** (ou o que a legalidade do efeito
     pedir — leia `sourceText`/o predicado do EffectSpec) pra resolver o "When
     Paired".
   - `toggleSelect`/a lógica de alvo legal deve continuar aceitando o 2º clique
     (numa Unit distinta da primeira) — hoje `targetIds = selected.filter(id => id
     !== pairWithUnitId)` já suporta isso SE o jogador clicar em 2 unidades
     diferentes; o que falta é o aviso + a validação abaixo.
   - Em `confirmPending()`, ANTES de chamar `runAction`, valide: se o deploy precisa
     de alvo adicional e `targetIds` está vazio, bloqueie com
     `toast.error(...)` explicando o que falta (mesmo padrão do erro já existente
     de "Selecione a Unit própria pra parear com este Pilot") — NÃO deixe a
     requisição ir pro motor pra falhar lá.

3. Cubra pelo menos ST01-002 (Gundam, "When Paired" na Unit) e ST01-010 (Amuro Ray,
   "When Paired" no Pilot) — os dois já têm EffectSpec real e teste de dispatcher
   (`deploy.test.ts:372-373`, `dispatcher.test.ts:96-98`) confirmando o formato
   esperado de `targets.target`.

4. Escreva (ou estenda) um teste de COMPONENTE pra `SimulatorMatchPage` (ou, se não
   houver harness de página ainda, um teste focado na função extraída de "montar a
   PlayerAction de deploy a partir da seleção") cobrindo: parear Amuro Ray com 1
   clique só (deve bloquear com toast, não chamar `runAction`) vs. parear + escolher
   alvo inimigo (deve chamar `runAction` com `targets: { target: [enemyId] }`).

Ao terminar: rode `pnpm test`, `pnpm run check:types`, `pnpm run lint:simulator`.
Gere um resumo confirmando que Amuro Ray e Gundam (ST01-002) pareiam sem erro num
teste manual/e2e local, e que o caso "Pilot sem 【When Paired】 direcionado" (a
maioria) continua pareando com 1 clique só, sem pedir alvo extra à toa.
````

---

### 4.2 PROMPT 2 — Playmat: escala em widescreen, alinhamento de zonas e recuo dos Recursos

#### Diagnóstico A — discrepância de escala em widescreen vs. notebook

`ArenaPlaymat.tsx` trava o canvas em `aspect-[16/9] max-h-full max-w-full mx-auto`
(linha 82-88), dentro do wrapper em `SimulatorMatchPage.tsx:901`
(`flex min-h-0 flex-1 items-stretch justify-center gap-2 overflow-hidden`), cuja
ALTURA disponível é `100vh` menos a barra de HUD (`SimulatorMatchPage.tsx:842-896`).
Num monitor 16:9 puro, a barra de HUD por si só já torna a altura disponível MENOR
que `largura/16*9` — então a altura vira o fator limitante e o canvas encolhe até
caber nela, sobrando margem morta nas laterais. Num notebook 14" (geometria de tela
diferente, ou zoom/DPI menor), essa sobra é proporcionalmente menor e passa
despercebida — bate com o relato ("no notebook está bem ajustado, no widescreen
sobra espaço"). Não é regressão do Sprint 5.1 (que resolveu o `justify-between`
vertical) — é uma tensão nova introduzida pelo "Virtual Canvas 16:9" do Sprint 1: um
aspect-ratio travado sempre deixa sobra quando a proporção da janela não é
exatamente 16:9.

Quando `isWide` (`SimulatorMatchPage.tsx:902-904`), a asa `CardInspectorPanel` já
ocupa `w-64` (256px) fixos — não cresce com o espaço sobrando, então em telas muito
largas o vazio nas laterais do canvas 16:9 fica sem função nenhuma.

#### Diagnóstico B — alinhamento de Base+Shields / Exílio+Trash+Deck

`ShieldStation`/`DeckStation` (`ArenaPlaymat.tsx:116-134`) são `flex-col items-center`
— cada peça (Base, cascata de Shields, Exílio, Trash, Deck) centraliza pela PRÓPRIA
largura. `ShieldRail` vertical (`ShieldRail.tsx:63`) desenha cada peça com
`w-[calc(var(--card,3.5rem)*0.46)]` — quase metade da largura de uma carta cheia — e
`BaseCardGauge`/os componentes de pilha (`PileTray`, `deck`) usam `var(--card)`
inteiro. Resultado: dentro da MESMA coluna, a Base/pilhas ficam com uma largura e os
Shields com outra, mais estreita — cada peça centraliza no seu próprio eixo, então a
coluna inteira não fica visualmente alinhada a uma borda comum (o `items-center`
some com qualquer referência de borda esquerda/direita). É essa falta de uma borda
comum que o círculo branco do Willen está marcando.

#### Diagnóstico C — recuo dos Recursos (reforço/regressão)

`OpponentTheater`/`SelfTheater` (`ArenaPlaymat.tsx:137-155`) JÁ colam os recursos
imediatamente acima/abaixo do `BattleRow` — isso é o que o Sprint 5.1 implementou.
Se o Willen ainda vê os recursos "longe" da Battle Area na build atual, o mais
provável é a MESMA causa do Diagnóstico A: como o canvas 16:9 encolhe em telas
largas, o espaço vertical sobrando dentro de cada metade (`flex-1` com
`justify-end`/`justify-start`) é pequeno, e qualquer `gap`/padding residual fica
proporcionalmente mais visível. Trate como item de REFORÇO (blindar com teste de
snapshot/CSS) mais do que reescrita — a estrutura já está certa, o que falta é
garantir que ela se comporte igual em qualquer proporção de canvas depois do fix
do Diagnóstico A.

#### Prompt para Copiar/Colar no Claude Code:

````markdown
INVARIANTES: ver §4.0. Branch feature/simulador-pivot-visual-arena. NÃO alterar
engine/*, server/*, viewState.ts. Tokens de src/index.css.
Validação: pnpm test && pnpm run check:types && pnpm run lint:simulator.

OBJETIVO — CORRIGIR ESCALA WIDESCREEN E ALINHAMENTO DE ZONAS NO ArenaPlaymat:

1. Escala em qualquer proporção de tela (`ArenaPlaymat.tsx`):
   - Troque o `aspect-[16/9] max-h-full max-w-full` fixo por um cálculo que priorize
     PREENCHER a altura disponível (`h-full`) e derive a largura a partir dela,
     mas com um TETO de proporção (não deixe o canvas virar um corredor
     ultra-largo em monitores 21:9+): use `aspect-ratio` dinâmico via CSS
     `clamp()`/container query, ou defina um intervalo aceitável (ex.: entre 16:10 e
     16:9) em vez de um valor fixo único. Documente no comentário do arquivo por que
     o valor foi escolhido.
   - Em `SimulatorMatchPage.tsx`, quando `isWide`, faça `CardInspectorPanel` (e o
     `BattleLogDrawer` do outro lado, se houver) crescerem pra ocupar o espaço
     lateral que sobra do canvas, em vez de ficar fixo em `w-64` — use `flex-1` com
     um `max-w` generoso, não uma largura fixa.
   - QA manual obrigatório neste item (não dá pra validar só por teste unitário):
     redimensione a janela em pelo menos 1366×768 (notebook), 1920×1080 (widescreen
     comum) e uma resolução ultra-wide (ex. 2560×1080) e confirme visualmente que
     não sobra vazio morto relevante nas laterais em nenhuma delas.

2. Alinhamento de coluna (`ShieldStation`/`DeckStation` em `ArenaPlaymat.tsx`):
   - Dê a cada coluna uma largura EXPLÍCITA e comum (`w-[var(--card,3.5rem)]` ou
     equivalente) em vez de deixar cada peça centralizar por conta própria — Base,
     cascata de Shields, Exílio, Trash e Deck devem compartilhar a MESMA borda
     (esquerda pro jogador, direita pro oponente — respeitando o espelhamento já
     implementado).
   - Ajuste `ShieldRail` (`orientation="vertical"`) pra que a largura de cada peça
     bata com a largura das pilhas de Deck/Trash/Exílio na mesma coluna (hoje
     `0.46 * --card` contra `1 * --card` das pilhas) — ou explicitamente centralize
     ambos dentro do MESMO container de largura fixa, o que for visualmente melhor.
   - Depois do fix, aproxime ainda mais as duas colunas (Base+Shields de um lado,
     Deck+Trash+Exílio do outro) da Battle Area central, reduzindo o `gap`/padding
     residual entre `ShieldStation`/`DeckStation` e `OpponentTheater`/`SelfTheater`.

3. Recursos colados na Battle Area (reforço, `ArenaPlaymat.test.tsx`):
   - Adicione (ou estenda) um teste que verifique que `resources` renderiza
     imediatamente adjacente ao `battleRow` (sem nó intermediário com padding
     grande) tanto no `OpponentTheater` quanto no `SelfTheater`, pra travar essa
     garantia contra regressão futura de CSS.

Ao terminar: rode `pnpm test`, `pnpm run check:types`, `pnpm run lint:simulator`, e
anexe (ou descreva) screenshots das 3 resoluções do item 1.
````

---

### 4.3 PROMPT 3 — Mão: posição, corte no rodapé e botões "Jogar" / "Ver"

#### Diagnóstico D — mão cortada no rodapé

`HandFan` no modo `anchored` (`HandFan.tsx:66-78`) é uma prateleira DELIBERADAMENTE
cortada: `-mb-[calc(var(--card,3.5rem)*0.62)]` puxa a base do leque pra baixo do
container, deixando só o topo (~38%) de cada carta visível em repouso, e revela o
resto só no hover/foco (`hover:-translate-y-6`). Isso é intencional (Sprint 3, "só o
topo aparece em repouso"), mas o container que hospeda a mão em `ArenaPlaymat.tsx:108`
(`<div className="shrink-0 border-t ... bg-slate-950/40">{hand}</div>`) está DENTRO
do canvas que tem `overflow-hidden` (`ArenaPlaymat.tsx:83`) — em telas onde o canvas
já está no limite de altura (ver Diagnóstico A), a faixa reservada pra mão fica
pequena e o "topo visível" garantido pelo design vira menos ainda do que os 38%
pretendidos, cortando a carta mais do que o desenho original previa. Em mobile/toque
não existe hover — a única forma de ver a carta inteira é focar via teclado (não é
uma interação natural em touch), o que faz o problema aparecer também sem
relação com a tela ser grande ou pequena.

#### Diagnóstico E — sem "Jogar" / "Ver" separados

Hoje o único gesto na carta da mão é `onClick={() => onPeek(card)}` (`HandFan.tsx:98`),
que em `SimulatorMatchPage.tsx:917-931` decide sozinho o que fazer: carta com 1 modo
joga direto, carta com 0 modos só avisa o motivo, carta com 2+ modos (Command/Pilot
dual) abre modal de escolha. **Não existe hoje nenhum caminho pra abrir a modal de
zoom só pra LER uma carta jogável de modo único** — clicar nela já dispara a jogada.
Isso é o gap que o Willen descreveu: "não tem opção de ver a carta numa modal, para
quando não for possível ler o conteúdo dela".

#### Prompt para Copiar/Colar no Claude Code:

````markdown
INVARIANTES: ver §4.0. Branch feature/simulador-pivot-visual-arena. NÃO alterar
engine/*, server/*, viewState.ts. Tokens de src/index.css.
Validação: pnpm test && pnpm run check:types && pnpm run lint:simulator.

OBJETIVO — CORRIGIR POSIÇÃO/CORTE DA MÃO E ADICIONAR "JOGAR"/"VER" POR CARTA:

1. `HandFan.tsx` (modo `anchored`):
   - Reduza o corte deliberado da carta em repouso (`-mb-[calc(var(--card)*0.62)]`)
     pra uma fração menor, o suficiente pra mostrar custo/nome/nível E pelo menos
     metade da arte sem precisar de hover — o objetivo do Willen é "sair do bottom
     um pouco", não eliminar o efeito de prateleira por completo.
   - Garanta que o container da mão em `ArenaPlaymat.tsx` (linha ~108) tenha uma
     ALTURA MÍNIMA reservada (`min-h-[...]` baseado em `--card`) que não encolha
     junto com o resto do canvas em telas apertadas — a mão não pode competir por
     espaço com a Battle Area a ponto de ficar menor que o necessário pra mostrar
     a fração de carta prometida pelo item acima.
   - Em touch (sem hover), garanta que EXISTE uma forma de revelar a carta inteira
     sem precisar de foco de teclado — o botão "Ver" do item 2 abaixo já resolve
     isso ao abrir a modal de zoom.

2. Botões "Jogar" / "Ver" por carta (`HandFan.tsx` + wiring em
   `SimulatorMatchPage.tsx:909-934`):
   - Adicione 2 controles por carta (podem ser overlays na própria carta, como os
     botões de combate do `BattleSlot.tsx`, ou aparecer só no estado
     hover/foco/elevado — decida pelo que ficar mais limpo visualmente, mas ambos
     têm que ter hit-area >= 44px):
     - **"Jogar"** — mantém o comportamento atual de `onPeek` (joga direto se 1
       modo, avisa se 0 modos, abre modal de escolha se 2+ modos).
     - **"Ver"** — SEMPRE abre a `CardInspectorModal` em modo somente-leitura (sem
       `footer` de ação, ou com o footer de ação normal se fizer sentido reusar),
       independente de a carta ser jogável agora ou não. Use o mesmo padrão já
       existente de preview (`setPreview(...)`, `SimulatorMatchPage.tsx:952-...`).
   - `HandFanCard`/`HandFanProps` ganham um novo callback (`onViewCard` ou similar)
     distinto de `onPeek` — não reescreva `onPeek` pra fazer as duas coisas.
   - Atualize `HandFan.test.tsx` cobrindo: clique em "Jogar" chama o callback de
     jogar; clique em "Ver" chama o callback de ver, mesmo numa carta bloqueada.

Ao terminar: rode `pnpm test`, `pnpm run check:types`, `pnpm run lint:simulator`.
````

---

### 4.4 PROMPT 4 — Modal: botão da gaveta lateral invisível (clipping)

#### Diagnóstico F — o botão já existe no código, mas é cortado pelo `overflow-hidden` do pai

`CardInspectorModal.tsx` (Sprint 5.3) JÁ implementa o botão que abre a gaveta lateral
de telemetria (`drawerOpen`, ícone `Info`/`ChevronRight`, linhas 98-106) — mas ele é
filho do mesmo `<div>` que tem `overflow-hidden` (linha 63:
`"panel-cut relative h-[78vh] max-h-[80vh] shrink-0 overflow-hidden border ..."`),
usado ali pra recortar a arte da carta no `aspect-[63/88]`. O botão é posicionado com
`absolute right-0 ... translate-x-full` (linha 103) — ou seja, DELIBERADAMENTE
projetado pra ficar FORA da borda direita do card, mas o `overflow-hidden` do
ancestral recorta exatamente essa área. Na prática, o botão renderiza mas fica
invisível (0 pixels visíveis) — bate 100% com o relato ("a modal abre bem, mas não
há o botão iterativo no lado direito"). Não é feature faltando, é CSS quebrado por
um `overflow-hidden` que existe por outro motivo (recortar a imagem).

#### Prompt para Copiar/Colar no Claude Code:

````markdown
INVARIANTES: ver §4.0. Branch feature/simulador-pivot-visual-arena. NÃO alterar
engine/*, server/*, viewState.ts. Tokens de src/index.css.
Validação: pnpm test && pnpm run check:types && pnpm run lint:simulator.

OBJETIVO — DESTRAVAR O BOTÃO DA GAVETA LATERAL NO CardInspectorModal:

1. Em `CardInspectorModal.tsx`, o botão de abrir/fechar a gaveta (linhas ~98-106)
   está sendo cortado pelo `overflow-hidden` do container da arte (linha 63). NÃO
   remova o `overflow-hidden` do container da arte (ele existe pra recortar a
   imagem no aspect-ratio certo) — em vez disso, MOVA o botão pra fora desse
   container: coloque-o como filho direto do wrapper `<div className="relative flex
   items-stretch" ...>` (linha 61), posicionado com `absolute` relativo a ESSE
   wrapper (que não tem `overflow-hidden`), mantendo a posição visual atual
   (borda direita da carta, meio da altura).
   - Cuidado com o z-index/stacking: confirme que o botão continua clicável por
     cima da gaveta quando ela abre (a gaveta é irmã dele, `ml-6` depois do card).
2. Depois do fix, confirme visualmente (screenshot ou descrição) que o botão
   aparece e alterna a gaveta corretamente com a modal aberta em pelo menos 1
   carta com `link.kind === "pilotName"` (pra também validar o hover do piloto
   nesse mesmo fluxo, já que os dois dependem do mesmo container).
3. Atualize `CardInspectorModal.test.tsx` com um teste que garanta que o botão da
   gaveta está presente no DOM e FORA de qualquer ancestral com `overflow-hidden`
   entre ele e o wrapper raiz da modal (ou, no mínimo, que `drawerOpen` alterna
   corretamente ao clicar nele — já cobre a lógica; o teste de DOM/CSS de overflow
   pode ficar como comentário/nota se a suíte de testes não tiver esse tipo de
   asserção hoje).

Ao terminar: rode `pnpm test`, `pnpm run check:types`, `pnpm run lint:simulator`.
````

---

### 4.5 Validação e Merge Seguro para `dev` (Sprint 6)

Mesmo procedimento do §3, repetido aqui porque a Sprint 6 é maior (4 PROMPTs, 1 deles
bug de motor/dados):

1. Depois de cada PROMPT, rode `pnpm test && pnpm run check:types` (+
   `pnpm run lint:simulator` nos que pedem) ANTES de seguir pro próximo.
2. Suba `pnpm dev:full`, abra 2 contas em `http://localhost:5173/simulador`, pareie
   uma partida e confirme MANUALMENTE:
   - [ ] Amuro Ray (ou Gundam ST01-002) pareia sem erro, pedindo o alvo inimigo
         quando necessário; pareamentos sem alvo direcionado continuam com 1 clique.
   - [ ] Em pelo menos 3 resoluções (notebook, widescreen 1080p, ultra-wide), o
         board preenche a tela sem vazio morto relevante nas laterais.
   - [ ] Base+Shields e Exílio+Trash+Deck alinham numa borda comum, dos dois lados
         (espelhamento do oponente preservado).
   - [ ] Recursos continuam colados à Battle Area em qualquer uma das 3 resoluções.
   - [ ] A mão não corta a parte de baixo da carta em repouso; em touch dá pra ver
         a carta inteira sem hover (via "Ver").
   - [ ] Cada carta da mão tem "Jogar" e "Ver" funcionando separadamente.
   - [ ] A modal de zoom mostra o botão da gaveta lateral e ele abre/fecha normal.
3. Estando 100% aprovado, mesmo merge de sempre:
   ```bash
   git checkout dev
   git merge feature/simulador-pivot-visual-arena
   git push origin dev
   ```

### 4.6 Status

| Sprint | Estado | Notas |
|---|---|---|
| 5.1 — Playmat 3 colunas | ✅ mergeada | commit `28110fc` |
| 5.2 — Botões de combate em overlay | ✅ mergeada | commit `003cd69` |
| 5.3 — Inspetor com gaveta lateral e hover de piloto | ✅ mergeada | commit `e91f82b` — o botão da gaveta existe mas está cortado por `overflow-hidden` (ver Sprint 6, PROMPT 4) |
| **6 — Widescreen, zonas, mão, modal e bug de alvo** | ⬜ **próxima** | 4 PROMPTs: (1) bug urgente de alvo não resolvido no pareamento de Piloto, (2) escala widescreen + alinhamento de zonas + reforço do recuo de Recursos, (3) mão sem corte + botões Jogar/Ver, (4) botão da gaveta lateral do modal |
