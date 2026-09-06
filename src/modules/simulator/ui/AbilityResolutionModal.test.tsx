// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CardInstance, PendingDecision } from "@/modules/simulator/engine/types";
import { AbilityResolutionModal } from "./AbilityResolutionModal";

afterEach(cleanup);

type AR = Extract<PendingDecision, { kind: "abilityResolution" }>;

// V0 (docs/25): as opções já vêm prontas em `legalTargets` (calculadas no
// servidor) — o teste só precisa de um `resolveLabel` fixo pra mapear id -> nome.
const LABELS: Record<string, string> = { e1: "Zaku II", e2: "Guncannon", r1: "Recurso 1 (gasto)" };
const resolveLabel = (id: string) => LABELS[id] ?? id;

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
  it("mandatório + alvo (enemyUnit): confirma só depois de escolher; envia o targetId", () => {
    const onResolve = vi.fn();
    render(<AbilityResolutionModal decision={whenPaired} resolveLabel={resolveLabel} onResolve={onResolve} />);
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Guncannon" }));
    fireEvent.click(confirm);
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST01-010-WhenPaired", activate: true, targetIds: ["e2"] }]);
  });

  it("sem alvo legal (legalTargets vazio): confirma direto (efeito não faz nada)", () => {
    const noLegalTarget: AR = { ...whenPaired, queue: [{ ...whenPaired.queue[0], legalTargets: [] }] };
    const onResolve = vi.fn();
    render(<AbilityResolutionModal decision={noLegalTarget} resolveLabel={resolveLabel} onResolve={onResolve} />);
    expect(screen.getByText(/Nenhum alvo legal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST01-010-WhenPaired", activate: true, targetIds: [] }]);
  });

  it("Attack + ownResource: mostra o cabeçalho do 【Attack】 e os recursos como alvo", () => {
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
    render(<AbilityResolutionModal decision={attack} resolveLabel={resolveLabel} onResolve={onResolve} />);
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
      <AbilityResolutionModal
        decision={handChoiceDecision}
        resolveLabel={resolveLabel}
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
    render(
      <AbilityResolutionModal
        decision={handChoiceDecision}
        resolveLabel={resolveLabel}
        resolveHandLabel={(id) => id}
        onResolve={onResolve}
      />,
    );
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
    render(<AbilityResolutionModal decision={deckRevealDecision} resolveLabel={resolveLabel} onResolve={onResolve} />);
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
    render(<AbilityResolutionModal decision={deckRevealDecision} resolveLabel={resolveLabel} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole("button", { name: "Não revelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST03-006-Destroyed", activate: true, targetIds: [] }]);
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
    render(<AbilityResolutionModal decision={optional} resolveLabel={resolveLabel} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onResolve).toHaveBeenCalledWith([{ specId: "X-1", activate: false, targetIds: [] }]);
  });
});
