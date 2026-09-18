/**
 * Hook de transporte da tela de partida (Frente 5 — docs/39 §2.2, §3, roteiro
 * item 4).
 *
 * Socket.io é o ÚNICO transporte de duelo (cutover Wave 5 / docs/47,
 * concluído na branch `feature/arena4p-state-resilience`): `match:view_update`
 * alimenta a view (guarda de ordenação por `version` no `applyIncomingView` da
 * página); `match:action` manda a jogada e o eco volta pelo broadcast;
 * `match:ping` mantém a presença. Esta MESMA tela é embutida dentro de cada
 * lane da Arena Multiplayer 4P (`SimulatorMultiplayerPage.tsx`), então esta
 * migração vale pros dois — 1v1 solo e Arena.
 *
 * Removido nesta branch: o fallback SSE (`EventSource` em `/matches/:id/stream`
 * + resync REST) que vivia aqui como caminho alternativo enquanto o Socket.io
 * era validado em produção. O `simulatorSocket` já reconecta sozinho com
 * backoff exponencial pra qualquer queda de rede transitória — `status`
 * só vira `dead` quando o SERVIDOR recusa o handshake (ex.: token inválido),
 * caso em que não há transporte alternativo que resolvesse mesmo (a mesma
 * auth barra o REST também); aí quem chama decide o que fazer (`onExpired`).
 * `transport` continua no retorno como um literal fixo `"socket"` só pra não
 * quebrar os pontos de UI que já checam por ele.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { api, type SimulatorMatchView } from "@/lib/api";
import type { PlayerAction } from "@/modules/simulator/engine/actions";
import { simulatorSocket } from "@/modules/simulator/network/socketClient";

export type MatchTransportKind = "socket";
export type MatchConnState = "connecting" | "live" | "reconnecting" | "dead";

/** Teto de espera pelo eco da ação (broadcast `match:view_update`). */
const ACTION_ACK_TIMEOUT_MS = 8_000;
/** Heartbeat de presença — bem menor que os 3min do W.O., só pra manter `lastSeenAt` fresco. */
const PRESENCE_PING_MS = 15_000;

interface UseMatchTransportOptions {
  matchId: string;
  /** Aplica uma visão nova (com a guarda de ordenação por `version`). Deve ser estável. */
  applyIncomingView: (view: SimulatorMatchView) => void;
  /** Conexão sem volta (servidor recusou o handshake / partida encerrada). O
   *  hook já marca `connState = "dead"`; o callback decide o toast + navegação. */
  onExpired: (opts: { reason: string; toLobby: boolean }) => void;
  /** `match:error` que não está atrelado a uma ação em voo (ex.: erro de `match:join`). */
  onMatchError?: (message: string) => void;
}

export interface MatchTransport {
  connState: MatchConnState;
  /** Sempre `"socket"` — campo mantido só pelos pontos de UI que já checam por ele. */
  transport: MatchTransportKind;
  deadReason: string | null;
  reconnectAttempt: number;
  /** RTT do último `match:ping` com ack (ms). */
  lastPingMs: number | null;
  /** Presença do oponente pelo socket (`match:opponent_status`); `null` = sem info. */
  opponentOnline: boolean | null;
  /** Envia a ação pelo socket quando conectado (resolve quando o eco
   *  `match:view_update` com `lastActionSeq >= seq` chega; rejeita em
   *  `match:error` ou timeout); cai num `POST` REST pontual se o socket
   *  estiver momentaneamente fora do ar. */
  sendAction: (action: PlayerAction) => Promise<void>;
  /** Encerra tudo (fim de jogo / saída manual): desliga o socket. */
  teardown: () => void;
}

