/* animationSettings.ts — controle de velocidade das animações do simulador
 * (docs/56, revisão do plano de polimento visual/mecânico). O multiplicador
 * escolhido pelo jogador é persistido em `localStorage` e espelhado em
 * `--sim-anim-speed-mult` no `:root`, pra durações CSS (ex.:
 * `calc(280ms / var(--sim-anim-speed-mult, 1))`) acompanharem exatamente o
 * mesmo valor que `getScaledDuration` aplica nos `setTimeout`/`setInterval`
 * de JS — uma única fonte de verdade pros dois mundos. */

export const ANIM_SPEEDS = [0.75, 1, 1.5, 2] as const;
export type AnimSpeed = (typeof ANIM_SPEEDS)[number];

export const ANIM_SPEED_LABELS: Record<AnimSpeed, string> = {
  0.75: "0.75x Didático",
  1: "1x Normal",
  1.5: "1.5x Rápido",
  2: "2x Turbo",
};

const STORAGE_KEY = "portal_gundam_sim_anim_speed";
const DEFAULT_SPEED: AnimSpeed = 1;
const CSS_VAR = "--sim-anim-speed-mult";

function isAnimSpeed(value: number): value is AnimSpeed {
  return (ANIM_SPEEDS as readonly number[]).includes(value);
}

/** velocidade salva pelo jogador (ou `1x` se nunca configurou / SSR). */
export function getSavedAnimSpeed(): AnimSpeed {
  if (typeof window === "undefined") return DEFAULT_SPEED;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number(raw) : Number.NaN;
  return isAnimSpeed(parsed) ? parsed : DEFAULT_SPEED;
}

function applySpeedCssVar(speed: AnimSpeed) {
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty(CSS_VAR, String(speed));
  }
}

/** troca a velocidade: persiste e já atualiza a variável CSS no `:root`
 *  (efeito imediato, sem precisar remontar nada). */
export function saveAnimSpeed(speed: AnimSpeed) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, String(speed));
  }
  applySpeedCssVar(speed);
}

/** escala uma duração-base (ms) pelo multiplicador salvo — 0.75x demora mais
 *  (didático), 2x demora menos (turbo). Use no lugar de constantes fixas em
 *  `setTimeout`/animações controladas por JS. */
export function getScaledDuration(baseMs: number): number {
  return Math.round(baseMs / getSavedAnimSpeed());
}

// aplica a velocidade salva assim que o módulo é importado, pra qualquer CSS
// que já referencie `--sim-anim-speed-mult` não esperar o 1º render do
// `SettingsMenu` (que é quem inicializa o `useState` — mas outras telas do
// simulador podem montar animações antes dele).
applySpeedCssVar(getSavedAnimSpeed());
