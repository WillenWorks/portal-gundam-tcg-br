/* Sound Effects Táticos v2.0 — sintetizador sonoro Web Audio API procedural
 * Sons inspirados no universo Gundam / Mecha militar / TCG Sci-Fi:
 * - 100% livre de royalties e seguro para transmissões / vídeos em qualquer plataforma
 * - Zero lag de rede (áudio sintetizado localmente com resposta instantânea)
 * - Zero arquivos externos de mídia pesados
 */

class TacticalSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.5;

  constructor() {
    if (typeof window !== "undefined") {
      const storedEnabled = window.localStorage.getItem("asticassia:sfx:enabled");
      if (storedEnabled !== null) this.enabled = storedEnabled === "true";
      const storedVol = window.localStorage.getItem("asticassia:sfx:volume");
      if (storedVol !== null) this.volume = parseFloat(storedVol) || 0.5;
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("asticassia:sfx:enabled", String(enabled));
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (typeof window !== "undefined") {
      window.localStorage.setItem("asticassia:sfx:volume", String(this.volume));
    }
  }

  /** Buffer de ruído branco para efeitos de propulsão, explosões e vento de cartas */
  private createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /** Clique tático de comando / botão */
  public playClick() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(980, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.09 * this.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // AudioContext fallback
    }
  }

  /** Deploy de Mobile Suit no campo */
  public playDeploy() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(130, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.12);
      osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.24);
      gain.gain.setValueAtTime(0.18 * this.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch {
      // AudioContext fallback
    }
  }

  /** Disparo de feixe de combate (Attack Beam / Beam Rifle) */
  public playAttackBeam() {
    this.playBeamRifle();
  }

  /** Disparo clássico de Beam Rifle / Mega Canhão */
  public playBeamRifle() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Oscilador dente de serra com queda de frequência rápida
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(1450, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.22);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(450, now + 0.22);
      filter.Q.setValueAtTime(3.5, now);

      gain.gain.setValueAtTime(0.24 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // AudioContext fallback
    }
  }

  /** Golpe / Corte de Sabre de Feixe (Beam Saber Slash) */
  public playBeamSaberSlash() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Modulação de frequência de plasma + chiado
      const carrier = ctx.createOscillator();
      const modulator = ctx.createOscillator();
      const modGain = ctx.createGain();
      const mainGain = ctx.createGain();

      carrier.type = "sawtooth";
      carrier.frequency.setValueAtTime(650, now);
      carrier.frequency.exponentialRampToValueAtTime(180, now + 0.26);

      modulator.type = "sine";
      modulator.frequency.setValueAtTime(85, now);

      modGain.gain.setValueAtTime(150, now);
      modGain.gain.exponentialRampToValueAtTime(10, now + 0.26);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      mainGain.gain.setValueAtTime(0.22 * this.volume, now);
      mainGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      carrier.connect(mainGain);
      mainGain.connect(ctx.destination);

      carrier.start(now);
      modulator.start(now);
      carrier.stop(now + 0.26);
      modulator.stop(now + 0.26);
    } catch {
      // AudioContext fallback
    }
  }

  /** Trava de mira / Mono-eye Zaku alert (Monoeye sound + lock-on) */
  public playMonoeyeLock() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Efeito monoeye (rampa tonal grave-média)
      const eyeOsc = ctx.createOscillator();
      const eyeGain = ctx.createGain();
      eyeOsc.type = "triangle";
      eyeOsc.frequency.setValueAtTime(130, now);
      eyeOsc.frequency.exponentialRampToValueAtTime(360, now + 0.12);
      eyeGain.gain.setValueAtTime(0.18 * this.volume, now);
      eyeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      eyeOsc.connect(eyeGain);
      eyeGain.connect(ctx.destination);
      eyeOsc.start(now);
      eyeOsc.stop(now + 0.15);

      // Lock-on chirp agudo em seguida
      const lockOsc = ctx.createOscillator();
      const lockGain = ctx.createGain();
      lockOsc.type = "sine";
      lockOsc.frequency.setValueAtTime(1920, now + 0.13);
      lockOsc.frequency.setValueAtTime(2400, now + 0.19);
      lockGain.gain.setValueAtTime(0.14 * this.volume, now + 0.13);
      lockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      lockOsc.connect(lockGain);
      lockGain.connect(ctx.destination);
      lockOsc.start(now + 0.13);
      lockOsc.stop(now + 0.28);
    } catch {
      // AudioContext fallback
    }
  }

  /** Impulso de propulsores / Vernier Thruster Boost */
  public playThrusterBoost() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(ctx, 0.35);

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + 0.35);
      filter.Q.setValueAtTime(1.8, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.35);
    } catch {
      // AudioContext fallback
    }
  }

  /** Impacto e explosão de unidade destruída / ataque recebido */
  public playImpact() {
    this.playExplosion();
  }

  /** Explosão pesada (impacto em Base ou destruição de Mobile Suit) */
  public playExplosion() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Sub-grave
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.4);
      oscGain.gain.setValueAtTime(0.3 * this.volume, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.42);

      // Cauda de ruído de explosão
      const noise = ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(ctx, 0.45);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.45);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.26 * this.volume, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.45);
    } catch {
      // AudioContext fallback
    }
  }

  /** Impacto metálico de escudo / defesa de Blocker */
  public playShieldBlock() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [840, 1420, 2100].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.45, now + 0.28);
        gain.gain.setValueAtTime((0.18 / (i + 1)) * this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      });
    } catch {
      // AudioContext fallback
    }
  }

  /** Alerta tático de Newtype / Percepção Newtype */
  public playNewtypeFlash() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Arpejo cristalino ascendente Newtype
      [1320, 1760, 2200, 2640].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.045);
        gain.gain.setValueAtTime(0.13 * this.volume, now + i * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.045);
        osc.stop(now + i * 0.045 + 0.22);
      });
    } catch {
      // AudioContext fallback
    }
  }

  /** Destruição de escudo (Burst trigger) */
  public playShieldBurst() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(550, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.1);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.22 * this.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // AudioContext fallback
    }
  }

  /** Compra de carta / deslize de ar (Card Draw / Swoosh) */
  public playCardDraw() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(ctx, 0.22);

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(500, now + 0.2);
      filter.Q.setValueAtTime(2.2, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.2);
    } catch {
      // AudioContext fallback
    }
  }

  /** Virar carta para descansada (Rest / Servo mecânico) */
  public playCardRest() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);

      gain.gain.setValueAtTime(0.14 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // AudioContext fallback
    }
  }

  /** Alerta militar de início de turno / troca de fase */
  public playTurnStartAlert() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.12 * this.volume, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.12);
      });
    } catch {
      // AudioContext fallback
    }
  }
}

export const sfx = new TacticalSoundEngine();
