// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CardInstance, PendingDecision } from "@/modules/simulator/engine/types";
import type { ArtLookup } from "./cardArt";
import {
  AbilityResolutionModal,
  pickSecondaryTarget,
  pickSingleTarget,
  toggleMultiTarget,
  usesBoardTargetingForPrimary,
  usesBoardTargetingForSecondary,
  resolveTriggerModalHeader,
} from "./AbilityResolutionModal";
import { createGame } from "@/modules/simulator/engine/setup";
import { advanceToMainPhase } from "@/modules/simulator/engine/phases";
import { deployCard } from "@/modules/simulator/engine/deploy";
import { viewStateFor } from "@/modules/simulator/engine/viewState";
import { placeCard } from "@/modules/simulator/engine/__testkit__/cardHarness";
import { buildSt02DeckList } from "@/modules/simulator/fixtures/st02Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "@/modules/simulator/content";
import { GD01_CARD_DEFS } from "@/modules/simulator/content/gd01";

afterEach(cleanup);

type AR = Extract<PendingDecision, { kind: "abilityResolution" }>;
type ResolveArgs = Array<{
  specId: string;
  activate: boolean;
  targetIds: string[];
  secondaryTargetIds?: string[];
  trashExileIds?: string[];
}>;

// V0 (docs/25): as opções já vêm prontas em `legalTargets` (calculadas no
// servidor) — o teste só precisa de um `resolveLabel` fixo pra mapear id -> nome.
const LABELS: Record<string, string> = { e1: "Zaku II", e2: "Guncannon", r1: "Recurso 1 (gasto)" };
const resolveLabel = (id: string) => LABELS[id] ?? id;

/** "Nova leva de correções" (item 4, plano v2) — o modal agora é CONTROLADO
 * (`targets`/`secondaryTargets`/`activate` vêm de fora, igual em produção onde
 * quem escreve neles é o clique no tabuleiro). Este harness monta o estado
 * localmente com `useState`, igual `SimulatorMatchPage.tsx` faz de verdade —
 * e, pros itens de alvo em Unit (que não têm mais pills aqui dentro), expõe
 * botões de teste equivalentes ao clique na `BattleSlot` real, chamando as
 * MESMAS funções puras exportadas (`pickSingleTarget`/`toggleMultiTarget`/
 * `pickSecondaryTarget`) que o clique no tabuleiro chamaria. */
function Harness({
  decision,
  resolveLabel: resolveLabelProp,
  resolveHandLabel,
  busy,
  onResolve,
  devTrashCount,
  art,
}: {
  decision: AR;
  resolveLabel?: (id: string) => string;
  resolveHandLabel?: (id: string) => string;
  busy?: boolean;
  onResolve: (resolutions: ResolveArgs) => void;
  devTrashCount?: number;
  art?: ArtLookup;
}) {
  const resolveLabelFn = resolveLabelProp ?? resolveLabel;
  const [targets, setTargets] = useState<Record<string, string[]>>({});
  const [secondaryTargets, setSecondaryTargets] = useState<Record<string, string[]>>({});
  const [activate, setActivate] = useState<Record<string, boolean>>(
    Object.fromEntries(decision.queue.map((q) => [q.specId, true])),
  );

  return (
    <>
      {decision.queue.map((q) => (
        <div key={q.specId}>
          {usesBoardTargetingForPrimary(q)
            ? q.legalTargets.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-label={`[tabuleiro] ${resolveLabelFn(id)}`}
                  onClick={() =>
                    setTargets((s) =>
                      q.targetCount && q.targetCount.max > 1
                        ? toggleMultiTarget(s, q.specId, id, q.targetCount.max)
                        : pickSingleTarget(s, q.specId, id),
                    )
                  }
                >
                  [tabuleiro] {resolveLabelFn(id)}
                </button>
              ))
            : null}
          {usesBoardTargetingForSecondary(q)
            ? q.secondaryTarget!.legalTargets.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-label={`[tabuleiro 2º] ${resolveLabelFn(id)}`}
                  onClick={() => setSecondaryTargets((s) => pickSecondaryTarget(s, q.specId, id))}
                >
                  [tabuleiro 2º] {resolveLabelFn(id)}
                </button>
              ))
            : null}
        </div>
      ))}
      <AbilityResolutionModal
        decision={decision}
        resolveLabel={resolveLabelFn}
        resolveHandLabel={resolveHandLabel}
        busy={busy}
        targets={targets}
        setTargets={setTargets}
        secondaryTargets={secondaryTargets}
        setSecondaryTargets={setSecondaryTargets}
        activate={activate}
        setActivate={setActivate}
        onResolve={onResolve}
        devTrashCount={devTrashCount}
        art={art}
      />
    </>
  );
}

