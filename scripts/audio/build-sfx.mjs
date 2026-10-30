#!/usr/bin/env node
/* Prepara o pacote de sons do simulador: `sons/` (bruto, fora do git) → `public/sfx/*.m4a` + o catálogo gerado
 * `src/modules/simulator/audio/sfxAssets.generated.ts` (duração e ponto de impacto de cada arquivo).
 *
 * Por arquivo: corta o silêncio das pontas, iguala o volume (loudnorm -16 LUFS), mono 44.1 kHz, corta em `maxMs`,
 * fade de saída, AAC 96 kbps. O ponto de impacto é o primeiro trecho de 10 ms que chega a 70% do pico de energia —
 * o simulador alinha esse ponto ao instante em que a ação acontece na tela (o golpe acerta, a carta pousa).
 *
 * Uso: pnpm sfx:build   (ffmpeg no PATH ou em FFMPEG_PATH) */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCES_DIR = path.join(ROOT, "sons");
const OUT_DIR = path.join(ROOT, "public", "sfx");
const GENERATED = path.join(ROOT, "src", "modules", "simulator", "audio", "sfxAssets.generated.ts");
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

const SAMPLE_RATE = 44100;
const WINDOW_MS = 10;
const IMPACT_RATIO = 0.7;
const FADE_OUT_MS = 60;
const BITRATE = "96k";

export function fileNameFor(id, index) {
  return `${id.replace(/\./g, "-").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}-${index + 1}.m4a`;
}

/** primeiro trecho de `WINDOW_MS` cuja energia (RMS) chega a `IMPACT_RATIO` do trecho mais forte */
export function impactMsOf(samples, sampleRate = SAMPLE_RATE) {
  const size = Math.max(1, Math.round((sampleRate * WINDOW_MS) / 1000));
  const rms = [];
  for (let start = 0; start < samples.length; start += size) {
    let sum = 0;
    const end = Math.min(samples.length, start + size);
    for (let i = start; i < end; i++) sum += samples[i] * samples[i];
    rms.push(Math.sqrt(sum / (end - start)));
  }
  const peak = Math.max(0, ...rms);
  if (peak === 0) return 0;
  const first = rms.findIndex((v) => v >= peak * IMPACT_RATIO);
  return first * WINDOW_MS;
}

/** corta em `maxMs` e aplica o fade de saída (no lugar) */
export function shape(samples, maxMs, sampleRate = SAMPLE_RATE) {
  const cut = samples.subarray(0, Math.min(samples.length, Math.round((sampleRate * maxMs) / 1000)));
  const fade = Math.min(cut.length, Math.round((sampleRate * FADE_OUT_MS) / 1000));
  for (let i = 0; i < fade; i++) cut[cut.length - fade + i] *= 1 - (i + 1) / fade;
  return cut;
}

function ffmpeg(args, input) {
  const run = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", ...args], { input, maxBuffer: 1 << 28 });
  if (run.error) throw new Error(`ffmpeg não encontrado (${FFMPEG}) — instale ou defina FFMPEG_PATH: ${run.error.message}`);
  if (run.status !== 0) throw new Error(`ffmpeg falhou: ${run.stderr.toString()}`);
  return run.stdout;
}

function decode(file) {
  const filters = [
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.01",
    "areverse",
    "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02",
    "areverse",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
  ].join(",");
  const raw = ffmpeg(["-i", file, "-af", filters, "-ac", "1", "-ar", String(SAMPLE_RATE), "-f", "f32le", "pipe:1"]);
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4).slice();
}

function encode(samples, outFile) {
  const pcm = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  ffmpeg(["-y", "-f", "f32le", "-ar", String(SAMPLE_RATE), "-ac", "1", "-i", "pipe:0", "-c:a", "aac", "-b:a", BITRATE, "-movflags", "+faststart", outFile], pcm);
}

function main() {
  const { sounds } = JSON.parse(readFileSync(path.join(ROOT, "scripts", "audio", "sfx-sources.json"), "utf8"));
  if (!existsSync(SOURCES_DIR)) throw new Error(`pasta de origem não encontrada: ${SOURCES_DIR}`);
  mkdirSync(OUT_DIR, { recursive: true });
  for (const old of readdirSync(OUT_DIR)) if (old.endsWith(".m4a")) rmSync(path.join(OUT_DIR, old));

  const assets = {};
  for (const [id, { maxMs, sources }] of Object.entries(sounds)) {
    assets[id] = sources.map((source, index) => {
      const samples = shape(decode(path.join(SOURCES_DIR, source)), maxMs);
      const name = fileNameFor(id, index);
      encode(samples, path.join(OUT_DIR, name));
      const asset = { src: `sfx/${name}`, durationMs: Math.round((samples.length / SAMPLE_RATE) * 1000), impactMs: impactMsOf(samples) };
      console.log(`${id.padEnd(18)} ${name.padEnd(26)} ${String(asset.durationMs).padStart(5)} ms  impacto ${asset.impactMs} ms`);
      return asset;
    });
  }

  const body = Object.entries(assets)
    .map(([id, list]) => `  ${JSON.stringify(id)}: [\n${list.map((a) => `    { src: ${JSON.stringify(a.src)}, durationMs: ${a.durationMs}, impactMs: ${a.impactMs} },`).join("\n")}\n  ],`)
    .join("\n");
  writeFileSync(
    GENERATED,
    `/* GERADO por scripts/audio/build-sfx.mjs — não editar à mão (pnpm sfx:build) */\nimport type { SfxAsset } from "./sfxTypes";\n\nexport const SFX_ASSETS = {\n${body}\n} as const satisfies Record<string, readonly SfxAsset[]>;\n`,
  );
  console.log(`\n${Object.values(assets).flat().length} arquivos em public/sfx`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
