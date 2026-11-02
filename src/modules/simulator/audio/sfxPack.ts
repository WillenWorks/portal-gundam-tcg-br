/* Qual pacote de sons está em uso. Fica à parte porque os dois motores precisam saber: o de amostras
 * (`sampleEngine`) e o sintetizado (`soundEffects`), que só toca com o pacote "sintetizado". */
export type SfxPack = "gundam" | "synth";

const PACK_STORAGE_KEY = "portal_gundam_sim_sfx_pack";

function isPack(value: unknown): value is SfxPack {
  return value === "gundam" || value === "synth";
}

/** padrão do build: `VITE_SIM_SFX_PACK=synth` volta para os sons sintetizados sem mexer no código */
export function defaultSfxPack(env: Record<string, unknown> = import.meta.env ?? {}): SfxPack {
  return isPack(env.VITE_SIM_SFX_PACK) ? env.VITE_SIM_SFX_PACK : "gundam";
}

export function getSfxPack(): SfxPack {
  try {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(PACK_STORAGE_KEY) : null;
    if (isPack(saved)) return saved;
  } catch {
    // armazenamento bloqueado (aba privada): fica o padrão do build
  }
  return defaultSfxPack();
}

export function saveSfxPack(pack: SfxPack) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(PACK_STORAGE_KEY, pack);
  } catch {
    // sem armazenamento a escolha vale só até recarregar
  }
}
