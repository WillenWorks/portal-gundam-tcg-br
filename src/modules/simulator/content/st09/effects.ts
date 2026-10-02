import type { EffectSpec } from "../../engine/effectSpec";
import { stdAddToHandBurst, stdDeployThisBurst } from "../standardSpecs";

/**
 * Starter ST09 — EffectSpecs. W6-prep: só os textos padrão de 【Burst】 (o 【Deploy】 de ST09-010 Minerva tem
 * "Then, …" — autoria própria na W6).
 */
export const ST09_EFFECT_SPECS: EffectSpec[] = [stdAddToHandBurst("ST09-008"), stdDeployThisBurst("ST09-010")];