const whenPaired: AR = {
  kind: "abilityResolution",
  trigger: "When Paired",
  queue: [
    {
      sourceInstanceId: "p1",
      specId: "ST01-010-WhenPaired",
      label: "Choose 1 enemy Unit. Rest it.",
      optional: false,
      needsTarget: true,
      targetScope: "enemyUnit",
      legalTargets: ["e1", "e2"],
    },
  ],
};

describe("AbilityResolutionModal", () => {
  it("mandatório + alvo em Unit (enemyUnit): pills presentes na modal e glow no tabuleiro; confirma após seleção no tabuleiro", () => {
    const onResolve = vi.fn();
    render(<Harness decision={whenPaired} onResolve={onResolve} />);
    expect(screen.getByRole("button", { name: "Guncannon" })).toBeInTheDocument();
    expect(screen.getByText(/Selecione no tabuleiro/)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "[tabuleiro] Guncannon" }));
    fireEvent.click(confirm);
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST01-010-WhenPaired", activate: true, targetIds: ["e2"] }]);
  });

  it("mandatório + alvo em Unit (enemyUnit): clicar na pill dentro da modal também seleciona o alvo", () => {
    const onResolve = vi.fn();
    render(<Harness decision={whenPaired} onResolve={onResolve} />);
    const guncannonPill = screen.getByRole("button", { name: "Guncannon" });
    fireEvent.click(guncannonPill);
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST01-010-WhenPaired", activate: true, targetIds: ["e2"] }]);
  });

  it("sem alvo legal (legalTargets vazio): confirma direto (efeito não faz nada)", () => {
    const noLegalTarget: AR = { ...whenPaired, queue: [{ ...whenPaired.queue[0], legalTargets: [] }] };
    const onResolve = vi.fn();
    render(<Harness decision={noLegalTarget} onResolve={onResolve} />);
    expect(screen.getByText(/Nenhum alvo legal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST01-010-WhenPaired", activate: true, targetIds: [] }]);
  });

  it("docs/47 Fase 5 — secondaryTarget (ST05-010 Mikazuki Augus): 2 pools em Unit, disponíveis via tabuleiro e pills; exige os 2 antes de confirmar", () => {
    const mikazuki: AR = {
      kind: "abilityResolution",
      trigger: "When Paired",
      queue: [
        {
          sourceInstanceId: "p1",
          specId: "ST05-010-WhenPaired",
          label: "Choose 1 of your Units and 1 enemy Unit. Deal 1 damage to them.",
          optional: false,
          needsTarget: true,
          targetScope: "friendlyUnit",
          legalTargets: ["r1"],
          secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit", legalTargets: ["e1", "e2"] },
        },
      ],
    };
    const onResolve = vi.fn();
    render(<Harness decision={mikazuki} onResolve={onResolve} />);
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeDisabled();
    // ambos os pools (aliado e inimigo) são Unit — pills visíveis e hints com as 2 cores.
    expect(screen.getByRole("button", { name: "Recurso 1 (gasto)" })).toBeInTheDocument();
    expect(screen.getAllByText(/aliado/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/inimigo/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "[tabuleiro] Recurso 1 (gasto)" }));
    expect(confirm).toBeDisabled(); // ainda falta o 2º alvo

    fireEvent.click(screen.getByRole("button", { name: "[tabuleiro 2º] Guncannon" }));
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onResolve).toHaveBeenCalledWith([
      { specId: "ST05-010-WhenPaired", activate: true, targetIds: ["r1"], secondaryTargetIds: ["e2"] },
    ]);
  });

  it("docs/47 Fase 5 — secondaryTarget sem alvo legal: confirma sem escolher (secondaryTargetIds vazio)", () => {
    const mikazukiNoEnemy: AR = {
      kind: "abilityResolution",
      trigger: "When Paired",
      queue: [
        {
          sourceInstanceId: "p1",
          specId: "ST05-010-WhenPaired",
          label: "Choose 1 of your Units and 1 enemy Unit. Deal 1 damage to them.",
          optional: false,
          needsTarget: true,
          targetScope: "friendlyUnit",
          legalTargets: ["r1"],
          secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit", legalTargets: [] },
        },
      ],
    };
    const onResolve = vi.fn();
    render(<Harness decision={mikazukiNoEnemy} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole("button", { name: "[tabuleiro] Recurso 1 (gasto)" }));
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onResolve).toHaveBeenCalledWith([
      { specId: "ST05-010-WhenPaired", activate: true, targetIds: ["r1"], secondaryTargetIds: [] },
    ]);
  });

  it("Attack + ownResource: NÃO é Unit — continua com pills aqui dentro (Recurso não tem glow no tabuleiro ainda)", () => {
    const attack: AR = {
      kind: "abilityResolution",
      trigger: "Attack",
      queue: [
        {
          sourceInstanceId: "s1",
          specId: "ST01-011-Attack",
          label: "Choose 1 of your Resources. Set it as active.",
          optional: false,
          needsTarget: true,
          targetScope: "ownResource",
          legalTargets: ["r1"],
        },
      ],
    };
    const onResolve = vi.fn();
    render(<Harness decision={attack} onResolve={onResolve} />);
    expect(screen.getByText(/【Attack】/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recurso 1 (gasto)" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST01-011-Attack", activate: true, targetIds: ["r1"] }]);
  });

  const handChoiceDecision: AR = {
    kind: "abilityResolution",
    trigger: "When Paired",
    queue: [
      {
        sourceInstanceId: "ff1",
        specId: "ST03-010-WhenPaired",
        label: "You may deploy 1 (Neo Zeon)/(Zeon) Unit card Lv.4 or lower from your hand.",
        optional: true,
        needsTarget: false,
        targetScope: "enemyUnit",
        legalTargets: [],
        handChoice: { legalHandIds: ["h1", "h2"], label: "deploy from hand" },
      },
    ],
  };

  it("handChoice (Full Frontal): escolhe carta da mão e envia como targetIds", () => {
    const onResolve = vi.fn();
    render(
      <Harness
        decision={handChoiceDecision}
        resolveHandLabel={(id) => ({ h1: "Geara Zulu", h2: "Dra-C" })[id] ?? id}
        onResolve={onResolve}
      />,
    );
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Geara Zulu" }));
    fireEvent.click(confirm);
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST03-010-WhenPaired", activate: true, targetIds: ["h1"] }]);
  });

  it("handChoice (Full Frontal): 'Pular' → activate false, sem carta", () => {
    const onResolve = vi.fn();
    render(<Harness decision={handChoiceDecision} resolveHandLabel={(id) => id} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST03-010-WhenPaired", activate: false, targetIds: [] }]);
  });

  function fakeCard(instanceId: string, nameEn: string, cardType: CardInstance["def"]["cardType"]): CardInstance {
    return {
      instanceId,
      owner: "A",
      zone: "deck",
      rested: false,
      damage: 0,
      statModifiers: [],
      keywordGrants: [],
      usedKeywordsThisTurn: [],
      enteredZoneOnTurn: 0,
      def: { code: instanceId, nameEn, cardType, color: "green" },
    };
  }

  const deckRevealDecision: AR = {
    kind: "abilityResolution",
    trigger: "Destroyed",
    queue: [
      {
        sourceInstanceId: "z1",
        specId: "ST03-006-Destroyed",
        label: "Look at the top 3 cards of your deck. You may reveal 1 ...",
        optional: true,
        needsTarget: false,
        targetScope: "enemyUnit",
        legalTargets: [],
        deckTopReveal: {
          count: 3,
          topCards: [fakeCard("t1", "Zaku I", "UNIT"), fakeCard("t2", "Indignation", "COMMAND"), fakeCard("t3", "Dra-C", "UNIT")],
          revealableIds: ["t1", "t3"],
          label: "reveal from deck top",
        },
      },
    ],
  };

  it("deckTopReveal (Char's Zaku Ⅱ): sem Ativar/Pular; revela 1 Unit e envia", () => {
    const onResolve = vi.fn();
    render(<Harness decision={deckRevealDecision} onResolve={onResolve} />);
    expect(screen.queryByRole("button", { name: "Pular" })).not.toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeEnabled(); // "revelar 1 ou nenhuma" é sempre válido
    expect(screen.getByRole("button", { name: /Indignation/ })).toBeDisabled(); // Command não é revelável
    fireEvent.click(screen.getByRole("button", { name: "Zaku I" }));
    fireEvent.click(confirm);
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST03-006-Destroyed", activate: true, targetIds: ["t1"] }]);
  });

  it("deckTopReveal (Char's Zaku Ⅱ): 'Não revelar' → targetIds vazio, activate true", () => {
    const onResolve = vi.fn();
    render(<Harness decision={deckRevealDecision} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole("button", { name: "Não revelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST03-006-Destroyed", activate: true, targetIds: [] }]);
  });

  it("handDiscard (ST04-002): escolhe 1 carta da mão → targetIds", () => {
    const dec: AR = {
      kind: "abilityResolution",
      trigger: "Deploy",
      queue: [
        {
          sourceInstanceId: "u1",
          specId: "ST04-002-Deploy",
          label: "Draw 1. Then, discard 1.",
          optional: false,
          needsTarget: false,
          targetScope: "enemyUnit",
          legalTargets: [],
          handDiscard: { n: 1, legalHandIds: ["h1", "h2"], label: "Draw 1. Then, discard 1." },
        },
      ],
    };
    const onResolve = vi.fn();
    render(<Harness decision={dec} resolveHandLabel={(id) => (id === "h1" ? "Ginn" : "Aegis")} onResolve={onResolve} />);
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Aegis" }));
    fireEvent.click(confirm);
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST04-002-Deploy", activate: true, targetIds: ["h2"] }]);
  });

  it("deckReorder (ST02-015): atribui topo/fundo → targetIds na ordem dos slots", () => {
    const c = (id: string, name: string): CardInstance =>
      ({ instanceId: id, def: { code: id, nameEn: name, cardType: "UNIT", color: "blue" }, owner: "A", zone: "deck", rested: false, damage: 0, statModifiers: [], keywordGrants: [], usedKeywordsThisTurn: [], enteredZoneOnTurn: 0 }) as CardInstance;
    const dec: AR = {
      kind: "abilityResolution",
      trigger: "Deploy",
      queue: [
        {
          sourceInstanceId: "b1",
          specId: "ST02-015-Deploy",
          label: "look at the top 2 ...",
          optional: false,
          needsTarget: false,
          targetScope: "enemyUnit",
          legalTargets: [],
          deckReorder: {
            topCards: [c("d1", "Wing"), c("d2", "Leo")],
            slots: [
              { name: "toTop", position: "top" },
              { name: "toBottom", position: "bottom" },
            ],
            label: "look at the top 2 ...",
          },
        },
      ],
    };
    const onResolve = vi.fn();
    render(<Harness decision={dec} onResolve={onResolve} />);
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeDisabled();
    // Leo → topo, Wing → fundo
    const topBtns = screen.getAllByRole("button", { name: "↑ topo" });
    const bottomBtns = screen.getAllByRole("button", { name: "↓ fundo" });
    fireEvent.click(topBtns[1]); // linha do Leo
    fireEvent.click(bottomBtns[0]); // linha do Wing
    fireEvent.click(confirm);
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST02-015-Deploy", activate: true, targetIds: ["d2", "d1"] }]);
  });

  it("enumChoice (ST04-012): escolhe Sword/Launcher → targetIds com o value", () => {
    const dec: AR = {
      kind: "abilityResolution",
      trigger: "Main",
      queue: [
        {
          sourceInstanceId: "cmd1",
          specId: "ST04-012-Main",
          label: "deploy 1 Sword or 1 Launcher ...",
          optional: false,
          needsTarget: false,
          targetScope: "enemyUnit",
          legalTargets: [],
          enumChoice: {
            key: "strikerChoice",
            options: [
              { value: "sword", label: "Sword Strike" },
              { value: "launcher", label: "Launcher Strike" },
            ],
            label: "deploy 1 Sword or 1 Launcher ...",
          },
        },
      ],
    };
    const onResolve = vi.fn();
    render(<Harness decision={dec} onResolve={onResolve} />);
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Launcher Strike" }));
    fireEvent.click(confirm);
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST04-012-Main", activate: true, targetIds: ["launcher"] }]);
  });

  it("optativo: 'Pular' → activate false", () => {
    const optional: AR = {
      kind: "abilityResolution",
      trigger: "When Paired",
      queue: [
        {
          sourceInstanceId: "p1",
          specId: "X-1",
          label: "You may draw 1.",
          optional: true,
          needsTarget: false,
          targetScope: "enemyUnit",
          legalTargets: [],
        },
      ],
    };
    const onResolve = vi.fn();
    render(<Harness decision={optional} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onResolve).toHaveBeenCalledWith([{ specId: "X-1", activate: false, targetIds: [] }]);
  });

  it("multi-alvo em Unit (targetCount max: 2): sem pills aqui — 2 cliques no tabuleiro selecionam os 2 alvos", () => {
    const multiTarget: AR = {
      kind: "abilityResolution",
      trigger: "When Paired",
      queue: [
        {
          sourceInstanceId: "k1",
          specId: "GD01-044-WhenPaired",
          label: "Choose 1 to 2 enemy Units. Deal 2 damage divided among them.",
          optional: false,
          needsTarget: true,
          targetCount: { min: 1, max: 2 },
          targetScope: "enemyUnit",
          legalTargets: ["e1", "e2"],
        },
      ],
    };
    const onResolve = vi.fn();
    render(<Harness decision={multiTarget} onResolve={onResolve} />);
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeDisabled();
    expect(screen.getByText(/0\/2 selecionado/)).toBeInTheDocument();

    // Clica no 1º alvo no tabuleiro
    fireEvent.click(screen.getByRole("button", { name: "[tabuleiro] Zaku II" }));
    expect(confirm).toBeEnabled();

    // Clica no 2º alvo (agora 2 selecionados)
    fireEvent.click(screen.getByRole("button", { name: "[tabuleiro] Guncannon" }));
    fireEvent.click(confirm);
    expect(onResolve).toHaveBeenCalledWith([
      { specId: "GD01-044-WhenPaired", activate: true, targetIds: ["e1", "e2"] },
    ]);
  });

  it("trashSearch (busca na lixeira): permite selecionar carta do descarte ou 'Nenhuma'", () => {
    const trashDecision: AR = {
      kind: "abilityResolution",
      trigger: "When Paired",
      queue: [
        {
          sourceInstanceId: "a1",
          specId: "GD01-067-WhenPaired",
          label: "Search your trash for 1 Command card and add it to your hand.",
          optional: false,
          needsTarget: false,
          targetScope: "enemyUnit",
          legalTargets: [],
          trashSearch: {
            legalTrashIds: ["c1"],
            label: "Search trash",
          },
        },
      ],
    };
    const onResolve = vi.fn();
    render(
      <Harness
        decision={trashDecision}
        resolveLabel={(id) => (id === "c1" ? "Signs of a Revolution" : id)}
        onResolve={onResolve}
      />,
    );
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeEnabled(); // 0 alvos ou 1 é válido

    fireEvent.click(screen.getByRole("button", { name: "Signs of a Revolution" }));
    fireEvent.click(confirm);
    expect(onResolve).toHaveBeenCalledWith([
      { specId: "GD01-067-WhenPaired", activate: true, targetIds: ["c1"] },
    ]);
  });

  it("efeito único usa layout flexível sem barras desnecessárias (max-h-[min(54vh,540px)]), enquanto múltiplos efeitos mantêm a modal com ordenação (max-h-[min(65vh,620px)])", () => {
    const singleDecision: AR = {
      kind: "abilityResolution",
      trigger: "When Paired",
      queue: [
        {
          sourceInstanceId: "p1",
          specId: "spec-single",
          label: "Single effect label",
          optional: false,
          needsTarget: false,
          targetScope: "enemyUnit",
          legalTargets: [],
        },
      ],
    };

    const { container: singleContainer } = render(
      <Harness decision={singleDecision} onResolve={vi.fn()} />,
    );
    const singlePanel = singleContainer.querySelector(".hero-surface");
    expect(singlePanel).toHaveClass("max-h-[min(54vh,540px)]");
    expect(singlePanel).toHaveClass("p-3");
    expect(screen.queryByText("Ordene e escolha os alvos:")).not.toBeInTheDocument();

    cleanup();

    const multiDecision: AR = {
      kind: "abilityResolution",
      trigger: "When Paired",
      queue: [
        {
          sourceInstanceId: "p1",
          specId: "spec-1",
          label: "Effect 1",
          optional: false,
          needsTarget: false,
          targetScope: "enemyUnit",
          legalTargets: [],
        },
        {
          sourceInstanceId: "p2",
          specId: "spec-2",
          label: "Effect 2",
          optional: false,
          needsTarget: false,
          targetScope: "enemyUnit",
          legalTargets: [],
        },
      ],
    };

    const { container: multiContainer } = render(
      <Harness decision={multiDecision} onResolve={vi.fn()} />,
    );
    const multiPanel = multiContainer.querySelector(".hero-surface");
    expect(multiPanel).toHaveClass("max-h-[min(65vh,620px)]");
    expect(multiPanel).toHaveClass("p-3");
    expect(screen.getByText("Ordene e escolha os alvos:")).toBeInTheDocument();
  });
});


