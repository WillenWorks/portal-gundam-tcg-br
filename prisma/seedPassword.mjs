const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isLocalDatabase(databaseUrl) {
  try {
    return LOCAL_HOSTS.has(new URL(databaseUrl).hostname);
  } catch {
    return false;
  }
}

/** Senha de conta do seed. A senha padrão só vale em banco local: o `.env` de uma máquina pode apontar para produção. */
export function seedPassword(name, localDefault, env = process.env) {
  if (env[name]) return env[name];
  if (env.NODE_ENV !== "production" && isLocalDatabase(env.DATABASE_URL)) return localDefault;
  throw new Error(`${name} é obrigatória fora de banco local.`);
}
