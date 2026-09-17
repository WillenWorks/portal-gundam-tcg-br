// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ZeroCoachHud } from "./ZeroCoachHud";
import { api, type ZeroTerminalAnalysis } from "@/lib/api";

afterEach(cleanup);

const mockAnalysis: ZeroTerminalAnalysis = {
  provider: "deterministic",
  persona: "heero",
  resolvedPersona: "heero",
  timestamp: new Date().toISOString(),
  threatLevel: "HIGH",
  lethalClockTurns: 2,
  winProbabilityEstimate: 0.68,
  burstProbabilityEstimate: 0.25,
  keyThreats: ["Unidade inimiga com Blocker pronta para interceptação", "Burst Strike ativo"],
  recommendedLines: [
    {
      priority: 5,
      strategy: "aggressive",
      actionRecommendation: "Atacar com Wing Zero no escudo central",
      rationale: "Garante quebra de escudo antes da ativação do pilot inimigo.",
      winProbabilityDelta: 0.18,
    },
    {
      priority: 4,
      strategy: "control",
      actionRecommendation: "Segurar recurso de contra-ataque",
      rationale: "O oponente possui mana aberta para resposta.",
      winProbabilityDelta: 0.08,
    },
  ],
  tacticalAdvice: "Calculando probabilidades de eliminação do alvo. Zero confirma 68% de chance de sucesso.",
};

describe("ZeroCoachHud", () => {
  it("não renderiza nada quando open é false", () => {
    render(
      <ZeroCoachHud
        open={false}
        onToggle={vi.fn()}
        matchId="match-test-01"
        seat="A"
      />
    );
    expect(screen.queryByTestId("zero-coach-hud")).toBeNull();
  });

  it("renderiza o HUD completo com telemetria tática quando aberto", () => {
    render(
      <ZeroCoachHud
        open={true}
        onToggle={vi.fn()}
        matchId="match-test-01"
        seat="A"
        initialAnalysis={mockAnalysis}
      />
    );

    // Header do HUD
    expect(screen.getByTestId("zero-coach-hud")).toBeInTheDocument();
    expect(screen.getByText("ZERO COACH")).toBeInTheDocument();
    expect(screen.getByText("HUD v2.0")).toBeInTheDocument();

    // Gauge de Vitória (68%)
    expect(screen.getByText("68%")).toBeInTheDocument();
    expect(screen.getByText("Vitória")).toBeInTheDocument();

    // Threat Level Badge (HIGH -> PERIGO ELEVADO)
    expect(screen.getByText("PERIGO ELEVADO")).toBeInTheDocument();

    // Lethal Clock
    expect(screen.getByText("2 turnos")).toBeInTheDocument();

    // Matriz de Burst (25%)
    expect(screen.getByText("25%")).toBeInTheDocument();

    // Linhas táticas recomendadas
    expect(screen.getByText("Atacar com Wing Zero no escudo central")).toBeInTheDocument();
    expect(screen.getByText("Segurar recurso de contra-ataque")).toBeInTheDocument();

    // Citação tática
    expect(screen.getByTestId("zero-tactical-quote")).toHaveTextContent("Calculando probabilidades de eliminação do alvo");
  });

  it("permite alternar a persona do piloto pelo seletor de comunicações", () => {
    render(
      <ZeroCoachHud
        open={true}
        onToggle={vi.fn()}
        matchId="match-test-01"
        seat="A"
        initialAnalysis={mockAnalysis}
      />
    );

    // Inicialmente com resolvedPersona "heero" -> Heero Yuy
    expect(screen.getByText("Heero Yuy")).toBeInTheDocument();

    // Clica no botão da persona CHAR
    const charBtn = screen.getByRole("button", { name: "CHAR" });
    fireEvent.click(charBtn);

    // Deve atualizar a visualização para Char Aznable
    expect(screen.getByText("Char Aznable")).toBeInTheDocument();
  });

  it("aciona onToggle ao clicar no botão fechar", () => {
    const onToggle = vi.fn();
    render(
      <ZeroCoachHud
        open={true}
        onToggle={onToggle}
        matchId="match-test-01"
        seat="A"
        initialAnalysis={mockAnalysis}
      />
    );

    const closeBtn = screen.getByTestId("zero-hud-close");
    fireEvent.click(closeBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("permite recolher e expandir o HUD tático", () => {
    render(
      <ZeroCoachHud
        open={true}
        onToggle={vi.fn()}
        matchId="match-test-01"
        seat="A"
        initialAnalysis={mockAnalysis}
      />
    );

    // Clica em recolher
    const minimizeBtn = screen.getByTestId("zero-hud-minimize");
    fireEvent.click(minimizeBtn);

    // Deve renderizar a visualização compacta
    expect(screen.getByText("68% WP")).toBeInTheDocument();
    expect(screen.getByText("Clock: 2T")).toBeInTheDocument();

    // Clica para expandir novamente
    fireEvent.click(minimizeBtn);

    // O HUD completo reaparece
    expect(screen.getByText("Vitória")).toBeInTheDocument();
    expect(screen.getByText("Atacar com Wing Zero no escudo central")).toBeInTheDocument();
  });

  it("dispara requisição de telemetria ao clicar no botão de recálculo", async () => {
    const spy = vi.spyOn(api, "getSimulatorZeroTerminal").mockResolvedValueOnce({
      ...mockAnalysis,
      winProbabilityEstimate: 0.72,
    });

    render(
      <ZeroCoachHud
        open={true}
        onToggle={vi.fn()}
        matchId="match-test-01"
        seat="A"
        initialAnalysis={mockAnalysis}
      />
    );

    const refreshBtn = screen.getByTitle("Recalcular telemetria agora");
    fireEvent.click(refreshBtn);

    expect(spy).toHaveBeenCalledWith("match-test-01", "adaptive");
    spy.mockRestore();
  });

  it("exibe badge de perigo crítico quando threatLevel é CRITICAL", () => {
    const criticalAnalysis: ZeroTerminalAnalysis = {
      ...mockAnalysis,
      threatLevel: "CRITICAL",
      winProbabilityEstimate: 0.15,
    };

    render(
      <ZeroCoachHud
        open={true}
        onToggle={vi.fn()}
        matchId="match-test-01"
        seat="A"
        initialAnalysis={criticalAnalysis}
      />
    );

    const criticalBadge = screen.getByText("AMEAÇA CRÍTICA");
    expect(criticalBadge).toBeInTheDocument();
    expect(screen.getByText("15%")).toBeInTheDocument();
  });
});
