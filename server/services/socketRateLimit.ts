/* Limite de eventos por conexão de socket: o limite do Express não alcança o socket.io. Os tetos ficam bem acima
 * do uso normal; evento acima do teto é descartado, e quem espera ack recebe o erro. */
import type { Socket } from "socket.io";

export const SOCKET_EVENT_LIMIT = { limit: 120, windowMs: 10_000 };
/** Eventos que consultam o banco ou criam salas e convites. */
export const SOCKET_COSTLY_EVENT_LIMIT = { limit: 20, windowMs: 60_000 };
export const SOCKET_COSTLY_EVENTS: ReadonlySet<string> = new Set([
  "queue:join",
  "challenge:create",
  "challenge:accept",
  "arena:squad_create",
  "arena:squad_join",
  "arena:queue_join",
  "quick_match:invite",
  "quick_match:select_deck",
]);

type Window = { startedAt: number; count: number };

export function attachSocketEventLimiter(socket: Pick<Socket, "use">, now: () => number = Date.now): void {
  const all: Window = { startedAt: now(), count: 0 };
  const costly: Window = { startedAt: now(), count: 0 };
  const allow = (window: Window, { limit, windowMs }: { limit: number; windowMs: number }) => {
    if (now() - window.startedAt >= windowMs) {
      window.startedAt = now();
      window.count = 0;
    }
    window.count += 1;
    return window.count <= limit;
  };

  socket.use((packet, next) => {
    const [event] = packet;
    const allowed = allow(all, SOCKET_EVENT_LIMIT) && (!SOCKET_COSTLY_EVENTS.has(String(event)) || allow(costly, SOCKET_COSTLY_EVENT_LIMIT));
    if (allowed) return next();
    const ack = packet[packet.length - 1];
    if (typeof ack === "function") ack({ ok: false, error: "Muitas ações em pouco tempo. Aguarde um instante." });
  });
}
