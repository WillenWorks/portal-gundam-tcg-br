/**
 * Hook de transporte da tela de partida (Frente 5 — docs/39 §2.2, §3, roteiro item 4).
 *
 * Migra o `SimulatorMatchPage` do SSE puro para o `simulatorSocket` como
 * transporte PRIMÁRIO, com FALLBACK automático pro caminho SSE + POST antigo:
 *
 *  - Modo `socket`: `match:view_update` alimenta a view (guarda de ordenação por
 *    `version` no `applyIncomingView` da página); `match:action` manda a jogada e
 *    o eco volta pelo broadcast; `match:ping` mantém a presença.
 *  - Modo `sse`: exatamente o laço que vivia embutido na página — `EventSource`
 *    com backoff exponencial, resync autoritativo via REST, tratamento de 401/404.
 *
 * A decisão de transporte:
 *  - começa em `socket`;
 *  - cai pra `sse` se o socket ficar `dead` (handshake recusado) OU não entregar
 *    o 1º snapshot dentro de `SOCKET_FIRST_VIEW_TIMEOUT_MS` (servidor sem
 *    Socket.io / proxy que bloqueia WS — casos em que o `getStatus()` fica preso
 *    em `reconnecting` pra sempre em vez de virar `dead`);
 *  - volta pra `socket` se o socket se recuperar e reentregar uma view (fecha o
 *    `EventSource` de fallback nesse momento).
 *
 * ADITIVO: o SSE (`/stream`) e as rotas `POST /actions|ping|...` continuam
 * intactos no servidor — só o caminho preferido do cliente muda.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { api, ApiError, buildSimulatorStreamUrl, type SimulatorMatchView } from "@/lib/api";
import type { PlayerAction } from "@/modules/simulator/engine/actions";
import { simulatorSocket } from "@/modules/simulator/network/socketClient";

export type MatchTransportKind = "socket" | "sse";
export type MatchConnState = "connecting" | "live" | "reconnecting" | "dead";

/** Se o socket não entregar o 1º snapshot nesse prazo, cai pro SSE. */
const SOCKET_FIRST_VIEW_TIMEOUT_MS = 6_000;
/** Teto de espera pelo eco da ação (broadcast `match:view_update`) no modo socket. */
const ACTION_ACK_TIMEOUT_MS = 8_000;
/** Backoff do laço SSE de fallback (igual ao que era embutido na página). */
const SSE_RETRY_MAX_MS = 15_000;
/** Heartbeat de presença — bem menor que os 3min do W.O., só pra manter `lastSeenAt` fresco. */
const PRESENCE_PING_MS = 15_000;

// Wave 5 (docs/47): cutover — endurecer/remover o fallback SSE aqui.
// Flags de transporte: hoje ambas ligadas (socket como primário, SSE como
// fallback automático). Nenhuma muda o comportamento atual — existem só pra
// tornar o flip trivial no cutover (SSE_FALLBACK_ENABLED = false → socket-only).
const SOCKET_FIRST = true;
const SSE_FALLBACK_ENABLED = true;

interface UseMatchTransportOptions {
  matchId: string;
  /** Aplica uma visão nova (com a guarda de ordenação por `version`). Deve ser estável. */
  applyIncomingView: (view: SimulatorMatchView) => void;
  /** Conexão sem volta (sessão expirada / partida encerrada). O hook já marca
   *  `connState = "dead"`; o callback decide o toast + navegação. */
  onExpired: (opts: { reason: string; toLobby: boolean }) => void;
  /** `match:error` que não está atrelado a uma ação em voo (ex.: erro de `match:join`). */
  onMatchError?: (message: string) => void;
}

export interface MatchTransport {
  connState: MatchConnState;
  transport: MatchTransportKind;
  deadReason: string | null;
  reconnectAttempt: number;
  /** RTT do último `match:ping` com ack (ms) — só no modo socket. */
  lastPingMs: number | null;
  /** Presença do oponente pelo socket (`match:opponent_status`); `null` = sem info. */
  opponentOnline: boolean | null;
  /** Envia a ação pelo transporte ativo. Socket: resolve quando o eco
   *  (`match:view_update` com `lastActionSeq >= seq`) chega; rejeita em
   *  `match:error` ou timeout. SSE: `POST` e aplica a resposta. */
  sendAction: (action: PlayerAction) => Promise<void>;
  /** Encerra tudo (fim de jogo / saída manual): fecha o `EventSource`, desliga o
   *  socket e trava o backoff. */
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
  const [transport, setTransport] = useState<MatchTransportKind>(SOCKET_FIRST ? "socket" : "sse");
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
  const transportRef = useRef<MatchTransportKind>(SOCKET_FIRST ? "socket" : "sse");
  transportRef.current = transport;

  const stoppedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const socketDeliveredRef = useRef(false);
  const pendingActionRef = useRef<PendingAction | null>(null);