describe("pickSecondaryTarget com custo \"Rest N\" (W8)", () => {
  it("escolhe até N, clicar de novo remove; com N=1 continua alternando 1", () => {
    let s: Record<string, string[]> = {};
    s = pickSecondaryTarget(s, "spec", "u1", 2);
    s = pickSecondaryTarget(s, "spec", "u2", 2);
    s = pickSecondaryTarget(s, "spec", "u3", 2);
    expect(s.spec).toEqual(["u1", "u2"]);
    s = pickSecondaryTarget(s, "spec", "u1", 2);
    expect(s.spec).toEqual(["u2"]);
    expect(pickSecondaryTarget({ spec: ["a"] }, "spec", "b")).toEqual({ spec: ["b"] });
  });
});

describe("resolveTriggerModalHeader (Fase 2)", () => {
  it("trata trigger comum sem continuação", () => {
    const res = resolveTriggerModalHeader("Deploy", undefined, "PT_BR");
    expect(res.isContinuation).toBe(false);
    expect(res.title).toContain("【Deploy】");
  });

  it("trata continuação Then:1 e Mode: com parentTrigger", () => {
    const resPt = resolveTriggerModalHeader("Then:1", "When Paired", "PT_BR");
    expect(resPt.isContinuation).toBe(true);
    expect(resPt.stepBadge).toBe("Passo 2 de 2");
    expect(resPt.title).toContain("Passo 2 · Continuação de");
    expect(resPt.title).toContain("【When Paired】");

    const resEn = resolveTriggerModalHeader("Mode:2", "Attack", "EN");
    expect(resEn.isContinuation).toBe(true);
    expect(resEn.stepBadge).toBe("Step 2 of 2");
    expect(resEn.title).toContain("Step 2 · Continuation of");
    expect(resEn.title).toContain("【Attack】");
  });
});

