import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SFX_ASSETS } from "./sfxAssets.generated";
import { SFX, SFX_IDS, type SfxId } from "./sfxManifest";
import { SampleSfxEngine, ShuffleBag, VOICES_PER_CATEGORY, defaultSfxPack, planStart, playbackRateFor, type SfxPack } from "./sampleEngine";

/** contexto de áudio de mentira: guarda o que foi agendado e deixa o relógio andar à mão */
class FakeContext {
  currentTime = 0;
  destination = {};
  sources: FakeSource[] = [];
  createBufferSource() {
    const s = new FakeSource(this);
    this.sources.push(s);
    return s;
  }
  createGain() {
    return { connect() {}, gain: { value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} } };
  }
  async decodeAudioData(data: ArrayBuffer) {
    return { length: data.byteLength } as unknown as AudioBuffer;
  }
  /** avança o relógio e encerra o que já devia ter parado */
  advance(sec: number) {
    this.currentTime += sec;
    for (const s of this.sources) if (!s.ended && s.stopAt !== null && s.stopAt <= this.currentTime) s.end();
  }
}

class FakeSource {
  buffer: unknown = null;
  playbackRate = { value: 1 };
  startAt: number | null = null;
  offset = 0;
  stopAt: number | null = null;
  ended = false;
  onended: (() => void) | null = null;
  private readonly ctx: FakeContext;
  constructor(ctx: FakeContext) {
    this.ctx = ctx;
  }
  connect() {}
  start(at: number, offset = 0) {
    this.startAt = at;
    this.offset = offset;
  }
  stop(at: number) {
    this.stopAt = at;
    if (at <= this.ctx.currentTime) this.end();
  }
  end() {
    this.ended = true;
    this.onended?.();
  }
}

function makeEngine(pack: SfxPack = "gundam") {
  const ctx = new FakeContext();
  const engine = new SampleSfxEngine({
    context: () => ctx as unknown as AudioContext,
    load: async () => new ArrayBuffer(8),
    enabled: () => true,
    volume: () => 0.5,
    pack: () => pack,
    rng: () => 0,
  });
  return { ctx, engine };
}

describe("catálogo do pacote", () => {
  it("todo som do catálogo tem ficha (categoria, prioridade, sintetizado) e vice-versa", () => {
    expect(Object.keys(SFX).sort()).toEqual([...SFX_IDS].sort());
  });

  it("todo arquivo do catálogo gerado existe em public/sfx", () => {
    for (const assets of Object.values(SFX_ASSETS)) {
      for (const asset of assets) {
        const file = path.resolve(import.meta.dirname, "../../../../public", asset.src);
        expect(existsSync(file), asset.src).toBe(true);
        expect(statSync(file).size).toBeGreaterThan(1000);
        expect(asset.impactMs).toBeLessThan(asset.durationMs);
      }
    }
  });
});

describe("ShuffleBag", () => {
  it("nunca repete a mesma variante duas vezes seguidas", () => {
    let seed = 7;
    const bag = new ShuffleBag(() => ((seed = (seed * 9301 + 49297) % 233280) / 233280));
    let last = -1;
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const pick = bag.next(6);
      expect(pick).not.toBe(last);
      expect(pick).toBeGreaterThanOrEqual(0);
      expect(pick).toBeLessThan(6);
      seen.add(pick);
      last = pick;
    }
    expect(seen.size).toBe(6);
  });

  it("com uma variante só, é sempre ela", () => {
    const bag = new ShuffleBag(() => 0.9);
    expect([bag.next(1), bag.next(1)]).toEqual([0, 0]);
  });
});

