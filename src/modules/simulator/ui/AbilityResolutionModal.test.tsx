// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CardInstance, PendingDecision } from "@/modules/simulator/engine/types";
import {
  AbilityResolutionModal,
  pickSecondaryTarget,
  pickSingleTarget,
  toggleMultiTarget,
  usesBoardTargetingForPrimary,
  usesBoardTargetingForSecondary,
} from "./AbilityResolutionModal";

afterEach(cleanup);

type AR = Extract<PendingDecision, { kind: "abilityResolution" }>;
type ResolveArgs = Array<{ specId: string; activate: boolean; targetIds: string[]; secondaryTargetIds?: string[] }>;

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
}: {
  decision: AR;
  resolveLabel?: (id: string) => string;
  resolveHandLabel?: (id: string) => string;
  busy?: boolean;
  onResolve: (resolutions: ResolveArgs) => void;
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
});
