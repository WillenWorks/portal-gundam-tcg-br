# Força e qualidade do bot — réguas e resultados

Spec: `bot-avaliacao-forca` (local em `.planning/specs/`). Duas réguas complementares:

| Régua | Comando | Mede | Meta |
|---|---|---|---|
| Escada de Elo | `pnpm gundam:bot:ladder` | força relativa entre níveis (round-robin, random = Elo 0) | cada degrau ≥ 60% sobre o anterior (Wilson > 50%); todo nível ≥ 95% sobre random |
| Banco de situações | `pnpm gundam:bot:puzzles` | qualidade de jogo: acerta a jogada certa em 22 situações conhecidas | ≥ 90% no nível mais alto |

Por que não "85–90% de vitória contra o bot atual": num TCG com compra, escudos e mulligan, isso
equivaleria a +300–380 Elo — inalcançável até pra jogador perfeito contra um mediano. A escada mede
a distância entre níveis; o banco mede se o bot joga certo (aqui 90% faz sentido).

## Como ler

- **Elo** (escala 400·log10, Bradley–Terry): +100 ≈ 64% de vitória, +200 ≈ 76%. O intervalo `[a, b]`
  é o IC de 95% por bootstrap — diferenças dentro do intervalo não são conclusivas.
- **Degrau**: taxa do nível de cima sobre o de baixo, com intervalo de Wilson. Só conta como "OK" se o
  limite inferior passar de 50%.
- **Acaso** (banco): taxa esperada escolhendo uma jogada legal ao acaso. Um nível só mede algo
  **acima** disso. O `random` do banco é 1 amostra com seed fixa e pode sair acima do acaso por sorte.
- **Quebrada** (banco): a situação não vale mais no motor atual (nenhuma jogada aceita é legal) —
  manutenção da situação, não erro do bot.

## Linha de base — 2026-09-24

Escada: `ladder-2026-09-24.json` — pool `all` (8 starters + 6 decks meta GD02/ST06), 30 partidas por
par de níveis, difícil com 8 rollouts (produto usa 16), 71 min, 0 excluídas, 0 sem vencedor.

| Nível | Elo | IC 95% |
|---|---|---|
| random | 0 | — |
| facil | 434 | [316, 578] |
| normal | 617 | [515, 775] |
| dificil | 806 | [688, 1015] |
| zero_system | 718 | [620, 901] |

| Degrau | Taxa | Wilson | Meta |
|---|---|---|---|
| facil sobre random | 93,3% | [78,7%, 98,2%] | OK (degrau) · abaixo dos 95% contra random |
| normal sobre facil | 73,3% | [55,6%, 85,8%] | OK |
| dificil sobre normal | 76,7% | [59,1%, 88,2%] | OK |
| zero_system sobre dificil | 33,3% | [19,2%, 51,2%] | **ABAIXO — o zero_system é mais fraco que o difícil** |

Rodada sem o difícil com 100 partidas por par (`ladder-2026-09-24-sem-dificil.json`): zero_system
sobre normal = 51% (Wilson [41%, 61%]) — **empate**; hoje o zero_system não é um degrau.

Banco: `puzzles-2026-09-24.json` — acaso 43,1%.

| Nível | Acerto |
|---|---|
| facil | 31,8% (7/22) |
| normal | 81,8% (18/22) |
| dificil | 81,8% (18/22) |
| zero_system | 81,8% (18/22) |

Erros que se repetem (alvos de correção):

- ~~**Letal** (normal e difícil): com o oponente sem escudo nem Base, ataca uma Unit rested em vez do
  jogador — a nota de "destruir e sobreviver" (35+) supera a de "atacar o jogador" (14+2·AP).~~
  Corrigido — ver abaixo.
- **Sequência no turno** (todos os níveis): "rest na Unit e depois atacá-la" e "remover o <Blocker> e
  dar o letal" — spec `bot-planejamento-turno`.
- ~~**zero_system**: não bloqueia pra salvar a Base e ataca com o <Blocker> que segura a Base.~~
  Corrigido — ver abaixo.

## Correção do letal — 2026-09-24