  const closeEventSource = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  const settlePending = useCallback((outcome: { ok: true } | { ok: false; error: Error }) => {
    const pending = pendingActionRef.current;
    if (!pending) return;
    pendingActionRef.current = null;
    clearTimeout(pending.timer);
    if (outcome.ok) pending.resolve();
    else pending.reject(outcome.error);
  }, []);

  const goDead = useCallback(
    (reason: string, toLobby: boolean) => {
      stoppedRef.current = true;
      closeEventSource();
      settlePending({ ok: false, error: new Error(reason) });
      setDeadReason(reason);
      setConnState("dead");
      onExpiredRef.current({ reason, toLobby });
    },
    [closeEventSource, settlePending],
  );

  const teardown = useCallback(() => {
    stoppedRef.current = true;
    settlePending({ ok: false, error: new Error("Partida encerrada.") });
    closeEventSource();
    simulatorSocket.disconnect();
  }, [closeEventSource, settlePending]);

  // --- Transporte primário: Socket.io ---
  useEffect(() => {
    stoppedRef.current = false;
    socketDeliveredRef.current = false;
    setTransport("socket");
    setConnState("connecting");

    simulatorSocket.connect();
    simulatorSocket.joinMatch(matchId);

    let fallbackTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      fallbackTimer = null;
      if (SSE_FALLBACK_ENABLED && !socketDeliveredRef.current && !stoppedRef.current) {
        setConnState("reconnecting");
        setTransport("sse");
      }
    }, SOCKET_FIRST_VIEW_TIMEOUT_MS);
    const clearFallbackTimer = () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const offs = [
      simulatorSocket.on("match:view_update", (payload) => {
        if (stoppedRef.current) return;
        clearFallbackTimer();
        socketDeliveredRef.current = true;
        applyRef.current(payload.view);

        // Socket saudável de novo → volta pra ele e fecha o SSE de fallback.
        if (transportRef.current === "sse" && simulatorSocket.getStatus() === "connected") {
          closeEventSource();
          setTransport("socket");
        }
        if (transportRef.current !== "sse") {
          setConnState("live");
          setReconnectAttempt(0);
        }

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
        if (stoppedRef.current || transportRef.current === "sse") return;
        if (status === "dead" && SSE_FALLBACK_ENABLED) {
          clearFallbackTimer();
          setConnState("reconnecting");
          setTransport("sse");
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
      clearFallbackTimer();
      for (const off of offs) off();
      simulatorSocket.disconnect();
      closeEventSource();
    };
  }, [matchId, closeEventSource, settlePending]);

  // --- Fallback: laço SSE + resync REST (comportamento inalterado, só isolado aqui). ---
  useEffect(() => {
    if (!SSE_FALLBACK_ENABLED || transport !== "sse" || stoppedRef.current) return;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (stoppedRef.current) return;
      const url = buildSimulatorStreamUrl(matchId);
      if (!url) {
        goDead("Sessão inválida — faça login de novo.", false);
        return;
      }
      const source = new EventSource(url);
      eventSourceRef.current = source;

      source.addEventListener("state", (event: MessageEvent) => {
        attempt = 0;
        setReconnectAttempt(0);
        setConnState("live");
        applyRef.current(JSON.parse(event.data) as SimulatorMatchView);
      });

      source.onerror = () => {
        source.close();
        eventSourceRef.current = null;
        if (stoppedRef.current) return;
        setConnState("reconnecting");
        attempt += 1;
        setReconnectAttempt(attempt);
        void api
          .getSimulatorMatch(matchId)
          .then((res) => {
            if (stoppedRef.current) return;
            if ("seated" in res && res.seated) {
              applyRef.current(res as SimulatorMatchView);
              return;
            }
            goDead("Esta partida foi encerrada.", true);
          })
          .catch((err) => {
            if (stoppedRef.current) return;
            if (err instanceof ApiError && err.status === 401) {
              goDead("Sessão expirada — faça login de novo.", false);
            } else if (err instanceof ApiError && err.status === 404) {
              goDead("Esta partida não está mais disponível.", true);
            }
            // outros erros (queda de rede momentânea) → o backoff abaixo segue
          });
        const delay = Math.min(SSE_RETRY_MAX_MS, 1_000 * 2 ** (attempt - 1));
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      closeEventSource();
    };
  }, [transport, matchId, goDead, closeEventSource]);

  // --- Heartbeat de presença: socket (`match:ping`) ou REST, conforme o transporte. ---
  useEffect(() => {
    const ping = () => {
      if (stoppedRef.current || typeof document === "undefined") return;
      if (document.visibilityState !== "visible") return;
      if (transportRef.current === "socket" && simulatorSocket.getStatus() === "connected") {
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
      const socketReady = transportRef.current === "socket" && simulatorSocket.getStatus() === "connected";
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
    transport,
    deadReason,
    reconnectAttempt,
    lastPingMs,
    opponentOnline,
    sendAction,
    teardown,
  };
}