interface PendingAction {
  seq: number;
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function useMatchTransport({
  matchId,
  applyIncomingView,
  onExpired,
  onMatchError,
}: UseMatchTransportOptions): MatchTransport {
  const [connState, setConnState] = useState<MatchConnState>("connecting");
  const [deadReason, setDeadReason] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [lastPingMs, setLastPingMs] = useState<number | null>(null);
  const [opponentOnline, setOpponentOnline] = useState<boolean | null>(null);

  // Callbacks vivos dentro dos efeitos de longa duração, sem re-assinar tudo.
  const applyRef = useRef(applyIncomingView);
  applyRef.current = applyIncomingView;
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;
  const onMatchErrorRef = useRef(onMatchError);
  onMatchErrorRef.current = onMatchError;

  const stoppedRef = useRef(false);
  const socketDeliveredRef = useRef(false);
  const pendingActionRef = useRef<PendingAction | null>(null);

  const settlePending = useCallback((outcome: { ok: true } | { ok: false; error: Error }) => {
    const pending = pendingActionRef.current;
    if (!pending) return;
    pendingActionRef.current = null;
    clearTimeout(pending.timer);
    if (outcome.ok) pending.resolve();
    else pending.reject(outcome.error);
  }, []);

  const teardown = useCallback(() => {
    stoppedRef.current = true;
    settlePending({ ok: false, error: new Error("Partida encerrada.") });
    simulatorSocket.disconnect();
  }, [settlePending]);

  useEffect(() => {
    stoppedRef.current = false;
    socketDeliveredRef.current = false;
    setConnState("connecting");

    simulatorSocket.connect();
    simulatorSocket.joinMatch(matchId);

    const offs = [
      simulatorSocket.on("match:view_update", (payload) => {
        if (stoppedRef.current) return;
        socketDeliveredRef.current = true;
        applyRef.current(payload.view);
        setConnState("live");
        setReconnectAttempt(0);

        const pending = pendingActionRef.current;
        if (pending && payload.lastActionSeq >= pending.seq) settlePending({ ok: true });
      }),
      simulatorSocket.on("match:error", (payload) => {
        if (stoppedRef.current) return;
        const message = payload?.message || "Ação inválida.";
        if (pendingActionRef.current) settlePending({ ok: false, error: new Error(message) });
        else onMatchErrorRef.current?.(message);
      }),
      simulatorSocket.on("match:opponent_status", (payload) => {
        setOpponentOnline(Boolean(payload?.online));
      }),
      simulatorSocket.on("ping", (ms) => setLastPingMs(ms)),
      simulatorSocket.on("status", (status) => {
        if (stoppedRef.current) return;
        if (status === "dead") {
          const reason = "O servidor recusou a conexão — faça login de novo.";
          settlePending({ ok: false, error: new Error(reason) });
          setDeadReason(reason);
          setConnState("dead");
          onExpiredRef.current({ reason, toLobby: false });
          return;
        }
        if (status === "connected") {
          setConnState(socketDeliveredRef.current ? "live" : "connecting");
        } else if (status === "reconnecting") {
          setConnState("reconnecting");
          setReconnectAttempt((n) => n + 1);
        } else if (status === "connecting") {
          setConnState("connecting");
        }
      }),
    ];

    return () => {
      for (const off of offs) off();
      simulatorSocket.disconnect();
    };
  }, [matchId, settlePending]);

  // --- Heartbeat de presença: socket (`match:ping`), ou REST se ele estiver momentaneamente fora do ar. ---
  useEffect(() => {
    const ping = () => {
      if (stoppedRef.current || typeof document === "undefined") return;
      if (document.visibilityState !== "visible") return;
      if (simulatorSocket.getStatus() === "connected") {
        simulatorSocket.ping(matchId);
      } else {
        void api.pingSimulatorMatch(matchId).catch(() => {});
      }
    };
    ping();
    const interval = setInterval(ping, PRESENCE_PING_MS);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [matchId]);

  const sendAction = useCallback(
    (action: PlayerAction): Promise<void> => {
      const socketReady = simulatorSocket.getStatus() === "connected";
      if (socketReady) {
        const seq = simulatorSocket.sendAction(matchId, action);
        return new Promise<void>((resolve, reject) => {
          // Substitui uma ação anterior ainda pendente (a página serializa com `busy`,
          // mas se acontecer, a anterior não fica pendurada pra sempre).
          settlePending({ ok: false, error: new Error("Ação substituída por outra.") });
          const timer = setTimeout(() => {
            if (pendingActionRef.current?.seq === seq) {
              pendingActionRef.current = null;
              reject(new Error("O servidor não confirmou a ação a tempo. Tente de novo."));
            }
          }, ACTION_ACK_TIMEOUT_MS);
          pendingActionRef.current = { seq, resolve, reject, timer };
        });
      }
      return api.sendSimulatorAction(matchId, action).then((res) => {
        applyRef.current(res);
      });
    },
    [matchId, settlePending],
  );

  return {
    connState,
    transport: "socket",
    deadReason,
    reconnectAttempt,
    lastPingMs,
    opponentOnline,
    sendAction,
    teardown,
  };
}
