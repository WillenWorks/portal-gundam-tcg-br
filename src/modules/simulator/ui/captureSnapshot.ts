import html2canvas from "html2canvas-pro";
import type { PlayerId } from "@/modules/simulator/engine/types";
import type { ViewGameState, ViewCardInstance } from "@/modules/simulator/engine/viewState";
import type { BattleLogEntry } from "./battleLog";
import type { SimulatorMatchView } from "@/lib/api";

export interface BugReportSnapshot {
  timestamp: number;
  matchId: string;
  seat: PlayerId;
  opponentSeat: PlayerId;
  isAgainstBot: boolean;
  botLevel?: string;
  turnNumber: number;
  phase: string;
  activePlayer: PlayerId;
  myShieldCount: number;
  oppShieldCount: number;
  myResourceCount: { total: number; active: number; rested: number };
  oppResourceCount: { total: number; active: number; rested: number };
  myUnitsInPlay: string[];
  oppUnitsInPlay: string[];
  screenshotBase64?: string;
  battleLogRecent: string[];
  browserInfo: {
    userAgent: string;
    screenWidth: number;
    screenHeight: number;
    viewportWidth: number;
    viewportHeight: number;
  };
}

export interface CaptureContext {
  matchId: string;
  seat: PlayerId;
  opponentSeat: PlayerId;
  matchView?: SimulatorMatchView | null;
  view: ViewGameState;
  battleLog: BattleLogEntry[];
}

const SCREENSHOT_MAX_WIDTH = 1600;
const SCREENSHOT_JPEG_QUALITY = 0.8;

function extractUnitCodes(cards: ViewCardInstance[]): string[] {
  return cards
    .filter((c) => !("hidden" in c && c.hidden))
    .map((c) => ("def" in c && c.def?.code ? c.def.code : "Carta Oculta"));
}

/**
 * Captura um snapshot integral da partida: estado atual, contagens, bot status,
 * log de combate recente e print visual da tela via html2canvas-pro (o html2canvas 1.x não lê as cores oklch do Tailwind v4).
 */
export async function captureSimulatorSnapshot(
  containerElement: HTMLElement | null,
  context: CaptureContext,
): Promise<BugReportSnapshot> {
  const { matchId, seat, opponentSeat, matchView, view, battleLog } = context;

  const isAgainstBot = Boolean(
    matchView?.botCounter ||
    matchView?.botDeckList ||
    (matchView && "seats" in matchView && (matchView as Record<string, any>).seats?.[opponentSeat]?.bot) ||
    matchId.startsWith("training-")
  );

  const me = view.players[seat];
  const opp = view.players[opponentSeat];

  const myResTotal = me.resourceArea.length;
  const myResActive = me.resourceArea.filter((r) => !("hidden" in r && r.hidden) && !("rested" in r && r.rested)).length;
  const myResRested = me.resourceArea.filter((r) => !("hidden" in r && r.hidden) && ("rested" in r && r.rested)).length;

  const oppResTotal = opp.resourceArea.length;
  const oppResActive = opp.resourceArea.filter((r) => !("hidden" in r && r.hidden) && !("rested" in r && r.rested)).length;
  const oppResRested = opp.resourceArea.filter((r) => !("hidden" in r && r.hidden) && ("rested" in r && r.rested)).length;

  let screenshotBase64: string | undefined;

  if (containerElement && typeof window !== "undefined") {
    try {
      // Sem `allowTaint`: com ele uma arte de outro domínio "contamina" o canvas e o `toDataURL` lança — por isso
      // nenhum relato tinha print. Com só `useCORS`, imagem sem CORS fica de fora e o resto da mesa sai.
      // JPEG e largura limitada: o POST do relato precisa caber com folga no `express.json({ limit: "4mb" })`.
      const width = containerElement.clientWidth || window.innerWidth || SCREENSHOT_MAX_WIDTH;
      const canvas = await html2canvas(containerElement, {
        useCORS: true,
        logging: false,
        backgroundColor: "#020617",
        scale: Math.min(window.devicePixelRatio || 1, SCREENSHOT_MAX_WIDTH / width),
      });
      screenshotBase64 = canvas.toDataURL("image/jpeg", SCREENSHOT_JPEG_QUALITY);
    } catch (err) {
      console.warn("[BugReport] Não foi possível capturar o screenshot via canvas:", err);
    }
  }

  const recentLog = battleLog.slice(-35).map((e) => e.text);

  return {
    timestamp: Date.now(),
    matchId,
    seat,
    opponentSeat,
    isAgainstBot,
    botLevel: isAgainstBot ? "Heurístico / Zero System" : undefined,
    turnNumber: view.turnNumber,
    phase: view.phase,
    activePlayer: view.activePlayer,
    myShieldCount: me.counts.shields,
    oppShieldCount: opp.counts.shields,
    myResourceCount: { total: myResTotal, active: myResActive, rested: myResRested },
    oppResourceCount: { total: oppResTotal, active: oppResActive, rested: oppResRested },
    myUnitsInPlay: extractUnitCodes(me.battleArea),
    oppUnitsInPlay: extractUnitCodes(opp.battleArea),
    screenshotBase64,
    battleLogRecent: recentLog,
    browserInfo: {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "N/D",
      screenWidth: typeof window !== "undefined" ? window.screen.width : 0,
      screenHeight: typeof window !== "undefined" ? window.screen.height : 0,
      viewportWidth: typeof window !== "undefined" ? window.innerWidth : 0,
      viewportHeight: typeof window !== "undefined" ? window.innerHeight : 0,
    },
  };
}
