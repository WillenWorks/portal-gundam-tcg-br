# @portal-gundam/sim-trainer

Serviço de **treino ML do bot** do Simulador (docs/50, Lane 4C / Wave 4).
Gera dataset de self-play, treina a policy-value net e roda o gate de
avaliação. **Nunca roda no web server** — é um job dedicado (batch / nightly).

> Decisões de arquitetura, espaço de ação e critério de promoção: **`docs/50-treino-ml.md`**.

## O que tem aqui

| Arquivo | O quê |
|---|---|
| `pipeline.mjs` | Encadeia `dataset → fit → eval` numa tacada |
| `package.json` | Scripts do serviço (`pipeline`, `dataset`, `fit`, `eval`) |
| `data/` | Datasets de self-play (`<sha>.jsonl`) — **gitignored** |
| `models/` | Pesos treinados + `manifest.json` (`<sha>/`) — **gitignored** |

A lógica de verdade vive em `scripts/train/` na raiz do repo
(`dataset.mjs`, `fit.mjs`, `eval.mjs`, e os helpers `engine.mjs`, `tf.mjs`,
`model.mjs`). Este serviço só orquestra e é o dono dos diretórios de artefato.

## Runtime — TensorFlow.js

- **Padrão:** `@tensorflow/tfjs` puro-JS (backend `cpu`). Instala sem toolchain
  nativa, roda em qualquer lugar, é lento.
- **Rápido (Linux/CI):** `pnpm -w add @tensorflow/tfjs-node` e rode com
  `SIM_TRAINER_TF_BACKEND=node`. Os scripts fazem *feature-detection* — nenhuma
  outra mudança de código. Neste ambiente de dev (Windows sem Visual Studio
  Build Tools) o `tfjs-node` **não instala** — ver docs/50 §Fase 0.1.

## Uso

Da raiz do repo:

```bash
# 1) dataset de self-play (todos os pares ST01-04, policies mistas)
pnpm train:dataset --games=2000 --seed=1
#    -> services/sim-trainer/data/<sha>.jsonl

# 2) treino da policy-value net
pnpm train:fit --data=services/sim-trainer/data/<sha>.jsonl --epochs=40
#    -> services/sim-trainer/models/<sha>/{model.json, weights.bin, manifest.json}

# 3) gate de avaliação (200 partidas/par, seed fixo)
pnpm train:eval --model=services/sim-trainer/models/<sha>
#    -> imprime winrate vs heuristic / vs (mcts|randomLegal) + VEREDITO

# tudo de uma vez
node services/sim-trainer/pipeline.mjs --games=2000 --epochs=40
```

## Critério de promoção (o GATE)

Um modelo só é **aprovado** quando:

1. `winrate(neural vs heuristic normal) > 55%` (agregado sobre os pares) —
   impresso por `pnpm train:eval` (use `--strict` para exit ≠ 0 em nightly).
2. `pnpm gundam:golden` continua **verde**. O `neuralPolicy` só escolhe entre
   ações que o próprio motor já declarou legais (nunca muta o `GameState`),
   então o golden passa trivialmente — o passo é só *safety net*.

O gate é **caro** — rodar **nightly / on-demand**, nunca no CI de PR.

## Onde o modelo aprovado vive

O modelo aprovado **não** é commitado neste repo (pesos são gitignored). Depois
de aprovado, o diretório `services/sim-trainer/models/<sha>/` é publicado onde
o worker do bot (`services/sim-bot/`) consegue lê-lo e o `neuralPolicy` é
apontado pra lá (`neuralPolicy({ modelDir, loadArtifacts })`).

## Deploy

Fora do escopo desta lane. **Ver Lane 4D / `docs/50`.** Este serviço não
carrega nenhuma config de deploy (Render/Docker) de propósito.
