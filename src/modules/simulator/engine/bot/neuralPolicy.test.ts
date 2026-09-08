import { describe, expect, it } from "vitest";
import * as tf from "@tensorflow/tfjs";
import { createGame } from "../setup";
import { viewStateFor } from "../viewState";
import { actionOwner, enumerateLegalActions } from "../legalActions";
import { applyPlayerAction } from "../actions";
import { createRng } from "../rng";
import { buildSt01DeckList } from "../../fixtures/st01Deck";
import { buildSt03DeckList } from "../../fixtures/st03Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../../content/index";
import { ACTION_SPACE, FEATURE_SIZE } from "./features";
import { neuralPolicy, type NeuralModelArtifacts } from "./neuralPolicy";

const SPECS = ALL_EFFECT_SPECS;

async function captureArtifacts(inputSize: number): Promise<NeuralModelArtifacts> {
  const input = tf.input({ shape: [inputSize] });
  const hidden = tf.layers.dense({ units: 16, activation: "relu" }).apply(input) as tf.SymbolicTensor;
  const policy = tf.layers
    .dense({ units: ACTION_SPACE, activation: "softmax", name: "policy" })
    .apply(hidden) as tf.SymbolicTensor;
  const value = tf.layers.dense({ units: 1, activation: "tanh", name: "value" }).apply(hidden) as tf.SymbolicTensor;
  const model = tf.model({ inputs: input, outputs: [policy, value] });
  let captured: NeuralModelArtifacts | null = null;
  await model.save(
    tf.io.withSaveHandler(async (artifacts) => {
      captured = artifacts as unknown as NeuralModelArtifacts;
      return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: "JSON" } };
    }),
  );
  model.dispose();
  if (!captured) throw new Error("save handler não capturou artifacts");
  return captured;
}

/** Roda uma partida de self-play guiada por `choose`, checando que toda ação escolhida é legal. */
function playChecked(choose: (view: ReturnType<typeof viewStateFor>, legal: ReturnType<typeof enumerateLegalActions>, rng: () => number) => unknown) {
  let state = createGame(buildSt01DeckList(), buildSt03DeckList(), {
    seed: 3,
    firstPlayer: "A",
    interactiveMulligan: true,
  });
  const rng = createRng(99);
  let moves = 0;
  for (let step = 0; step < 400 && !state.gameOver; step++) {
    const owner = actionOwner(state);
    if (!owner) break;
    const legal = enumerateLegalActions(state, owner, SPECS, {
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });
    if (legal.length === 0) break;
    const chosen = choose(viewStateFor(state, owner), legal, rng);
    expect(legal).toContainEqual(chosen);
    state = applyPlayerAction(
      state,
      owner,
      chosen as (typeof legal)[number],
      SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    moves++;
  }
  return moves;
}

describe("neuralPolicy — fallback sem modelo", () => {
  it("sem modelDir/artifacts → usingFallback e escolhe ações legais", async () => {
    const policy = await neuralPolicy();
    expect(policy.usingFallback).toBe(true);
    const moves = playChecked((view, legal, rng) => policy.chooseAction(view, legal, rng));
    expect(moves).toBeGreaterThan(5);
    policy.dispose();
  });

  it("modelDir sem loadArtifacts → fallback (não faz I/O sozinho)", async () => {
    const policy = await neuralPolicy({ modelDir: "/nao/existe" });
    expect(policy.usingFallback).toBe(true);
    policy.dispose();
  });

  it("loadArtifacts que lança → fallback", async () => {
    const policy = await neuralPolicy({
      modelDir: "x",
      loadArtifacts: () => {
        throw new Error("disco falhou");
      },
    });
    expect(policy.usingFallback).toBe(true);
    policy.dispose();
  });

  it("modelo com input size incompatível → fallback", async () => {
    const artifacts = await captureArtifacts(FEATURE_SIZE - 3);
    const policy = await neuralPolicy({ artifacts });
    expect(policy.usingFallback).toBe(true);
    policy.dispose();
  });
});

describe("neuralPolicy — com modelo dummy (pesos aleatórios)", () => {
  it("carrega, roda a partida inteira e devolve sempre uma LegalAction legal", async () => {
    const artifacts = await captureArtifacts(FEATURE_SIZE);
    const policy = await neuralPolicy({ artifacts });
    expect(policy.usingFallback).toBe(false);
    const moves = playChecked((view, legal, rng) => policy.chooseAction(view, legal, rng));
    expect(moves).toBeGreaterThan(5);
    policy.dispose();
  });

  it("modo explore também devolve só ações legais", async () => {
    const artifacts = await captureArtifacts(FEATURE_SIZE);
    const policy = await neuralPolicy({ artifacts, explore: true });
    expect(policy.usingFallback).toBe(false);
    playChecked((view, legal, rng) => policy.chooseAction(view, legal, rng));
    policy.dispose();
  });
});
