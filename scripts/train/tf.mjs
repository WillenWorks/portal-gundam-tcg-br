/*
 * Carregador do TensorFlow.js para o pipeline de treino (docs/50, Fase 0 §1).
 *
 * Tenta o backend nativo (`@tensorflow/tfjs-node`, ~5-15x mais rápido) e cai
 * no puro-JS (`@tensorflow/tfjs`, backend `cpu`) se o nativo não estiver
 * instalado. Neste ambiente (Windows sem toolchain C++) o nativo NÃO instala —
 * ver docs/50. Force um backend com `SIM_TRAINER_TF_BACKEND=node|js`.
 */

const preference = process.env.SIM_TRAINER_TF_BACKEND ?? "auto";

async function tryNode() {
  const mod = await import("@tensorflow/tfjs-node");
  return { tf: mod.default ?? mod, backend: "tensorflow (native)" };
}

async function tryJs() {
  const mod = await import("@tensorflow/tfjs");
  const tf = mod.default ?? mod;
  await tf.setBackend("cpu");
  await tf.ready();
  return { tf, backend: "cpu (pure-js)" };
}

let loaded = null;

export async function loadTf() {
  if (loaded) return loaded;
  if (preference === "node") {
    loaded = await tryNode();
  } else if (preference === "js") {
    loaded = await tryJs();
  } else {
    try {
      loaded = await tryNode();
    } catch {
      loaded = await tryJs();
    }
  }
  return loaded;
}
