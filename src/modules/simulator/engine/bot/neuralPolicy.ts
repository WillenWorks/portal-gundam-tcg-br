import type * as TF from "@tensorflow/tfjs";
import type { ViewGameState } from "../viewState";
import type { LegalAction } from "../legalActions";
import type { Rng } from "../rng";
import { heuristicPolicy, type HeuristicLevel } from "./heuristicPolicy";
import { ACTION_SPACE, FEATURE_SIZE, decodeActionIndex, encodeAction, extractFeatures } from "./features";

/**
 * Policy neural (docs/50, Fase 0 §2/§4). `neuralPolicy({ modelDir })` devolve
 * um handle com `chooseAction(view, legal, rng)` que featuriza a view, roda a
 * policy-value net, mascara ações ilegais e escolhe a de maior probabilidade
 * (ou amostra com o `rng` se `explore`).
 *
 * NUNCA quebra: sem `modelDir` / sem modelo válido / erro de inferência ⇒ cai
 * em `heuristicPolicy({ level: fallbackLevel })`. Cai também quando o bucket
 * escolhido pela rede não tem nenhuma ação legal correspondente.
 *
 * Este arquivo é *bundle-safe*: nenhum import estático de `@tensorflow/tfjs`
 * (só `import type`, apagado na compilação) nem de `node:*`. O `tf` é
 * carregado por `import()` dinâmico só quando há um modelo; a LEITURA dos
 * pesos do disco é responsabilidade de quem chama (um `.mjs` Node passa
 * `artifacts` já lidos, ou um `loadArtifacts`).
 */

export interface NeuralModelArtifacts {
  modelTopology: unknown;
  weightSpecs: unknown[];
  weightData: ArrayBuffer;
  format?: string;
  generatedBy?: string;
  convertedBy?: string;
}

export interface NeuralManifest {
  createdAt: string;
  featureSize: number;
  actionSpace: number;
  arch: string;
  epochs: number;
  samples: number;
  finalLoss?: number;
  policyAccuracy?: number;
  valueMae?: number;
  tfBackend?: string;
}

export interface NeuralPolicyOptions {
  /** Diretório do modelo — passado a `loadArtifacts`. Sem `loadArtifacts` não faz I/O sozinho. */
  modelDir?: string;
  /** Artifacts já lidos (topology + weightSpecs + weightData). Tem precedência sobre `modelDir`. */
  artifacts?: NeuralModelArtifacts | null;
  /** Lê os artifacts de `modelDir` (o consumidor Node injeta um leitor de filesystem). */
  loadArtifacts?: (modelDir: string) => Promise<NeuralModelArtifacts | null> | NeuralModelArtifacts | null;
  /** Nível do `heuristicPolicy` usado como fallback. Default `"normal"`. */
  fallbackLevel?: HeuristicLevel;
  /** `true` = amostra o bucket proporcional à probabilidade (exploração). Default `false` (argmax). */
  explore?: boolean;
}

export interface NeuralPolicyHandle {
  chooseAction(view: ViewGameState, legal: LegalAction[], rng: Rng): LegalAction;
  /** `true` se está rodando pela heurística (sem modelo válido). */
  readonly usingFallback: boolean;
  dispose(): void;
}

function fallbackHandle(level: HeuristicLevel): NeuralPolicyHandle {
  const heuristic = heuristicPolicy({ level });
  return {
    chooseAction: (view, legal, rng) => heuristic(view, legal, rng),
    usingFallback: true,
    dispose: () => {},
  };
}

async function resolveArtifacts(options: NeuralPolicyOptions): Promise<NeuralModelArtifacts | null> {
  if (options.artifacts) return options.artifacts;
  if (options.modelDir && options.loadArtifacts) {
    try {
      return (await options.loadArtifacts(options.modelDir)) ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function neuralPolicy(options: NeuralPolicyOptions = {}): Promise<NeuralPolicyHandle> {
  const level = options.fallbackLevel ?? "normal";
  const fallback = fallbackHandle(level);

  const artifacts = await resolveArtifacts(options);
  if (!artifacts) return fallback;

  let tf: typeof TF;
  let model: TF.LayersModel;
  try {
    tf = await import("@tensorflow/tfjs");
    model = await tf.loadLayersModel(tf.io.fromMemory(artifacts as unknown as TF.io.ModelArtifacts));
    const inShape = model.inputs[0].shape;
    const inSize = inShape[inShape.length - 1];
    if (inSize !== FEATURE_SIZE) {
      throw new Error(`modelo espera input ${inSize}, features.ts produz ${FEATURE_SIZE}`);
    }
  } catch {
    return fallback;
  }

  const heuristic = heuristicPolicy({ level });

  function predictPolicy(view: ViewGameState): Float32Array | null {
    try {
      const feats = extractFeatures(view, view.viewer);
      const input = tf.tensor2d(feats, [1, FEATURE_SIZE]);
      const out = model.predict(input) as TF.Tensor | TF.Tensor[];
      const tensors = Array.isArray(out) ? out : [out];
      const policyTensor = tensors[0];
      const probs = policyTensor.dataSync() as Float32Array;
      tf.dispose([input, ...tensors]);
      return probs.length >= ACTION_SPACE ? probs : null;
    } catch {
      return null;
    }
  }

  function chooseAction(view: ViewGameState, legal: LegalAction[], rng: Rng): LegalAction {
    if (legal.length === 0) return heuristic(view, legal, rng);
    if (legal.length === 1) return legal[0];

    const probs = predictPolicy(view);
    if (!probs) return heuristic(view, legal, rng);

    const bucketsSeen = new Set<number>();
    for (const action of legal) bucketsSeen.add(encodeAction(action, view));
    const buckets = [...bucketsSeen];

    let chosenBucket: number;
    if (options.explore) {
      const weights = buckets.map((b) => Math.max(1e-6, probs[b] ?? 0));
      const total = weights.reduce((sum, w) => sum + w, 0);
      let r = rng() * total;
      chosenBucket = buckets[buckets.length - 1];
      for (let i = 0; i < buckets.length; i++) {
        r -= weights[i];
        if (r <= 0) {
          chosenBucket = buckets[i];
          break;
        }
      }
    } else {
      chosenBucket = buckets[0];
      for (const b of buckets) {
        if ((probs[b] ?? 0) > (probs[chosenBucket] ?? 0)) chosenBucket = b;
      }
    }

    const decoded = decodeActionIndex(chosenBucket, legal, view, rng);
    return decoded ?? heuristic(view, legal, rng);
  }

  return {
    chooseAction,
    usingFallback: false,
    dispose: () => model.dispose(),
  };
}