describe("trashExile no AbilityResolutionModal (Fase 2)", () => {
  it("exige exatamente N cartas do trash, atualiza badge de contagem e envia trashExileIds", () => {
    const onResolve = vi.fn();
    const decision: AR = {
      kind: "abilityResolution",
      trigger: "Deploy",
      queue: [
        {
          sourceInstanceId: "u1",
          specId: "spec-dev",
          label: "Development 2 - Exile 2 cards from trash",
          optional: false,
          needsTarget: false,
          targetScope: "enemyUnit",
          legalTargets: [],
          trashExile: {
            count: 2,
            legalTrashIds: ["t1", "t2", "t3"],
            label: "Exile 2 cards",
          },
        },
      ],
    };

    render(
      <Harness
        decision={decision}
        resolveLabel={(id) => (id === "t1" ? "Trash 1" : id === "t2" ? "Trash 2" : "Trash 3")}
        onResolve={onResolve}
      />,
    );

    expect(screen.getByText(/Falta escolher 2/i)).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: /confirmar/i });
    expect(confirmBtn).toBeDisabled();

    // Clica na primeira carta
    fireEvent.click(screen.getByRole("button", { name: /Trash 1/i }));
    expect(screen.getByText(/Falta escolher 1/i)).toBeInTheDocument();
    expect(confirmBtn).toBeDisabled();

    // Clica na segunda carta
    fireEvent.click(screen.getByRole("button", { name: /Trash 2/i }));
    expect(screen.getByText(/Pronto \(2\/2\)/i)).toBeInTheDocument();
    expect(confirmBtn).not.toBeDisabled();

    // Confirma
    fireEvent.click(confirmBtn);
    expect(onResolve).toHaveBeenCalledWith([
      {
        specId: "spec-dev",
        activate: true,
        targetIds: [],
        trashExileIds: ["t1", "t2"],
      },
    ]);
  });
});

