/**
 * Lógica PURA de suporte à camada Socket.io do simulador (Frente 5, docs/39).
 *
 * Fica aqui (em `src/modules/simulator/server`, ao lado do `matchStore`) e não
 * em `server/` porque não depende de nada do Node: é só o registro de desafios
 * diretos (link de convite) e a deduplicação idempotente de ações por
 * `actionSeq`. Assim dá pra testar isolado, no mesmo padrão do
 * `matchStore.test.ts`. O `io` de verdade — handshake JWT, salas, broadcast —
 * mora em `server/simulatorSocket.ts`.
 */

/** Prefixo do código de convite: `GC-7842` (docs/39 §4). */
export const CHALLENGE_CODE_PREFIX = "GC";
/** Convite não aceito em 10min é descartado. */
export const CHALLENGE_TTL_MS = 10 * 60_000;

export interface ChallengeEntry {
  code: string;
  hostUserId: string;
  hostDisplayName: string;
  hostDeckKey: string;
  createdAt: number;
}

export interface ChallengePairing {
  hostUserId: string;
  hostDisplayName: string;
  hostDeckKey: string;
  guestUserId: string;
  guestDisplayName: string;
  guestDeckKey: string;
}

export function normalizeChallengeCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Registro em memória dos convites diretos abertos. Cada host tem no máximo um
 * convite vivo por vez (criar de novo invalida o anterior). `accept` consome o
 * código — um convite só pode virar partida uma vez.
 */
export class ChallengeRegistry {
  private readonly byCode = new Map<string, ChallengeEntry>();
  private readonly now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  private sweep(): void {
    const cutoff = this.now() - CHALLENGE_TTL_MS;
    for (const [code, entry] of this.byCode) {
      if (entry.createdAt < cutoff) this.byCode.delete(code);
    }
  }

  private generateCode(): string {
    let code = "";
    do {
      code = `${CHALLENGE_CODE_PREFIX}-${Math.floor(1000 + Math.random() * 9000)}`;
    } while (this.byCode.has(code));
    return code;
  }

  create(input: { hostUserId: string; hostDisplayName: string; hostDeckKey: string }): ChallengeEntry {
    this.sweep();
    this.cancelByHost(input.hostUserId);
    const entry: ChallengeEntry = {
      code: this.generateCode(),
      hostUserId: input.hostUserId,
      hostDisplayName: input.hostDisplayName,
      hostDeckKey: input.hostDeckKey,
      createdAt: this.now(),
    };
    this.byCode.set(entry.code, entry);
    return entry;
  }

  peek(code: string): ChallengeEntry | undefined {
    this.sweep();
    return this.byCode.get(normalizeChallengeCode(code));
  }

  /** Consome o código e devolve o pareamento host↔convidado. Lança se inválido/expirado/próprio. */
  accept(input: {
    code: string;
    guestUserId: string;
    guestDisplayName: string;
    guestDeckKey: string;
  }): ChallengePairing {
    this.sweep();
    const code = normalizeChallengeCode(input.code);
    const entry = this.byCode.get(code);
    if (!entry) throw new Error("Convite inválido ou expirado.");
    if (entry.hostUserId === input.guestUserId) {
      throw new Error("Você não pode aceitar o seu próprio convite — a partida precisa de duas contas diferentes.");
    }
    this.byCode.delete(code);
    return {
      hostUserId: entry.hostUserId,
      hostDisplayName: entry.hostDisplayName,
      hostDeckKey: entry.hostDeckKey,
      guestUserId: input.guestUserId,
      guestDisplayName: input.guestDisplayName,
      guestDeckKey: input.guestDeckKey,
    };
  }

  cancelByHost(hostUserId: string): void {
    for (const [code, entry] of this.byCode) {
      if (entry.hostUserId === hostUserId) this.byCode.delete(code);
    }
  }

  get size(): number {
    return this.byCode.size;
  }
}

/**
 * Deduplicação idempotente de ações por `(matchId, seat)`. O cliente numera
 * cada ação com um `actionSeq` monotônico (`socketClient.ts`) e PODE reenviar a
 * mesma ação numa reconexão de rede transitória (docs/39 §3.2). Aqui a gente só
 * deixa passar se o seq for maior que o último já aplicado por aquele assento —
 * um reenvio chega com seq igual/menor e é ignorado (sem reexecutar no motor).
 */
export class ActionDeduper {
  private readonly lastSeq = new Map<string, number>();

  private key(matchId: string, seat: string): string {
    return `${matchId}:${seat}`;
  }

  /** `true` se esta ação ainda não foi aplicada (deve ir pro motor). Seq ausente/NaN = cliente legado, sempre aplica. */
  shouldApply(matchId: string, seat: string, actionSeq: number): boolean {
    if (!Number.isFinite(actionSeq)) return true;
    const last = this.lastSeq.get(this.key(matchId, seat));
    return last === undefined || actionSeq > last;
  }

  markApplied(matchId: string, seat: string, actionSeq: number): void {
    if (!Number.isFinite(actionSeq)) return;
    const k = this.key(matchId, seat);
    const last = this.lastSeq.get(k);
    if (last === undefined || actionSeq > last) this.lastSeq.set(k, actionSeq);
  }

  /** Último seq aplicado por este assento (0 se nenhum) — vai no `match:view_update { lastActionSeq }`. */
  lastApplied(matchId: string, seat: string): number {
    return this.lastSeq.get(this.key(matchId, seat)) ?? 0;
  }

  forget(matchId: string): void {
    for (const k of [...this.lastSeq.keys()]) {
      if (k.startsWith(`${matchId}:`)) this.lastSeq.delete(k);
    }
  }
}
