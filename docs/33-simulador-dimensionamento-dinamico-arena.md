# 33 — Rodada 4: dimensionamento dinâmico de verdade (medir, não adivinhar)

**Branch:** `dev` + `main` (a pedido do Willen). 2026-09-04. Continuação de
[docs/30](30-simulador-vv-sprint-v5-ajuste-visual-arena.md)–[docs/32](32-simulador-ajuste-visual-arena-rodada-3.md),
a partir de 3 prints novos (CapturaWide, CapturaWide2, CapturaMobile).

## Diagnóstico — por que a rodada 3 "não mudou nada" no mobile

`ShieldRail` usava `max-sm:` (< 640px) pro achatamento; `ActionDock` usava
`sm:`/`md:` (≥640px/≥768px) pro encolhimento da caixa. **Dois limiares
diferentes no MESMO dispositivo**: celular em paisagem cai tipicamente entre
640-900px — acima de 640px (o achatamento do Shield nunca ativava) e
possivelmente já acima de 768px (o dock já tinha voltado pro tamanho grande).
As duas correções da rodada 3 nunca chegaram a rodar de verdade nesse
aparelho.

## Decisão de arquitetura — medir, não adivinhar

4 rodadas seguidas (docs/30-32) vinham do mesmo molde: uma fórmula
`clamp(piso, min(Xvw, Yvh), teto)` pra `--card-w`, mais breakpoints Tailwind
pra decisões estruturais. O Willen pediu uma "varredura analítica": trocar
constante chutada por leitura real da tela, sem restringir a tamanhos
padronizados.

Duas opções pesquisadas:
1. **CSS Container Queries** (`cqw`/`cqh`) — só CSS, mas a caixa do canvas
   mistura 2 eixos com fatores diferentes (por causa do rodapé da mão) —
   expressar isso num `calc()` só continuaria sendo "estimativa de
   constante", só que em `cqw` em vez de `vw`. Não resolve o problema de
   fundo.
2. **Medir de verdade (`ResizeObserver`) + escala** — deixar o NAVEGADOR
   renderizar o conteúdo, medir o tamanho real (`getBoundingClientRect`), e
   calcular o fator de escala pra caber na caixa disponível. Como tudo na
   arena já é `calc(var(--card-w) * constante)` (proporcional), a relação é
   linear — o fator medido numa escala serve pra qualquer escala.

Escolhida a opção 2.

## `useArenaScale` (novo hook, `src/modules/simulator/ui/useArenaScale.ts`)

- `containerRef` (a caixa disponível) + `groupRef` (o grupo
  [DeckStation, Theater, ShieldStation] de UM lado — já naturalmente sem
  stretch: a linha usa `items-start`/`items-end`, não `items-stretch`,
  então os filhos já renderizam no tamanho que pedem de verdade). Só
  precisa medir 1 dos 2 lados (mesmo tamanho — o oponente só tem o
  `scale(.96)` cosmético por cima).
- `ResizeObserver` no `containerRef`: mede `groupRef` na escala ATUAL,
  calcula `scale = min(containerWidth/groupWidth, containerHeight/groupHeight)`
  usando a ÚLTIMA escala aplicada como referência (nunca uma constante
  chutada de antemão — auto-corrige a cada resize real), aplica
  `--card-w` via `style.setProperty` direto (sem re-render do React).
- O rodapé da mão entra pela constante EXATA já escrita no componente
  (`min-h-[calc(var(--card-w)*1.75)]`) — não por medição, porque já é um
  valor conhecido de verdade, não uma estimativa.
- Piso/teto de sanidade (44px/320px) só como rede de segurança, não mais
  "a fórmula".
- Guard pra `ResizeObserver` ausente (jsdom em teste) — aplica só o piso
  inicial, sem quebrar.

## Pré-requisito de layout — a caixa não podia ser circular