`engine/bot/lethal.ts` (`hasLethalLine`): conta os atacantes que o motor deixa atacar o jogador agora,
descarta os mais fortes pelos <Blocker> ativos do oponente, gasta atacantes na Base (dano acumula) e
um por escudo; sobrando um, é letal e todo ataque ao jogador vira a melhor jogada — na heurística
(normal, e por tabela a âncora do difícil) e em todas as personas do zero_system (a checagem antiga do
Heero, "AP pronto ≥ Base + escudos", dava letal falso com 1 atacante e 1 escudo).

Banco (`puzzles-2026-09-24-letal.json`): normal **90,9%** e difícil **90,9%** (eram 81,8%) — meta
batida; zero_system segue 81,8% (erros de bloqueio/guarda da Base, não de letal).

Escada sem o difícil, 100 partidas por par (`ladder-2026-09-24-letal-sem-dificil.json`), sem regressão:

| Degrau | Antes | Depois |
|---|---|---|
| facil sobre random | 97% | 97% |
| normal sobre facil | 73% | 76% |
| zero_system sobre normal | 51% | 52% (segue empate) |

## zero_system: regras de segurança em toda persona — 2026-09-24

Cada persona tinha sua própria regra de bloqueio/ataque e só o Amuro protegia a Base. Agora, no
despacho (vale pra todas): bloquear quando o ataque ao jogador perderia a partida (sem escudo e sem
Base) ou destruiria a Base; nunca atacar com o <Blocker> que segura a Base contra o contra-ataque.
Teste: `zeroSystemSafety.test.ts` roda as 5 personas nas situações do banco.

Banco (`puzzles-2026-09-24-zero.json`): zero_system **90,9%** (era 81,8%); só restam os 2 erros de
sequência no turno (spec `bot-planejamento-turno`).

Escada sem o difícil (`ladder-2026-09-24-zero-sem-dificil.json`): **idêntica** à anterior — zero_system
sobre normal segue 52%. Medição em 100 partidas zero × normal: o zero_system pôde bloquear só 123 vezes
(~1 por partida), nenhuma com derrota em jogo. As regras estão certas mas as situações são raras; não
são a causa do empate.

**Por que o zero_system não é um degrau:** as personas são a mesma heurística com pesos diferentes — o
mesmo conhecimento, sem busca. O que separa o difícil (+190 Elo) é o MCTS. Para o zero_system ser o topo
da escada ele precisa de busca (ex.: MCTS com as personas como âncora) ou do planejamento de turno;
reponderar não basta.

## Planejador de turno (`normal_plan`) — 2026-09-24

Spec `bot-planejamento-turno`. `engine/bot/turnPlanner.ts`: na Main Phase do bot, cada jogada legal
é aplicada na view determinizada e o resto do turno **+ o turno seguinte do oponente** é jogado pela
heurística pelos dois lados; a melhor posição (`evaluatePosition`) decide e a próxima decisão
replaneja. Nível experimental `normal_plan` (normal + planejador), fora do produto.

Horizonte: parando no fim do meu turno, quebrar um escudo sempre parecia melhor que destruir uma
Unit ou segurar o <Blocker> que protege a Base (o contra-ataque não aparece). Com o turno do
oponente, o planejador acerta essas situações.

Banco (`puzzles-2026-09-24-plan.json`): `normal_plan` **100% (22/22)** — incluindo as de sequência
(rest→ataque, remover <Blocker>→letal); normal e zero_system 90,9%.

`nao-atacar-base-com-blocker-segurando` mudou de premissa: 2/5 contra 6/6 era ambígua (o bloqueio
custava a Unit, ou 6 de dano que persiste, pra salvar a Base; pelos pesos, atacar saía melhor).
Agora 5/7 contra 4/4 — segurar protege a Base e ameaça destruir o atacante; resposta inequívoca.

`normal_plan` × `normal`, 100 partidas: **73%** (Wilson [63,6%, 80,7%]), 0 excluídas; decisão na
Main Phase p50 49 ms, **p95 284 ms**, máx. 717 ms (orçamento 700 ms).

Escada `ladder-2026-09-24-plan.json` (40 partidas/par, difícil com 8 rollouts; âncora = normal):

| Nível | Elo | IC 95% |
|---|---|---|
| normal | 0 | — |
| normal_plan | **167** | [83, 272] |
| dificil | 66 | [−23, 164] |