describe("devTrashCount badge (Fase 2)", () => {
  it("exibe badge de contagem de Development no trash", () => {
    const decision: AR = {
      kind: "abilityResolution",
      trigger: "Deploy",
      queue: [
        {
          sourceInstanceId: "u1",
          specId: "spec-dev-1",
          label: "【Development 2】",
          optional: false,
          needsTarget: false,
          targetScope: "enemyUnit",
          legalTargets: [],
        },
      ],
    };

    render(<Harness decision={decision} devTrashCount={4} onResolve={vi.fn()} />);
    expect(screen.getByText(/Development ·/i)).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(/cartas \(G Generation\) no trash/i)).toBeInTheDocument();
  });
});

describe("BUG-8STNFY & BUG-CVKER1 (posicionamento do botão Confirmar e imagens nas cartas do topo)", () => {
  it("posiciona o botão Confirmar no rodapé abaixo das opções e efeitos (BUG-8STNFY)", () => {
    const dec: AR = {
      kind: "abilityResolution",
      trigger: "When Paired",
      queue: [
        {
          sourceInstanceId: "b1",
          specId: "ST14-012-WhenPaired",
          label: "When Paired effect label",
          optional: false,
          needsTarget: false,
          targetScope: "enemyUnit",
          legalTargets: [],
        },
      ],
    };
    const { container } = render(<Harness decision={dec} onResolve={vi.fn()} />);
    const header = container.querySelector(".border-b");
    const footer = container.querySelector(".border-t");
    const confirmBtn = screen.getByRole("button", { name: "Confirmar" });
    expect(header).not.toContainElement(confirmBtn);
    expect(footer).toContainElement(confirmBtn);
  });

  it("deckReorder renderiza miniaturas com CardFace e códigos das cartas (BUG-CVKER1)", () => {
    const c = (id: string, name: string): CardInstance =>
      ({ instanceId: id, def: { code: id, nameEn: name, cardType: "UNIT", color: "blue" }, owner: "A", zone: "deck", rested: false, damage: 0, statModifiers: [], keywordGrants: [], usedKeywordsThisTurn: [], enteredZoneOnTurn: 0 }) as CardInstance;
    const dec: AR = {
      kind: "abilityResolution",
      trigger: "Deploy",
      queue: [
        {
          sourceInstanceId: "b1",
          specId: "ST02-015-Deploy",
          label: "look at top 2",
          optional: false,
          needsTarget: false,
          targetScope: "enemyUnit",
          legalTargets: [],
          deckReorder: {
            topCards: [c("ST02-001", "Wing"), c("ST02-002", "Leo")],
            slots: [
              { name: "toTop", position: "top" },
              { name: "toBottom", position: "bottom" },
            ],
            label: "look at top 2",
          },
        },
      ],
    };
    const art: ArtLookup = {
      "ST02-001": { imageUrl: "https://img.com/wing.png" },
      "ST02-002": { imageUrl: "https://img.com/leo.png" },
    };
    render(<Harness decision={dec} art={art} onResolve={vi.fn()} />);
    expect(screen.getByRole("img", { name: "Wing" })).toHaveAttribute("src", "https://img.com/wing.png");
    expect(screen.getByRole("img", { name: "Leo" })).toHaveAttribute("src", "https://img.com/leo.png");
    expect(screen.getByText("ST02-001")).toBeInTheDocument();
    expect(screen.getByText("ST02-002")).toBeInTheDocument();
  });

  it("deckTopReveal renderiza miniaturas com CardFace (BUG-CVKER1)", () => {
    const fakeCard = (id: string, name: string, cardType: "UNIT" | "COMMAND"): CardInstance =>
      ({ instanceId: id, def: { code: id, nameEn: name, cardType, color: "red" }, owner: "A", zone: "deck", rested: false, damage: 0, statModifiers: [], keywordGrants: [], usedKeywordsThisTurn: [], enteredZoneOnTurn: 0 }) as CardInstance;
    const dec: AR = {
      kind: "abilityResolution",
      trigger: "Destroyed",
      queue: [
        {
          sourceInstanceId: "z1",
          specId: "ST03-006-Destroyed",
          label: "reveal from top",
          optional: false,
          needsTarget: false,
          targetScope: "enemyUnit",
          legalTargets: [],
          deckTopReveal: {
            count: 2,
            topCards: [fakeCard("ST03-001", "Zaku I", "UNIT"), fakeCard("ST03-002", "Dra-C", "UNIT")],
            revealableIds: ["ST03-001", "ST03-002"],
            label: "reveal from top",
          },
        },
      ],
    };
    const art: ArtLookup = {
      "ST03-001": { imageUrl: "https://img.com/zaku.png" },
      "ST03-002": { imageUrl: "https://img.com/drac.png" },
    };
    render(<Harness decision={dec} art={art} onResolve={vi.fn()} />);
    expect(screen.getByRole("img", { name: "Zaku I" })).toHaveAttribute("src", "https://img.com/zaku.png");
    expect(screen.getByRole("img", { name: "Dra-C" })).toHaveAttribute("src", "https://img.com/drac.png");
    expect(screen.getByText("ST03-001")).toBeInTheDocument();
    expect(screen.getByText("ST03-002")).toBeInTheDocument();
  });
});

