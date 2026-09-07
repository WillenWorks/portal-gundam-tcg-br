/*
 * train:fit — treina a policy-value net a partir de um dataset de self-play
 * (docs/50, Fase 0 §2). Exporta pesos versionados + `manifest.json`.
 *
 * Uso:
 *   pnpm train:fit --data=services/sim-trainer/data/<sha>.jsonl
 *   pnpm train:fit --data=<path> --epochs=40 --out=services/sim-trainer/models/<sha>
 *   pnpm train:fit --data=<path> --epochs=5 --batch=128 --lr=0.001
 *
 * Backend: `@tensorflow/tfjs` puro-JS neste ambiente (ver docs/50). Force o
 * nativo com `SIM_TRAINER_TF_BACKEND=node`.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import process from "node:process";

import { ENGINE_ROOT, FEATURE_SIZE, ACTION_SPACE } from "./engine.mjs";
import { loadTf } from "./tf.mjs";
import { buildPolicyValueModel, nodeFileSaveIO } from "./model.mjs";

// --- Hiperparâmetros (sem mágica — tudo aqui, comentado) --------------------
const HYPER = {
  epochs: 20, // --epochs
  batchSize: 64, // --batch
  learningRate: 1e-3, // --lr
  validationSplit: 0.1, // fração do dataset usada só pra métrica de validação
  hiddenUnits: 128, // largura das camadas densas do corpo
  hiddenLayers: 2, // profundidade do corpo
  l2: 1e-4, // regularização L2 dos kernels densos
  policyLossWeight: 1.0, // peso da perda da cabeça policy
  valueLossWeight: 1.0, // peso da perda da cabeça value
};

function parseArgs(argv) {
  const args = { data: null, out: null, epochs: HYPER.epochs, batch: HYPER.batchSize, lr: HYPER.learningRate };
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "data") args.data = v;
    else if (k === "out") args.out = v;
    else if (k === "epochs") args.epochs = Number(v);
    else if (k === "batch") args.batch = Number(v);
    else if (k === "lr") args.lr = Number(v);
  }
  return args;
}

function readDataset(absPath) {
  const lines = fs.readFileSync(absPath, "utf8").split("\n").filter((l) => l.trim().length > 0);
  const features = [];
  const policyOneHot = [];
  const values = [];
  for (const line of lines) {
    const row = JSON.parse(line);
    if (!Array.isArray(row.features) || row.features.length !== FEATURE_SIZE) continue;
    features.push(row.features);
    const oneHot = new Array(ACTION_SPACE).fill(0);
    if (row.actionIndex >= 0 && row.actionIndex < ACTION_SPACE) oneHot[row.actionIndex] = 1;
    policyOneHot.push(oneHot);
    values.push([Math.max(-1, Math.min(1, row.outcome ?? 0))]);
  }
  return { features, policyOneHot, values, count: features.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.data) {
    console.error("[train:fit] faltou --data=<path do .jsonl>");
    process.exit(2);
  }
  const dataPath = path.resolve(ENGINE_ROOT, args.data);
  if (!fs.existsSync(dataPath)) {
    console.error(`[train:fit] dataset não encontrado: ${dataPath}`);
    process.exit(2);
  }

  const { tf, backend } = await loadTf();
  console.log(`[train:fit] backend tfjs: ${backend}`);

  const data = readDataset(dataPath);
  if (data.count < 10) {
    console.error(`[train:fit] dataset com só ${data.count} amostras — insuficiente`);
    process.exit(2);
  }
  console.log(`[train:fit] ${data.count} amostras | epochs ${args.epochs} | batch ${args.batch} | lr ${args.lr}`);

  const xs = tf.tensor2d(data.features, [data.count, FEATURE_SIZE]);
  const policyY = tf.tensor2d(data.policyOneHot, [data.count, ACTION_SPACE]);
  const valueY = tf.tensor2d(data.values, [data.count, 1]);

  const model = buildPolicyValueModel(tf, FEATURE_SIZE, ACTION_SPACE, HYPER);
  model.compile({
    optimizer: tf.train.adam(args.lr),
    loss: ["categoricalCrossentropy", "meanSquaredError"],
    lossWeights: [HYPER.policyLossWeight, HYPER.valueLossWeight],
  });

  const history = await model.fit(xs, [policyY, valueY], {
    epochs: args.epochs,
    batchSize: args.batch,
    validationSplit: HYPER.validationSplit,
    shuffle: true,
    verbose: 0,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(
          `[train:fit]   epoch ${epoch + 1}/${args.epochs} loss ${logs.loss?.toFixed(4)} val_loss ${logs.val_loss?.toFixed(4)}`,
        );
      },
    },
  });

  // métricas manuais na fatia de validação (últimos N)
  const valCount = Math.max(1, Math.floor(data.count * HYPER.validationSplit));
  const valXs = xs.slice([data.count - valCount, 0], [valCount, FEATURE_SIZE]);
  const [valPolicy, valValue] = model.predict(valXs);
  const predIdx = valPolicy.argMax(1).arraySync();
  const trueIdx = data.policyOneHot.slice(data.count - valCount).map((row) => row.indexOf(1));
  const policyAccuracy = predIdx.filter((p, i) => p === trueIdx[i]).length / valCount;
  const predVal = valValue.squeeze().arraySync();
  const trueVal = data.values.slice(data.count - valCount).map((v) => v[0]);
  const valueMae = predVal.reduce((sum, p, i) => sum + Math.abs(p - trueVal[i]), 0) / valCount;
  tf.dispose([valXs, valPolicy, valValue]);

  const finalLoss = history.history.loss?.at(-1) ?? null;

  const configHash = createHash("sha1")
    .update(JSON.stringify({ data: path.basename(dataPath), epochs: args.epochs, HYPER, FEATURE_SIZE, ACTION_SPACE }))
    .digest("hex")
    .slice(0, 12);
  const outDir = args.out
    ? path.resolve(ENGINE_ROOT, args.out)
    : path.join(ENGINE_ROOT, "services/sim-trainer/models", configHash);
  fs.mkdirSync(outDir, { recursive: true });

  await model.save(nodeFileSaveIO(outDir));

  const manifest = {
    createdAt: new Date().toISOString(),
    featureSize: FEATURE_SIZE,
    actionSpace: ACTION_SPACE,
    arch: model.arch,
    hyper: HYPER,
    epochs: args.epochs,
    samples: data.count,
    dataset: path.basename(dataPath),
    finalLoss,
    policyAccuracy,
    valueMae,
    tfBackend: backend,
  };
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  tf.dispose([xs, policyY, valueY]);

  console.log(
    `[train:fit] policyAcc ${(policyAccuracy * 100).toFixed(1)}% | valueMae ${valueMae.toFixed(3)}`,
  );
  console.log(`[train:fit] -> ${path.relative(ENGINE_ROOT, outDir)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
