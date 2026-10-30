/* Motor do pacote de sons (arquivos de `public/sfx`). Regra da mesa: o som acompanha a ação — quem toca abre um
 * escopo no começo do tempo da cena e fecha no fim (`scope().end()`), e o que ainda soar sai num fade curto. Nenhum
 * som sobrevive ao tempo que o tocou, em qualquer velocidade.
 *
 * O ponto de impacto de cada arquivo (medido na preparação) é alinhado ao instante da ação (`alignImpactAtMs`): se o
 * golpe acerta 260 ms depois do começo, o som começa antes o bastante para o estouro cair ali — ou já começa do meio,
 * se não houver tempo. Sem o arquivo carregado (ou com o pacote "sintetizado"), toca o som sintetizado de antes. */
import { SFX, SFX_IDS, assetsOf, type SfxCategory, type SfxId } from "./sfxManifest";
import { sfx } from "./soundEffects";

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

/** sorteio sem repetir o último (com 1 variante, sempre ela) */
export class ShuffleBag {
  private last = -1;
  private readonly rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }

  next(size: number): number {
    if (size <= 1) return 0;
    const fresh = this.last < 0 || this.last >= size;
    let pick = Math.floor(this.rng() * (fresh ? size : size - 1));
    if (!fresh && pick >= this.last) pick += 1;
    this.last = pick;
    return pick;
  }
}

/** acelerar a cena acelera um pouco o som (até 1.2x, antes de soar estranho); o resto o fim do tempo corta */
export const MAX_PLAYBACK_RATE = 1.2;

export function playbackRateFor(speed: number): number {
  if (!(speed > 1)) return 1;
  return Math.min(MAX_PLAYBACK_RATE, 1 + (speed - 1) * 0.2);
}

/** quando começar (ms a partir de agora) e de onde do arquivo, para o impacto cair em `alignAtMs` */
export function planStart({ impactMs, alignAtMs, rate }: { impactMs: number; alignAtMs: number; rate: number }): { delayMs: number; offsetMs: number } {
  const start = alignAtMs - impactMs / rate;
  return start >= 0 ? { delayMs: start, offsetMs: 0 } : { delayMs: 0, offsetMs: -start * rate };
}

export interface SfxPlayOptions {
  /** começa depois disto (ms, já na escala da cena) */
  delayMs?: number;
  /** o impacto do arquivo cai neste instante (ms a partir de agora, já na escala da cena) — vence `delayMs` */
  alignImpactAtMs?: number;
  /** velocidade efetiva da cena (`effectiveAnimSpeed`) */
  speed?: number;
  /** sai em fade neste instante (ms a partir de agora), mesmo que o escopo ainda esteja aberto */
  untilMs?: number;
}

export interface SfxHandle {
  readonly id: SfxId;
  readonly active: boolean;
  stop(fadeMs?: number): void;
}

/** os sons de um tempo da cena — `end()` no fim do tempo */
export interface SfxScope {
  play(id: SfxId, options?: SfxPlayOptions): SfxHandle | null;
  end(fadeMs?: number): void;
}

/** fade de saída padrão quando o tempo da cena termina */
export const SCOPE_FADE_MS = 100;
/** vozes ao mesmo tempo por categoria; a mais fraca cede */
export const VOICES_PER_CATEGORY = 2;

interface Voice {
  handle: SfxHandle;
  category: SfxCategory;
  priority: number;
  startedAt: number;
}

export interface SampleEngineDeps {
  context: () => AudioContext | null;
  load: (src: string) => Promise<ArrayBuffer>;
  enabled: () => boolean;
  volume: () => number;
  pack: () => SfxPack;
  rng?: () => number;
}

export class SampleSfxEngine {
  private buffers = new Map<string, AudioBuffer>();
  private bags = new Map<SfxId, ShuffleBag>();
  private voices: Voice[] = [];
  private loading: Promise<void> | null = null;
  private readonly deps: SampleEngineDeps;

  constructor(deps: SampleEngineDeps) {
    this.deps = deps;
  }

  /** baixa e decodifica o pacote (uma vez); falha de um arquivo deixa só ele no sintetizado */
  preload(ids: readonly SfxId[] = SFX_IDS): Promise<void> {
    if (this.deps.pack() !== "gundam") return Promise.resolve();
    if (this.loading) return this.loading;
    const ctx = this.deps.context();
    if (!ctx) return Promise.resolve();
    const srcs = [...new Set(ids.flatMap((id) => assetsOf(id).map((a) => a.src)))];
    this.loading = Promise.all(
      srcs.map(async (src) => {
        try {
          this.buffers.set(src, await ctx.decodeAudioData(await this.deps.load(src)));
        } catch (error) {
          console.warn(`[sfx] não carregou ${src}, fica o sintetizado`, error);
        }
      }),
    ).then(() => undefined);
    return this.loading;
  }

