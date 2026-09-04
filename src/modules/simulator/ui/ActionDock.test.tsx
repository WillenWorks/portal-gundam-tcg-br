import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "@/components/ui/button";
import { ActionDock, type ActionDockProps, type ActionDockState } from "./ActionDock";

/**
 * `ActionDock` é apresentacional puro e prop-driven — dá pra travar o
 * comportamento sem DOM, no ambiente `node` padrão do vitest, sem depender de
 * Testing Library: `renderToStaticMarkup` cobre texto/rótulo/`disabled` por
 * `kind`, e um caminhador da árvore de elementos acha o controle pelo rótulo e
 * dispara o `onClick` pra provar a fiação dos callbacks. (As Fases C/D trazem
 * RTL + jsdom pros componentes que precisam de interação real.)
 */

function html(state: ActionDockState, extra: Partial<ActionDockProps> = {}): string {
  return renderToStaticMarkup(<ActionDock state={state} {...extra} />);
}

interface Clickable {
  label: string;
  disabled: boolean;
  onClick?: (...args: unknown[]) => void;
}

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) {
    return textOf((node.props as { children?: ReactNode }).children);
  }
  return "";
}

function clickablesOf(node: ReactNode): Clickable[] {
  if (Array.isArray(node)) return node.flatMap(clickablesOf);
  if (!isValidElement(node)) return [];
  const props = node.props as {
    children?: ReactNode;
    onClick?: (...args: unknown[]) => void;
    disabled?: boolean;
  };
  const isButtonLike = node.type === Button || node.type === "button";
  const here: Clickable[] = isButtonLike
    ? [{ label: textOf(props.children).replace(/\s+/g, " ").trim(), disabled: props.disabled === true, onClick: props.onClick }]
    : [];
  return here.concat(clickablesOf(props.children ?? null));
}

function controls(state: ActionDockState, extra: Partial<ActionDockProps> = {}): Clickable[] {
  const tree = ActionDock({ state, ...extra }) as ReactElement;
  return clickablesOf(tree);
}

function click(state: ActionDockState, label: string, extra: Partial<ActionDockProps> = {}): void {
  const target = controls(state, extra).find((c) => c.label === label);
  if (!target?.onClick) throw new Error(`sem controle "${label}" para kind=${state.kind}`);
  target.onClick();
}