normal_plan sobre normal 77,5%; **difícil sobre normal_plan 40%** — o planejador supera o MCTS e
custa uma fração do tempo.

## Topo da escada: MCTS com âncora alternativa — 2026-09-24

`mctsPolicy` aceita `anchor`: `zero_mcts` = MCTS do difícil ancorado nas personas do zero_system;
`dificil_plan` = MCTS ancorado no planejador. Escada `ladder-2026-09-24-topo.json` (30 partidas/par,
8 rollouts; âncora = normal_plan):

| Nível | Elo (normal_plan = 0) | IC 95% |
|---|---|---|
| normal_plan | 0 | — |
| zero_mcts | −24 | [−127, 65] |
| dificil_plan | **144** | [46, 255] |

- dificil_plan sobre normal_plan 63,3% (19/30); sobre zero_mcts 80% (24/30).
- zero_mcts ≈ normal_plan (53,3%): MCTS sobre as personas não passa do planejador — a âncora pesa
  mais que a busca por cima dela.
- Somando as escadas (mesma âncora `normal` no elo anterior): normal 0 → normal_plan ~+167 →
  dificil_plan ~+310. O difícil atual (MCTS sobre a heurística) fica em ~+66.

## Produto após o planejador — confirmação (2026-09-24)

Níveis do produto: **normal** = heurística + planejador de turno; **difícil** = MCTS (16 rollouts)
ancorado no planejador, teto de **1,5 s** por decisão (planejador até 0,5 s). Configurações antigas:
`normal_v1`/`dificil_v1` (experimentais). O "tempo de pensar" de 1–2 s desconta o tempo de cálculo.

Escada `ladder-2026-09-24-produto.json` (30 partidas/par, configuração real do produto, 95 min,
0 excluídas):

| Nível | Elo (normal = 0) | IC 95% |
|---|---|---|
| normal | 0 | — |
| dificil | 86 | [−17, 197] |
| dificil_32 | 148 | [59, 257] |

- difícil sobre normal: 60% (Wilson [42,3%, 75,4%]) — mesmo patamar do `dificil_plan` sem teto
  sobre `normal_plan` (63,3%): o teto de 1,5 s não tirou força visível.
- `dificil_32` (dobro de rollouts e de orçamento) sobre difícil: 56,7% (Wilson [39,2%, 72,6%]) —
  **não conclusivo**. Pela regra combinada (só com Wilson > 50%), o zero_system **não** vira
  `dificil_32`; segue com as personas (mais fraco que o difícil).
- Com 30 partidas por par os degraus normal → difícil → difícil_32 não fecham a meta de Wilson; só
  `dificil_32` sobre normal (73,3%, Wilson [55,6%, 85,8%]) é significativo.

## Zero System — fase B: counter do deck do jogador (2026-09-24)

Spec `bot-zero-system-forte`. O Zero System joga com a policy do difícil (MCTS + planejador) e
escolhe o deck do bot contra o do jogador: `engine/bot/zeroCounter.ts` acha o deck do pool mais
parecido com o do jogador e usa o que mais o vence numa matriz de confrontos, com a taxa encolhida
em direção à média do candidato (10 partidas de peso — contra "vencedor por sorte"). O builder
temático antigo devolvia um starter fixo por arquétipo e foi aposentado aqui.

Matriz `matchups-2026-09-24.json`: 14 decks, 10 partidas/par, 910 partidas, 0 excluídas.
**Limitação:** gerada com o nível **normal** nos dois lados (~5 s/partida; com o difícil seria ~60 s).
Taxa média contra o pool — topo: GQuuuuuuX (ST06 meta) 73,8%, ST04 65,4%, Qubeley 64,6%.

Validação `counter-2026-09-24.json` (policy do **difícil** nos dois lados, seeds novas, 8 partidas
por deck do jogador, 112 partidas):

| | Taxa | Wilson |
|---|---|---|
| counter × deck do jogador | **62,5%** (70/112) | [53,3%, 70,9%] |
| baseline (GQuuuuuuX fixo) × deck do jogador | 61,6% (69/112) | [52,4%, 70,1%] |

