/* Catálogo de sons do simulador: o que cada `SfxId` é na mesa (categoria, prioridade, volume) e o som sintetizado
 * que toca no lugar enquanto o arquivo não carregou — ou sempre, com o pacote "sintetizado". Os arquivos e as
 * durações vêm do catálogo gerado (`sfxAssets.generated.ts`, pnpm sfx:build). */
import { SFX_ASSETS } from "./sfxAssets.generated";
import type { SfxAsset } from "./sfxTypes";
import { sfx } from "./soundEffects";

export type SfxId = keyof typeof SFX_ASSETS;

/** combate e jogadas disputam a mesma voz principal; sistema (turno, fim de jogo) tem a sua */
export type SfxCategory = "combat" | "play" | "system";

export interface SfxSpec {
  category: SfxCategory;
  /** com vozes demais ao mesmo tempo, a de menor prioridade cede */
  priority: number;
  /** ajuste fino sobre o volume já igualado na preparação */
  gain: number;
  synth: () => void;
}

export const SFX: Record<SfxId, SfxSpec> = {
  "combat.start": { category: "combat", priority: 2, gain: 0.8, synth: () => sfx.playMonoeyeLock() },
  "attack.high": { category: "combat", priority: 3, gain: 1, synth: () => sfx.playBeamRifle() },
  "attack.low": { category: "combat", priority: 3, gain: 0.9, synth: () => sfx.playBeamSaberSlash() },
  "base.damaged": { category: "combat", priority: 4, gain: 1, synth: () => sfx.playExplosion() },
  "base.destroyed": { category: "combat", priority: 5, gain: 1, synth: () => sfx.playExplosion() },
  "blocker.block": { category: "combat", priority: 3, gain: 0.9, synth: () => sfx.playShieldBlock() },
  "blocker.damaged": { category: "combat", priority: 3, gain: 0.9, synth: () => sfx.playImpact() },
  breach: { category: "combat", priority: 4, gain: 1, synth: () => sfx.playShieldBurst() },
  "command.action": { category: "play", priority: 3, gain: 0.9, synth: () => sfx.playNewtypeFlash() },
  "command.main": { category: "play", priority: 3, gain: 0.9, synth: () => sfx.playNewtypeFlash() },
  "deploy.high": { category: "play", priority: 3, gain: 1, synth: () => sfx.playDeploy() },
  "deploy.low": { category: "play", priority: 2, gain: 0.85, synth: () => sfx.playDeploy() },
  highManeuver: { category: "combat", priority: 3, gain: 0.9, synth: () => sfx.playThrusterBoost() },
  link: { category: "play", priority: 3, gain: 0.9, synth: () => sfx.playNewtypeFlash() },
  pair: { category: "play", priority: 2, gain: 0.85, synth: () => sfx.playDeploy() },
  unrest: { category: "system", priority: 1, gain: 0.6, synth: () => sfx.playCardRest() },
  "shield.destroyed": { category: "combat", priority: 4, gain: 1, synth: () => sfx.playShieldBurst() },
  "unit.activate": { category: "play", priority: 2, gain: 0.85, synth: () => sfx.playNewtypeFlash() },
  "unit.destroyed": { category: "combat", priority: 4, gain: 1, synth: () => sfx.playExplosion() },
  "unit.repair": { category: "play", priority: 2, gain: 0.8, synth: () => sfx.playCardDraw() },
  "combat.lockon": { category: "system", priority: 2, gain: 0.7, synth: () => sfx.playMonoeyeLock() },
  "ability.burst": { category: "play", priority: 4, gain: 0.9, synth: () => sfx.playShieldBurst() },
  "ability.announce": { category: "play", priority: 2, gain: 0.75, synth: () => sfx.playNewtypeFlash() },
  "effect.damage": { category: "play", priority: 3, gain: 0.85, synth: () => sfx.playImpact() },
  "effect.buff": { category: "play", priority: 1, gain: 0.6, synth: () => sfx.playNewtypeFlash() },
  "effect.debuff": { category: "play", priority: 1, gain: 0.6, synth: () => sfx.playMonoeyeLock() },
  "card.draw": { category: "system", priority: 1, gain: 0.6, synth: () => sfx.playCardDraw() },
  "resource.place": { category: "system", priority: 1, gain: 0.55, synth: () => sfx.playCardRest() },
  "turn.mine": { category: "system", priority: 3, gain: 0.8, synth: () => sfx.playNewtypeFlash() },
  "turn.opponent": { category: "system", priority: 3, gain: 0.7, synth: () => sfx.playTurnStartAlert() },
  "game.win": { category: "system", priority: 5, gain: 0.9, synth: () => sfx.playNewtypeFlash() },
  "game.lose": { category: "system", priority: 5, gain: 0.9, synth: () => sfx.playExplosion() },
  "phase.banner": { category: "system", priority: 2, gain: 0.6, synth: () => sfx.playTurnStartAlert() },
  "phase.action": { category: "system", priority: 2, gain: 0.7, synth: () => sfx.playTurnStartAlert() },
  "coin.flip": { category: "system", priority: 2, gain: 0.7, synth: () => sfx.playClick() },
  "coin.land": { category: "system", priority: 3, gain: 0.8, synth: () => sfx.playShieldBlock() },
  "shields.set": { category: "system", priority: 3, gain: 0.8, synth: () => sfx.playShieldBlock() },
};

export function assetsOf(id: SfxId): readonly SfxAsset[] {
  return SFX_ASSETS[id];
}

export const SFX_IDS = Object.keys(SFX_ASSETS) as SfxId[];
