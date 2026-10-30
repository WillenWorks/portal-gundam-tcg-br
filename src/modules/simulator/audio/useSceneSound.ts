/* O som de uma animação vive o tempo dela: toca ao montar e sai num fade ao desmontar (a animação acabou, o som
 * acaba junto). `alignImpactAtMs` em ms base — a escala da velocidade entra aqui. */
import { useEffect } from "react";
import { effectiveAnimSpeed, getScaledDuration } from "../ui/animationSettings";
import { sampleSfx } from "./sampleEngine";
import type { SfxId } from "./sfxManifest";

export function useSceneSound(id: SfxId | null, options: { alignImpactAtMs?: number; delayMs?: number } = {}) {
  const { alignImpactAtMs, delayMs } = options;
  useEffect(() => {
    if (!id) return;
    const scope = sampleSfx.scope();
    scope.play(id, {
      speed: effectiveAnimSpeed(),
      alignImpactAtMs: alignImpactAtMs === undefined ? undefined : getScaledDuration(alignImpactAtMs),
      delayMs: delayMs === undefined ? undefined : getScaledDuration(delayMs),
    });
    return () => scope.end();
  }, [id, alignImpactAtMs, delayMs]);
}