  isLoaded(id: SfxId): boolean {
    return assetsOf(id).every((a) => this.buffers.has(a.src));
  }

  play(id: SfxId, options: SfxPlayOptions = {}): SfxHandle | null {
    if (!this.deps.enabled()) return null;
    const spec = SFX[id];
    const ctx = this.deps.context();
    const assets = assetsOf(id);
    const bag = this.bags.get(id) ?? new ShuffleBag(this.deps.rng);
    this.bags.set(id, bag);
    const asset = assets[bag.next(assets.length)];
    const buffer = asset ? this.buffers.get(asset.src) : undefined;
    if (this.deps.pack() !== "gundam" || !ctx || !buffer || !asset) {
      spec.synth();
      return null;
    }
    if (!this.makeRoom(spec.category, spec.priority)) return null;

    const rate = playbackRateFor(options.speed ?? 1);
    const { delayMs, offsetMs } =
      options.alignImpactAtMs !== undefined
        ? planStart({ impactMs: asset.impactMs, alignAtMs: options.alignImpactAtMs, rate })
        : { delayMs: Math.max(0, options.delayMs ?? 0), offsetMs: 0 };

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = ctx.createGain();
    const level = spec.gain * this.deps.volume();
    gain.gain.value = level;
    source.connect(gain);
    gain.connect(ctx.destination);
    const startAt = ctx.currentTime + delayMs / 1000;
    source.start(startAt, offsetMs / 1000);

    let active = true;
    const voice: Voice = { category: spec.category, priority: spec.priority, startedAt: startAt, handle: null as unknown as SfxHandle };
    const release = () => {
      active = false;
      this.voices = this.voices.filter((v) => v !== voice);
    };
    source.onended = release;
    const fadeAt = (atSec: number, fadeMs: number) => {
      const fade = Math.max(0.005, fadeMs / 1000);
      gain.gain.cancelScheduledValues(atSec);
      gain.gain.setValueAtTime(level, atSec);
      gain.gain.linearRampToValueAtTime(0, atSec + fade);
      source.stop(atSec + fade);
    };
    voice.handle = {
      id,
      get active() {
        return active;
      },
      stop: (fadeMs = SCOPE_FADE_MS) => {
        if (!active) return;
        fadeAt(ctx.currentTime, fadeMs);
        release();
      },
    };
    if (options.untilMs !== undefined) fadeAt(ctx.currentTime + Math.max(0, options.untilMs) / 1000, SCOPE_FADE_MS);
    this.voices.push(voice);
    return voice.handle;
  }

  /** abre espaço na categoria: cede a voz mais fraca (e mais antiga) se a nova não for mais fraca que ela */
  private makeRoom(category: SfxCategory, priority: number): boolean {
    const same = this.voices.filter((v) => v.category === category);
    if (same.length < VOICES_PER_CATEGORY) return true;
    const weakest = same.reduce((w, v) => (v.priority < w.priority || (v.priority === w.priority && v.startedAt < w.startedAt) ? v : w));
    if (priority < weakest.priority) return false;
    weakest.handle.stop(60);
    return true;
  }

  activeCount(): number {
    return this.voices.length;
  }

  stopAll(fadeMs = SCOPE_FADE_MS) {
    for (const voice of [...this.voices]) voice.handle.stop(fadeMs);
  }

  scope(): SfxScope {
    const handles: SfxHandle[] = [];
    return {
      play: (id, options) => {
        const handle = this.play(id, options);
        if (handle) handles.push(handle);
        return handle;
      },
      end: (fadeMs = SCOPE_FADE_MS) => {
        for (const handle of handles) handle.stop(fadeMs);
        handles.length = 0;
      },
    };
  }
}

export const sampleSfx = new SampleSfxEngine({
  context: () => sfx.audioContext(),
  load: async (src) => {
    const response = await fetch(`${import.meta.env?.BASE_URL ?? "/"}${src}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.arrayBuffer();
  },
  enabled: () => sfx.isEnabled(),
  volume: () => sfx.getVolume(),
  pack: getSfxPack,
});
