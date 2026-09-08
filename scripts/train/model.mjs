/*
 * Arquitetura da policy-value net + I/O de disco (docs/50, Fase 0 §2).
 *
 * `@tensorflow/tfjs` puro NÃO tem os IOHandlers de filesystem (`file://`) —
 * isso é exclusivo do `@tensorflow/tfjs-node`. Como o pipeline precisa rodar
 * com o puro-JS, este módulo traz handlers mínimos de leitura/escrita em
 * disco (`nodeFileSaveIO` / `nodeFileLoadIO`) que funcionam com os dois
 * backends.
 */

import fs from "node:fs";
import path from "node:path";

/** Constrói a policy-value net. `arch` é uma string descritiva pro manifest. */
export function buildPolicyValueModel(tf, featureSize, actionSpace, hyper = {}) {
  const hiddenUnits = hyper.hiddenUnits ?? 128;
  const hiddenLayers = hyper.hiddenLayers ?? 2;
  const l2 = hyper.l2 ?? 1e-4;

  const input = tf.input({ shape: [featureSize], name: "features" });
  let x = input;
  for (let i = 0; i < hiddenLayers; i++) {
    x = tf.layers
      .dense({
        units: hiddenUnits,
        activation: "relu",
        kernelRegularizer: tf.regularizers.l2({ l2 }),
        name: `hidden_${i}`,
      })
      .apply(x);
  }
  const policy = tf.layers
    .dense({ units: actionSpace, activation: "softmax", name: "policy" })
    .apply(x);
  const value = tf.layers.dense({ units: 1, activation: "tanh", name: "value" }).apply(x);

  const model = tf.model({ inputs: input, outputs: [policy, value] });
  model.arch = `MLP ${featureSize} -> ${Array(hiddenLayers).fill(hiddenUnits).join(" -> ")} -> {policy ${actionSpace} softmax, value 1 tanh}`;
  return model;
}

/** IOHandler de escrita: grava `model.json` + `weights.bin` em `dir`. */
export function nodeFileSaveIO(dir) {
  return {
    async save(artifacts) {
      fs.mkdirSync(dir, { recursive: true });
      const weightData = Buffer.from(
        artifacts.weightData instanceof ArrayBuffer
          ? artifacts.weightData
          : artifacts.weightData.buffer.slice(
              artifacts.weightData.byteOffset,
              artifacts.weightData.byteOffset + artifacts.weightData.byteLength,
            ),
      );
      fs.writeFileSync(path.join(dir, "weights.bin"), weightData);
      const modelJSON = {
        modelTopology: artifacts.modelTopology,
        format: artifacts.format,
        generatedBy: artifacts.generatedBy,
        convertedBy: artifacts.convertedBy,
        weightsManifest: [{ paths: ["weights.bin"], weights: artifacts.weightSpecs }],
      };
      fs.writeFileSync(path.join(dir, "model.json"), JSON.stringify(modelJSON));
      return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: "JSON" } };
    },
  };
}

/** Lê os artifacts de `model.json` + `weights.bin` de `dir`. `null` se o dir não tem modelo. */
export function readModelArtifacts(dir) {
  const modelJsonPath = path.join(dir, "model.json");
  const weightsPath = path.join(dir, "weights.bin");
  if (!fs.existsSync(modelJsonPath) || !fs.existsSync(weightsPath)) return null;
  const modelJSON = JSON.parse(fs.readFileSync(modelJsonPath, "utf8"));
  const weightBuffer = fs.readFileSync(weightsPath);
  const weightSpecs = modelJSON.weightsManifest.flatMap((group) => group.weights);
  return {
    modelTopology: modelJSON.modelTopology,
    weightSpecs,
    weightData: weightBuffer.buffer.slice(
      weightBuffer.byteOffset,
      weightBuffer.byteOffset + weightBuffer.byteLength,
    ),
    format: modelJSON.format,
    generatedBy: modelJSON.generatedBy,
    convertedBy: modelJSON.convertedBy,
  };
}

/** IOHandler de leitura pra `tf.loadLayersModel` — envolve `readModelArtifacts`. */
export function nodeFileLoadIO(dir) {
  return {
    async load() {
      const artifacts = readModelArtifacts(dir);
      if (!artifacts) throw new Error(`sem modelo em ${dir}`);
      return artifacts;
    },
  };
}