describe("BUG-HA26D8 (descarte mostrava só o nome da carta)", () => {
  const handCard = (instanceId: string, code: string, name: string, cardType: "UNIT" | "PILOT" = "UNIT"): CardInstance =>
    ({ instanceId, def: { code, nameEn: name, cardType, color: "blue" }, owner: "A", zone: "hand", rested: false, damage: 0, statModifiers: [], keywordGrants: [], usedKeywordsThisTurn: [], enteredZoneOnTurn: 0 }) as CardInstance;

  const discardDecision = (n: number, cards: CardInstance[]): AR => ({
    kind: "abilityResolution",
    trigger: "Destroyed",
    queue: [
      {
        sourceInstanceId: "u1",
        specId: "GD01-005-Destroyed",
        label: "Return this Unit's paired Pilot to its owner's hand. Then, discard 1.",
        optional: false,
        needsTarget: false,
        targetScope: "enemyUnit",
        legalTargets: [],
        handDiscard: { n, legalHandIds: cards.map((c) => c.instanceId), cards, label: "discard" },
      },
    ],
  });

  it("renderiza a carta (arte + código) em vez de só o nome — cópias do mesmo nome ficam distinguíveis", () => {
    const cards = [
      handCard("A-1", "ST01-001", "Gundam"),
      handCard("A-2", "GD01-088", "Banagher Links", "PILOT"),
      handCard("A-3", "ST14-012", "Banagher Links", "PILOT"),
    ];
    const art: ArtLookup = {
      "ST01-001": { imageUrl: "https://img.com/gundam.png" },
      "GD01-088": { imageUrl: "https://img.com/banagher-gd01.png" },
      "ST14-012": { imageUrl: "https://img.com/banagher-st14.png" },
    };
    const onResolve = vi.fn();
    render(<Harness decision={discardDecision(1, cards)} art={art} onResolve={onResolve} />);
    expect(screen.getByRole("img", { name: "Gundam" })).toHaveAttribute("src", "https://img.com/gundam.png");
    expect(screen.getByText("GD01-088")).toBeInTheDocument();
    expect(screen.getByText("ST14-012")).toBeInTheDocument();

    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Banagher Links ST14-012" }));
    fireEvent.click(confirm);
    expect(onResolve).toHaveBeenCalledWith([{ specId: "GD01-005-Destroyed", activate: true, targetIds: ["A-3"] }]);
  });

  it("descarte de N > 1 (GD02-117 'discard 2'): deixa escolher N cartas e só confirma com exatamente N", () => {
    const cards = [handCard("A-1", "ST01-001", "Gundam"), handCard("A-2", "ST01-002", "Guncannon"), handCard("A-3", "ST01-003", "Guntank")];
    const onResolve = vi.fn();
    render(<Harness decision={discardDecision(2, cards)} onResolve={onResolve} />);
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    fireEvent.click(screen.getByRole("button", { name: "Gundam ST01-001" }));
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Guntank ST01-003" }));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onResolve).toHaveBeenCalledWith([{ specId: "GD01-005-Destroyed", activate: true, targetIds: ["A-1", "A-3"] }]);
  });
});

describe("decisão vinda do motor (camada 2 — a tela mostra o que o texto manda ver)", () => {
  it("GD01-039 Dopp: quem joga vê a carta do topo antes de escolher topo/fundo; o oponente recebe a decisão sem ela", () => {
    const state = advanceToMainPhase(createGame(buildSt02DeckList(), buildSt02DeckList(), { seed: 11, firstPlayer: "A" }));
    for (let i = 0; i < 2; i++) placeCard(state, "A", { code: "CA-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
    const doppId = placeCard(state, "A", GD01_CARD_DEFS["GD01-039"], "hand");
    const paused = deployCard(state, "A", doppId, { specs: ALL_EFFECT_SPECS, predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver });
    const top = paused.players.A.deck[0];

    const own = viewStateFor(paused, "A").pendingDecision.A as AR;
    render(<Harness decision={own} onResolve={vi.fn()} />);
    expect(screen.getAllByText(top.def.code).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /top|topo/i })).toBeInTheDocument();
    cleanup();

    const opp = viewStateFor(paused, "B").pendingDecision.A as AR;
    render(<Harness decision={opp} onResolve={vi.fn()} />);
    expect(screen.queryAllByText(top.def.code)).toHaveLength(0);
  });
});
