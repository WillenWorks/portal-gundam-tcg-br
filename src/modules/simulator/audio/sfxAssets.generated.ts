/* GERADO por scripts/audio/build-sfx.mjs — não editar à mão (pnpm sfx:build) */
import type { SfxAsset } from "./sfxTypes";

export const SFX_ASSETS = {
  "combat.start": [
    { src: "sfx/combat-start-1.m4a", durationMs: 1210, impactMs: 210 },
  ],
  "attack.high": [
    { src: "sfx/attack-high-1.m4a", durationMs: 2000, impactMs: 30 },
    { src: "sfx/attack-high-2.m4a", durationMs: 1775, impactMs: 10 },
    { src: "sfx/attack-high-3.m4a", durationMs: 2000, impactMs: 60 },
    { src: "sfx/attack-high-4.m4a", durationMs: 1468, impactMs: 40 },
    { src: "sfx/attack-high-5.m4a", durationMs: 2000, impactMs: 10 },
    { src: "sfx/attack-high-6.m4a", durationMs: 2000, impactMs: 870 },
  ],
  "attack.low": [
    { src: "sfx/attack-low-1.m4a", durationMs: 1793, impactMs: 50 },
    { src: "sfx/attack-low-2.m4a", durationMs: 954, impactMs: 60 },
    { src: "sfx/attack-low-3.m4a", durationMs: 1791, impactMs: 40 },
    { src: "sfx/attack-low-4.m4a", durationMs: 1800, impactMs: 0 },
    { src: "sfx/attack-low-5.m4a", durationMs: 1312, impactMs: 20 },
    { src: "sfx/attack-low-6.m4a", durationMs: 1800, impactMs: 80 },
    { src: "sfx/attack-low-7.m4a", durationMs: 1278, impactMs: 40 },
  ],
  "base.damaged": [
    { src: "sfx/base-damaged-1.m4a", durationMs: 2000, impactMs: 220 },
  ],
  "base.destroyed": [
    { src: "sfx/base-destroyed-1.m4a", durationMs: 2400, impactMs: 20 },
  ],
  "blocker.block": [
    { src: "sfx/blocker-block-1.m4a", durationMs: 1400, impactMs: 50 },
  ],
  "blocker.damaged": [
    { src: "sfx/blocker-damaged-1.m4a", durationMs: 1600, impactMs: 20 },
  ],
  "breach": [
    { src: "sfx/breach-1.m4a", durationMs: 1800, impactMs: 80 },
  ],
  "command.action": [
    { src: "sfx/command-action-1.m4a", durationMs: 1749, impactMs: 310 },
  ],
  "command.main": [
    { src: "sfx/command-main-1.m4a", durationMs: 1736, impactMs: 30 },
  ],
  "deploy.high": [
    { src: "sfx/deploy-high-1.m4a", durationMs: 1775, impactMs: 10 },
  ],
  "deploy.low": [
    { src: "sfx/deploy-low-1.m4a", durationMs: 1245, impactMs: 40 },
  ],
  "highManeuver": [
    { src: "sfx/high-maneuver-1.m4a", durationMs: 1800, impactMs: 10 },
  ],
  "link": [
    { src: "sfx/link-1.m4a", durationMs: 1603, impactMs: 30 },
  ],
  "pair": [
    { src: "sfx/pair-1.m4a", durationMs: 1151, impactMs: 190 },
  ],
  "unrest": [
    { src: "sfx/unrest-1.m4a", durationMs: 1200, impactMs: 350 },
  ],
  "shield.destroyed": [
    { src: "sfx/shield-destroyed-1.m4a", durationMs: 1523, impactMs: 80 },
  ],
  "unit.activate": [
    { src: "sfx/unit-activate-1.m4a", durationMs: 1337, impactMs: 30 },
  ],
  "unit.destroyed": [
    { src: "sfx/unit-destroyed-1.m4a", durationMs: 1600, impactMs: 10 },
    { src: "sfx/unit-destroyed-2.m4a", durationMs: 1464, impactMs: 220 },
  ],
  "unit.repair": [
    { src: "sfx/unit-repair-1.m4a", durationMs: 1800, impactMs: 430 },
  ],
} as const satisfies Record<string, readonly SfxAsset[]>;
