# sim-bot — worker do bot de treino do Simulador

Processa os turnos do bot heurístico no **modo treino solo** (docs/44 Fase 2 §4.2 / §10.2).

## Como funciona

1. O jogador começa um treino em `/simulador/treino` → `POST /api/simulator/training/new`
   cria uma `SimulatorMatch` com o jogador no assento **A** e o bot no **B**
   (`seats.B.bot = { policy: "heuristic", level }`).
2. Sempre que o motor autoritativo (`src/modules/simulator/server/matchStore.ts`)
   fica com a vez no assento do bot, ele **enfileira** uma linha
   `SimulatorBotTurn` (`status = "pending"`). **O web server nunca roda a policy
   do bot inline.**
3. Este worker faz polling da tabela (`status = "pending"`, mais antigo primeiro),
   marca `processing`, carrega a partida, roda a heurística
   (`heuristicPolicy({ level })`) **em loop** até o turno do bot acabar, e aplica
   cada ação de volta pela **API autoritativa**
   (`POST /api/simulator/matches/:id/actions`), autenticado como conta de serviço.
4. Marca `done`, ou `failed` + `error` (`attempts++`; 3 falhas → `failed` definitivo).

A leitura do `GameState` (via Prisma, direto da linha `SimulatorMatch.state`) é
só para **decidir**. Toda mutação passa pela API — o web server é o único dono do
`matchStore`.

## Variáveis de ambiente

| Var | Obrigatória | Default | Descrição |
|-----|-------------|---------|-----------|
| `SIM_BOT_TOKEN` | **sim** | — | JWT da conta de serviço do bot (ver abaixo). |
| `DATABASE_URL` | **sim** | — | Mesmo Postgres do web server (lê `SimulatorBotTurn` / `SimulatorMatch`). |
| `SIM_BOT_API_URL` | não | `http://localhost:8787` | Base do web server autoritativo. |
| `SIM_BOT_POLL_MS` | não | `1000` | Intervalo do polling. |
| `SIM_BOT_MAX_ATTEMPTS` | não | `3` | Falhas antes de marcar o turno como `failed` definitivo. |

### Gerando o `SIM_BOT_TOKEN`

O bot é um **assento sintético** (não é um usuário do banco), com id fixo
`sim-bot` (`SIM_BOT_USER_ID` em `src/modules/simulator/server/trainingMatch.ts`).
O token é um JWT assinado com o **mesmo `JWT_SECRET` do web server**, cujo
`userId` **precisa** ser exatamente `sim-bot` (é assim que a rota de ações
resolve o assento).

A partir da raiz do repo:

```bash
JWT_SECRET='<segredo-do-web-server>' pnpm sim-bot:make-token
```

O script (`services/sim-bot/scripts/make-token.mjs`) imprime o token em `stdout`
e a data de expiração em `stderr`. TTL configurável via `SIM_BOT_TOKEN_TTL`
(default `365d`).

## Rodar local

Com o web server (`pnpm dev:api`) e o Postgres (`pnpm db:up`) no ar, **a partir da
raiz do repositório** (pra carregar o `.env`):

```bash
SIM_BOT_TOKEN=<jwt> node --import tsx services/sim-bot/index.mjs
```

## Deploy

Passo a passo completo em **`docs/52-deploy-sim-bot.md`** (gitignored).

Resumo: o worker importa o motor de `src/modules/simulator/**` direto, então o
deploy empacota o **monorepo inteiro** via `services/sim-bot/Dockerfile` (contexto
de build = raiz do repo). No Railway é um **segundo serviço** no mesmo projeto,
apontando pro mesmo repo, com Root Directory = raiz e Config File =
`services/sim-bot/railway.json`. Sem healthcheck HTTP (é um worker de fila).

```bash
# valida a imagem localmente (a partir da raiz do repo)
docker build -f services/sim-bot/Dockerfile -t sim-bot .
```
