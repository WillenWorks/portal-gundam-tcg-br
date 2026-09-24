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

- **Letal** (normal e difícil): com o oponente sem escudo nem Base, ataca uma Unit rested em vez do
  jogador — a nota de "destruir e sobreviver" (35+) supera a de "atacar o jogador" (14+2·AP).
- **Sequência no turno** (todos os níveis): "rest na Unit e depois atacá-la" e "remover o <Blocker> e
  dar o letal" — spec `bot-planejamento-turno`.
- **zero_system**: não bloqueia pra salvar a Base e ataca com o <Blocker> que segura a Base.