A meta do spec (≥ 60%, Wilson > 50%, acima do baseline) **passa**, mas a diferença pro baseline é
1 partida em 112 — empate. Em 10 dos 14 decks o counter escolhido É o baseline; o ganho do Zero
System vem de jogar com o deck mais forte do pool, não da escolha por confronto. Para o counter
render mais: matriz com mais partidas por par (ou com o difícil) e um pool maior/mais variado.

## Zero System — fase A: avaliação calibrada (2026-09-25) — sem ganho, não ligada

Spec `bot-zero-system-forte`, fase A. `EvalWeights` virou parâmetro de `evaluatePosition` /
`sideStrength` / `positionValue` (default = `EVAL_WEIGHTS`, golden intacto); planejador e MCTS aceitam
`weights`. Pools disjuntos `calib` / `valid` (7 + 7 decks, alternados pela taxa média da matriz).

Calibração `calib-2026-09-25.json` (`pnpm gundam:bot:calibrate`): busca por coordenadas, planejador com
o candidato × planejador com os pesos atuais, 60 partidas por candidato no pool `calib`, aceite ≥ 57%.

| Peso | Fator | Candidato × atual |
|---|---|---|
| shield | ×0.5 | 45.0% |
| shield | ×1.6 | 45.0% |
| baseHp | ×0.5 | 51.7% |
| baseHp | ×1.6 | 43.3% |
| durableBoard | ×0.5 | 45.0% |
| durableBoard | ×1.6 | 48.3% |
| handCard | ×0.5 | 55.0% |
| handCard | ×1.6 | 51.7% |
| attackReadyAp | ×0.5 | 46.7% |
| attackReadyAp | ×1.6 | 46.7% |
| readyBlockerHp | ×0.5 | 43.3% |
| readyBlockerHp | ×1.6 | 48.3% |

**Nenhum candidato passou** (média ≈ 48%; melhor 55% = ruído com 60 partidas). Os pesos atuais estão
num ótimo local para variações de ×0,5 / ×1,6 — pela regra do spec a fase A **não liga nada** no
Zero System. O ganho de força do Zero System não está nos pesos da avaliação: próximos candidatos são
avaliação aprendida (features × resultado de self-play) ou mais busca com orçamento maior.

## Dados cadastrados → counter do Zero System (preparo, 2026-09-25)

Spec `bot-dados-pool`. Pronto pra quando houver mais decks e torneios no site:

```
pnpm gundam:bot:refresh                      # banco → pool → matriz (paralelo) → fixture
pnpm gundam:bot:refresh -- --validate=8      # + validação com o difícil (horas)
pnpm gundam:bot:refresh -- --pool=<arquivo>  # sem ler o banco
```

- `gundam:bot:pool-export` (só leitura): listas de torneio (`TournamentEntry → DeckSnapshot`) +
  decks `PUBLIC`, com o mesmo gate de cobertura do Treino Solo e legalidade; mesma lista em vários
  lugares vira uma (fica a melhor colocação); `--with-fixed` soma os 14 decks fixos; `--max` (40).
- `gundam:bot:matchups --pool=<nome|arquivo> --workers=N`: default `min(núcleos−1, memória livre /
  1,5 GB, 6)`. Mede **sem tetos de tempo** (`policyForLevel(..., { timeBudgets: false })`): a decisão
  não depende da carga da máquina, então série e paralelo dão a **mesma matriz** (conferido: starters,
  2 partidas/par, 383 s em série × 268 s com 2 workers, matrizes idênticas). O produto segue com os tetos.
- A fixture do counter leva as **listas** quando a matriz vem de arquivo (`MatchupTable.lists`): o
  servidor monta o counter a partir delas, sem depender dos decks fixos.
- A fixture só muda no produto num commit revisado — o refresh não publica nada sozinho.
- Privacidade: nenhum id do banco nem nome de jogador sai do export; cada deck vira `POOL-<hash da lista>`
  e a fixture guarda só id + códigos das cartas. O relatório `docs/bot/pool-db-*.json` tem rótulos
  (deck/torneio/colocação) e fica fora do git (`.gitignore`).

**Partidas reais já são dataset:** `SimulatorMatchLog` guarda, por partida encerrada, os dois decks, a
seed, a versão do motor e todas as ações — dá pra reproduzir lance a lance e treinar uma avaliação
aprendida no futuro (nada novo a gravar).
