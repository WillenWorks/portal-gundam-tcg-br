#!/usr/bin/env node
import "dotenv/config";

import jwt from "jsonwebtoken";

/**
 * Gera o `SIM_BOT_TOKEN` — o JWT da conta de serviço do bot de treino.
 *
 * A rota autoritativa (`POST /api/simulator/matches/:id/actions`) só faz
 * `jwt.verify(token, JWT_SECRET)` e resolve o assento pelo `userId` do payload.
 * O `userId` PRECISA ser exatamente `sim-bot` (= `SIM_BOT_USER_ID` em
 * `src/modules/simulator/server/trainingMatch.ts`), e o token PRECISA ser
 * assinado com o MESMO `JWT_SECRET` do web server — senão toda ação volta 401.
 *
 * Uso (a partir da raiz do repo, pra carregar o `.env`):
 *   node services/sim-bot/scripts/make-token.mjs
 *   pnpm sim-bot:make-token
 *
 * Ou passando o segredo na hora (produção — o mesmo valor do web service):
 *   JWT_SECRET='<segredo-do-web-server>' node services/sim-bot/scripts/make-token.mjs
 *
 * TTL configurável via `SIM_BOT_TOKEN_TTL` (default `365d`). Vale a pena anotar
 * a data de expiração — quando o token vencer, o worker para de aplicar ações
 * (401) e os turnos do bot acumulam em `pending`.
 */

const SECRET = process.env.JWT_SECRET;
const TTL = process.env.SIM_BOT_TOKEN_TTL ?? "365d";

if (!SECRET || SECRET === "change-this-secret") {
  console.error(
    "[make-token] JWT_SECRET ausente ou ainda no valor default.\n" +
      "Exporte o MESMO JWT_SECRET do web server e rode de novo:\n" +
      "  JWT_SECRET='<segredo-do-web-server>' node services/sim-bot/scripts/make-token.mjs",
  );
  process.exit(1);
}

const payload = {
  userId: "sim-bot",
  username: "sim-bot",
  email: "sim-bot@portal.local",
  role: "USER",
  isHoster: false,
};

const token = jwt.sign(payload, SECRET, { expiresIn: TTL });

const decoded = jwt.decode(token);
const expIso = decoded && typeof decoded === "object" && decoded.exp ? new Date(decoded.exp * 1000).toISOString() : "?";

process.stderr.write(`[make-token] userId=sim-bot ttl=${TTL} expira=${expIso}\n`);
process.stdout.write(`${token}\n`);