`SimulatorMatchPage.tsx`: o wrapper do `ArenaPlaymat` era `shrink-0` — ele
NUNCA soube quanto sobrava de largura depois das asas (`CardInspectorPanel`
+ espelho, cada uma até `max-w-[22rem]`), sempre ficou do tamanho que o
canvas 16:9 "queria" sozinho (derivado só da altura). Isso é exatamente por
que `CapturaWide2` (modo expandido) ainda sobrava espaço lateral mesmo com
as asas escondidas. Trocado pra `flex-1` — agora disputa a linha de verdade
com as asas (o excesso além do `max-w-[22rem]` delas já redistribui pra cá
sozinho, é o próprio algoritmo do flexbox), e o canvas (`max-w-full`)
enxerga a largura REAL sobrando.

## `ArenaPlaymat.tsx`

- `--card-w` deixou de ter QUALQUER fórmula fixa — nem `vw`/`vh`, nem "modo
  expandido" separado. `expanded` agora só troca `aspect-[16/9] max-w-full`
  por `h-full w-full` (solta a trava de proporção — sem isso a largura
  sobrando ficava inalcançável mesmo com as asas escondidas); o MESMO
  `useArenaScale` calcula o `--card-w` certo pra qualquer caixa resultante.
- Shield achatado (`compact`) também deixou de ser breakpoint — o
  `ArenaPlaymat` decide a partir do `--card-w` que ele mesmo mediu (≤4rem =
  cramped, achata). Como `side.shields` já vem pronto (montado por
  `SimulatorMatchPage.tsx`, antes do `ArenaPlaymat` existir), a prop é
  injetada via `cloneElement`.

## `ShieldRail.tsx`

`compact?: boolean` substitui o `max-sm:`/`max-lg:` de breakpoint —
`*0.87` (achatado) vs `*0.62` (cascata normal), 2 strings Tailwind
ESTÁTICAS completas (interpolar só o número dentro do valor arbitrário
quebraria o scanner do Tailwind — achado ao implementar, corrigido antes
de commitar).

## `CardInspectorPanel.tsx` — imagem centralizada X/Y

`PanelBody` ganhou `justify-center` — a asa já estica full-height desde a
rodada 3, mas faltava isso pra centralizar o GRUPO [imagem + infos] dentro
dela (antes ficava colado no topo, print "CapturaWide").

## Mão do oponente — proporcional a `--card-w`

`opponentHandBacks()` tinha tamanho fixo (`text-[8px]`/`w-7`) — nunca
escalava com o resto da arena (pior ainda no modo expandido, onde tudo
cresce menos isso). Rótulo maior (`text-[10px] font-bold`), versos
proporcionais (`w-[calc(var(--card-w)*0.42)]`).

## `ActionDock.tsx` — `clamp()` contínuo em vez de saltos de breakpoint

Largura/padding/fonte trocaram `sm:`/`md:`/`lg:` por `clamp()` de CSS pura
(`w-[clamp(13rem,38vw,23rem)]`, etc.) — sem o salto discreto, sem a classe
de bug que causou o "achado de raiz" desta rodada (não há mais 2 números
diferentes em 2 arquivos pra desalinhar). A troca de LAYOUT (barra
full-width mobile → caixa ancorada no canto) continua em `sm:` — isso É
uma mudança estrutural real, faz sentido ser um salto.

## Verificação

Novo `useArenaScale.test.ts` — cobre a matemática do hook com
`ResizeObserver`/`getBoundingClientRect` mockados (incluindo um mock que
escala PROPORCIONALMENTE ao `--card-w` aplicado, simulando CSS real —
achado ao escrever o teste: um mock de tamanho fixo quebra a suposição de
linearidade que o hook depende pra convergir num 2º resize). `ArenaPlaymat.
test.tsx`/`ShieldRail.test.tsx` atualizados pra nova forma. `pnpm test`
**442/442** (+7 novos). `check:types` ✓, `lint:simulator` ✓ (achado e
corrigido no caminho: `react-hooks/refs` reclamando de mutar ref durante o
render — movido pra dentro de `useEffect`), `eslint` na página ✓,
`pnpm build` ✓.

**Sobe em `dev` E `main`** — pedido explícito do Willen.