describe("tempo do som", () => {
  it("acelera pouco e com teto; devagar não muda", () => {
    expect(playbackRateFor(0.75)).toBe(1);
    expect(playbackRateFor(1)).toBe(1);
    expect(playbackRateFor(1.5)).toBeCloseTo(1.1);
    expect(playbackRateFor(2)).toBeCloseTo(1.2);
    expect(playbackRateFor(5)).toBeCloseTo(1.2);
  });

  it("o impacto cai no instante da ação: começa antes, ou do meio do arquivo se não der tempo", () => {
    expect(planStart({ impactMs: 60, alignAtMs: 260, rate: 1 })).toEqual({ delayMs: 200, offsetMs: 0 });
    // carga de feixe de 870 ms e o golpe em 260 ms: entra 610 ms dentro do arquivo
    expect(planStart({ impactMs: 870, alignAtMs: 260, rate: 1 })).toEqual({ delayMs: 0, offsetMs: 610 });
    const fast = planStart({ impactMs: 120, alignAtMs: 50, rate: 1.2 });
    expect(fast.delayMs).toBe(0);
    expect(fast.offsetMs).toBeCloseTo(60);
  });
});

describe("SampleSfxEngine", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("sem o arquivo carregado (ou com o pacote sintetizado) toca o sintetizado", async () => {
    const synth = vi.spyOn(SFX["attack.low"], "synth").mockImplementation(() => undefined);
    const { engine, ctx } = makeEngine();
    expect(engine.play("attack.low")).toBeNull();
    expect(synth).toHaveBeenCalledTimes(1);

    const synthPack = makeEngine("synth");
    await synthPack.engine.preload();
    expect(synthPack.engine.play("attack.low")).toBeNull();
    expect(synth).toHaveBeenCalledTimes(2);
    expect(ctx.sources).toHaveLength(0);
  });

  it("alinha o impacto ao instante pedido", async () => {
    const { engine, ctx } = makeEngine();
    await engine.preload();
    const impact = SFX_ASSETS["attack.low"][0].impactMs;
    engine.play("attack.low", { alignImpactAtMs: 260 });
    const source = ctx.sources[0];
    expect((source.startAt ?? 0) * 1000).toBeCloseTo(Math.max(0, 260 - impact));
  });

  it("invariante: fechado o tempo da cena, nenhum som segue tocando — em qualquer velocidade", async () => {
    for (const speed of [0.75, 1, 1.5, 2]) {
      const { engine, ctx } = makeEngine();
      await engine.preload();
      const scope = engine.scope();
      const beatMs = 760 / speed;
      for (const id of ["combat.start", "attack.high", "unit.destroyed"] as SfxId[]) scope.play(id, { speed, alignImpactAtMs: 260 / speed });
      ctx.advance(beatMs / 1000);
      scope.end();
      ctx.advance(0.2);
      expect(engine.activeCount(), `velocidade ${speed}`).toBe(0);
      expect(ctx.sources.every((s) => s.ended)).toBe(true);
    }
  });

  it("`untilMs` encerra sozinho mesmo com o escopo aberto", async () => {
    const { engine, ctx } = makeEngine();
    await engine.preload();
    engine.play("base.destroyed", { untilMs: 500 });
    ctx.advance(0.7);
    expect(engine.activeCount()).toBe(0);
  });

  it("com vozes demais na categoria, a mais fraca cede e a mais fraca que todas nem entra", async () => {
    const { engine } = makeEngine();
    await engine.preload();
    const weak = engine.play("combat.start"); // prioridade 2
    const strong = engine.play("unit.destroyed"); // 4
    expect(engine.activeCount()).toBe(VOICES_PER_CATEGORY);
    const stronger = engine.play("base.destroyed"); // 5: tira a mais fraca
    expect(weak?.active).toBe(false);
    expect(strong?.active).toBe(true);
    expect(stronger?.active).toBe(true);
    expect(engine.play("combat.start")).toBeNull(); // 2 < 4: não entra
    engine.stopAll();
    expect(engine.activeCount()).toBe(0);
  });
});

describe("pacote padrão", () => {
  it("é o Gundam, e VITE_SIM_SFX_PACK=synth volta ao sintetizado", () => {
    expect(defaultSfxPack({})).toBe("gundam");
    expect(defaultSfxPack({ VITE_SIM_SFX_PACK: "synth" })).toBe("synth");
    expect(defaultSfxPack({ VITE_SIM_SFX_PACK: "outro" })).toBe("gundam");
  });
});
