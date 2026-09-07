# syntax=docker/dockerfile:1

# Worker do bot de treino do Simulador (Lane 4D — ver docs/52-deploy-sim-bot.md).
#
# Estratégia de empacotamento (A): a imagem carrega o MONOREPO. O worker
# (`services/sim-bot/index.mjs`) importa o motor de `src/modules/simulator/**`
# direto, resolvido em runtime pelo loader `tsx` (TypeScript puro, sem passo de
# build). Por isso a imagem precisa de: `src/`, o lockfile, o `prisma/schema`
# (pro `prisma generate`) e as dependências — INCLUINDO devDependencies, porque
# `tsx` e a CLI do Prisma moram lá. Trade-off vs. bundle: docs/52 §1.
#
# IMPORTANTE: o contexto de build é a RAIZ DO REPO, não `services/sim-bot/`:
#   docker build -f services/sim-bot/Dockerfile -t sim-bot .

# ---------------------------------------------------------------------------
FROM node:22-slim AS base
WORKDIR /app
# openssl: exigido pelo query engine do Prisma no Debian slim.
# tini: PID 1 que repassa SIGTERM/SIGINT (o worker trata os dois pra sair limpo).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl tini \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# ---------------------------------------------------------------------------
# deps: instala com o lockfile congelado e gera o Prisma Client.
FROM base AS deps
ENV CI=true
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
# --prod=false: garante tsx + prisma CLI mesmo se a plataforma exportar
# NODE_ENV=production no build.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod=false
RUN pnpm exec prisma generate

# ---------------------------------------------------------------------------
# runtime: só o que o worker precisa em produção.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY prisma ./prisma
COPY src ./src
COPY services/sim-bot ./services/sim-bot

# Sem HEALTHCHECK HTTP: é um worker de fila, não serve porta. A saúde é
# observada pelos logs ("[sim-bot] iniciado." / "turno ... done").
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--import", "tsx", "services/sim-bot/index.mjs"]