describe("ActionDock — texto e botões por kind", () => {
  it("idle (sua vez) mostra fase, timer e Encerrar turno", () => {
    const out = html({ kind: "idle", yourTurn: true, phaseLabel: "Main", timerSeconds: 45 });
    expect(out).toContain("Sua vez");
    expect(out).toContain("Main");
    expect(out).toContain("45s");
    expect(out).toContain("Encerrar turno");
  });

  it("idle mostra o número do turno quando informado", () => {
    expect(html({ kind: "idle", yourTurn: true, phaseLabel: "Main", timerSeconds: 30, turnNumber: 4 })).toContain("Turno 4");
  });

  it("idle (vez do oponente) esconde Encerrar turno e timer nulo", () => {
    const out = html({ kind: "idle", yourTurn: false, phaseLabel: "Main", timerSeconds: null });
    expect(out).toContain("Vez do oponente");
    expect(out).not.toContain("Encerrar turno");
    expect(out).not.toMatch(/\d+s/);
  });

  it("pending mostra rastreador de passo, hint, custo e Confirmar/Cancelar", () => {
    const out = html({
      kind: "pending",
      verb: "Jogando",
      cardName: "RX-78-2",
      selectedCount: 2,
      hint: "Escolha o alvo",
      cost: { paid: 1, total: 3 },
      canConfirm: false,
    });
    expect(out).toContain("Jogando RX-78-2");
    expect(out).toContain("2 selecionada(s)");
    expect(out).toContain("Escolha o alvo");
    expect(out).toContain("Recursos 1/3");
    expect(out).toContain("Confirmar");
    expect(out).toContain("Cancelar");
  });

  it("pending sem custo não renderiza a barra de recursos", () => {
    const out = html({ kind: "pending", verb: "Jogando", selectedCount: 0, cost: null, canConfirm: true });
    expect(out).not.toContain("Recursos");
  });

  it("attacking mostra o atacante e as ações de ataque", () => {
    const out = html({ kind: "attacking", attackerName: "Gundam" });
    expect(out).toContain("Atacando com Gundam");
    expect(out).toContain("Atacar o jogador");
    expect(out).toContain("Cancelar");
  });

  it("defending mostra o aviso de Blocker e Não bloquear", () => {
    const out = html({ kind: "defending" });
    expect(out).toContain("Defendendo");
    expect(out).toContain("Blocker");
    expect(out).toContain("Não bloquear");
  });

  it("actionStep mostra escopo, Passar e o toggle de auto-pass", () => {
    const combat = html({ kind: "actionStep", scope: "combat", autoPass: false });
    expect(combat).toContain("Passo de Ação (combate)");
    expect(combat).toContain("Passar");
    expect(combat).toContain("auto-pass: desligado");

    const endPhase = html({ kind: "actionStep", scope: "endPhase", autoPass: true });
    expect(endPhase).toContain("Passo de Ação (fim de turno)");
    expect(endPhase).toContain("auto-pass: LIGADO");
  });

  it("oppDecision mostra o label e nenhum botão", () => {
    const state: ActionDockState = { kind: "oppDecision", label: "Aguardando o oponente resolver um 【Burst】..." };
    expect(html(state)).toContain("Aguardando o oponente resolver");
    expect(controls(state)).toHaveLength(0);
  });

  it("abandonAvailable mostra o tempo ocioso e o botão de vitória", () => {
    const out = html({ kind: "abandonAvailable", idleSeconds: 42 });
    expect(out).toContain("Oponente inativo há 42s");
    expect(out).toContain("Declarar vitória por abandono");
  });

  it("gameOver (vitória) destaca e mostra a contagem de redirecionamento", () => {
    const out = html({ kind: "gameOver", won: true, reasonLabel: "Deck-out do oponente", redirectSeconds: 5 });
    expect(out).toContain("Você venceu");
    expect(out).toContain("Deck-out do oponente");
    expect(out).toContain("Voltar ao site (5s)");
  });

  it("gameOver (derrota) sem contagem mostra só Voltar ao site", () => {
    const out = html({ kind: "gameOver", won: false, reasonLabel: "Seu deck acabou", redirectSeconds: null });
    expect(out).toContain("Você perdeu");
    expect(out).toContain("Voltar ao site");
    expect(out).not.toMatch(/Voltar ao site \(/);
  });
});

describe("ActionDock — Confirmar depende de canConfirm/busy", () => {
  const base = { kind: "pending", verb: "Jogando", selectedCount: 1, cost: null } as const;

  it("desabilitado quando canConfirm é false", () => {
    const confirmar = controls({ ...base, canConfirm: false }).find((c) => c.label === "Confirmar");
    expect(confirmar?.disabled).toBe(true);
  });

  it("habilitado quando canConfirm é true", () => {
    const confirmar = controls({ ...base, canConfirm: true }).find((c) => c.label === "Confirmar");
    expect(confirmar?.disabled).toBe(false);
  });

  it("desabilitado quando busy, mesmo com canConfirm true", () => {
    const confirmar = controls({ ...base, canConfirm: true }, { busy: true }).find((c) => c.label === "Confirmar");
    expect(confirmar?.disabled).toBe(true);
  });
});

describe("ActionDock — logTail", () => {
  it("aparece quando passado", () => {
    const out = html({ kind: "defending" }, { logTail: "Jogador A implanta RX-78-2" });
    expect(out).toContain("Jogador A implanta RX-78-2");
  });

  it("não aparece quando ausente", () => {
    const out = html({ kind: "defending" });
    expect(out).not.toContain("border-t");
  });
});

describe("ActionDock — callbacks no clique", () => {
  it("idle → onEndTurn", () => {
    const onEndTurn = vi.fn();
    click({ kind: "idle", yourTurn: true, phaseLabel: "Main", timerSeconds: null }, "Encerrar turno", { onEndTurn });
    expect(onEndTurn).toHaveBeenCalledTimes(1);
  });

  it("pending → onConfirm e onCancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const state: ActionDockState = { kind: "pending", verb: "Jogando", selectedCount: 1, cost: null, canConfirm: true };
    click(state, "Confirmar", { onConfirm, onCancel });
    click(state, "Cancelar", { onConfirm, onCancel });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("attacking → onDeclareAttackPlayer e onCancelAttack", () => {
    const onDeclareAttackPlayer = vi.fn();
    const onCancelAttack = vi.fn();
    const state: ActionDockState = { kind: "attacking", attackerName: "Gundam" };
    click(state, "Atacar o jogador", { onDeclareAttackPlayer, onCancelAttack });
    click(state, "Cancelar", { onDeclareAttackPlayer, onCancelAttack });
    expect(onDeclareAttackPlayer).toHaveBeenCalledTimes(1);
    expect(onCancelAttack).toHaveBeenCalledTimes(1);
  });

  it("defending → onSkipBlock", () => {
    const onSkipBlock = vi.fn();
    click({ kind: "defending" }, "Não bloquear", { onSkipBlock });
    expect(onSkipBlock).toHaveBeenCalledTimes(1);
  });

  it("actionStep → onPass e onToggleAutoPass com o próximo valor", () => {
    const onPass = vi.fn();
    const onToggleAutoPass = vi.fn();
    const state: ActionDockState = { kind: "actionStep", scope: "combat", autoPass: false };
    click(state, "Passar", { onPass, onToggleAutoPass });
    click(state, "auto-pass: desligado", { onPass, onToggleAutoPass });
    expect(onPass).toHaveBeenCalledTimes(1);
    expect(onToggleAutoPass).toHaveBeenCalledWith(true);
  });

  it("abandonAvailable → onClaimAbandon", () => {
    const onClaimAbandon = vi.fn();
    click({ kind: "abandonAvailable", idleSeconds: 30 }, "Declarar vitória por abandono", { onClaimAbandon });
    expect(onClaimAbandon).toHaveBeenCalledTimes(1);
  });

  it("gameOver → onLeaveAfterGameOver", () => {
    const onLeaveAfterGameOver = vi.fn();
    click(
      { kind: "gameOver", won: true, reasonLabel: "Deck-out do oponente", redirectSeconds: 3 },
      "Voltar ao site (3s)",
      { onLeaveAfterGameOver },
    );
    expect(onLeaveAfterGameOver).toHaveBeenCalledTimes(1);
  });
});
