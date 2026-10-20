-- Versão da senha no token: trocar/redefinir a senha encerra as sessões abertas em outros aparelhos (server/sessionState.ts)
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
