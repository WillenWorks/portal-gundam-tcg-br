const SHORT_SHA_LENGTH = 7;

/**
 * Versão do motor gravada nas partidas (`GameState.engineVersion`). No Render o runtime
 * não tem `.git`, então `git rev-parse` falha e tudo virava "dev" — o commit do deploy
 * vem em `RENDER_GIT_COMMIT`.
 */
export function engineShaFromEnv(env: Record<string, string | undefined>): string | undefined {
  if (env.ENGINE_SHA) return env.ENGINE_SHA;
  if (env.RENDER_GIT_COMMIT) return env.RENDER_GIT_COMMIT.slice(0, SHORT_SHA_LENGTH);
  return undefined;
}
