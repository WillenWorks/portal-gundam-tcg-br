/* animationSettings.ts — controle de velocidade das animações do simulador
 * (docs/56, revisão do plano de polimento visual/mecânico). O multiplicador
 * escolhido pelo jogador é persistido em `localStorage` e espelhado em
 * `--sim-anim-speed-mult` no `:root`, pra durações CSS (ex.:
 * `calc(280ms / var(--sim-anim-speed-mult, 1))`) acompanharem exatamente o
 * mesmo valor que `getScaledDuration` aplica nos `setTimeout`/`setInterval`
 * de JS — uma única fonte de verdade pros dois mundos. */
import { isScenePace, type ScenePace } from "../scene/sceneTiming";

export const ANIM_SPEEDS = [0.75, 1, 1.5, 2] as const;
export type AnimSpeed = (typeof ANIM_SPEEDS)[number];

export const ANIM_SPEED_LABELS: Record<AnimSpeed, string> = {
  0.75: "0.75x Didático",
  1: "1x Normal",
  1.5: "1.5x Rápido",
  2: "2x Turbo",
};

export const ANIM_SPEED_LABELS_EN: Record<AnimSpeed, string> = {
  0.75: "0.75x Learning",
  1: "1x Normal",
  1.5: "1.5x Fast",
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

/* Ritmo da resolução (spec simulador-ritmo-de-resolucao). "cinematic" = cada coisa que o motor fez toca no seu tempo
 * (anúncio da habilidade, compra, dano, saída), igual para jogador e bot. "classic" = o ritmo anterior (golpe, Command
 * e saídas animados; os efeitos todos de uma vez) — também é a reversão sem deploy: cada jogador troca no menu, e o
 * padrão do build sai de `VITE_SIM_RESOLUTION_PACING`. */
export type ResolutionPacing = ScenePace;

export const RESOLUTION_PACING_LABELS: Record<ResolutionPacing, { pt: string; en: string }> = {
  cinematic: { pt: "Cinemático (um efeito por vez)", en: "Cinematic (one effect at a time)" },
  normal: { pt: "Normal (um efeito por vez, mais curto)", en: "Normal (one effect at a time, shorter)" },
  classic: { pt: "Rápido (efeitos juntos)", en: "Fast (effects together)" },
};

const PACING_STORAGE_KEY = "portal_gundam_sim_resolution_pacing";

const isPacing = isScenePace;

/** padrão do build: `VITE_SIM_RESOLUTION_PACING=classic` desliga o cinemático para quem nunca escolheu */
export function defaultResolutionPacing(env: Record<string, unknown> = import.meta.env ?? {}): ResolutionPacing {
  const fromEnv = env.VITE_SIM_RESOLUTION_PACING;
  return isPacing(fromEnv) ? fromEnv : "cinematic";
}

export function getResolutionPacing(): ResolutionPacing {
  try {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(PACING_STORAGE_KEY) : null;
    if (isPacing(saved)) return saved;
  } catch {
    // armazenamento bloqueado (aba privada): fica o padrão do build
  }
  return defaultResolutionPacing();
}

export function saveResolutionPacing(pacing: ResolutionPacing) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(PACING_STORAGE_KEY, pacing);
  } catch {
    // sem armazenamento a escolha vale só até recarregar
  }
}
