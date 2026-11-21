import type { ClientMessage, PlayerState, RejectReason, ServerMessage, Vec3 } from './protocol';
import { PROTOCOL_VERSION } from './protocol';

export interface AuthorityConfig {
  worldBounds: number;
  /** Velocidade horizontal máxima legítima (m/s), já com sprint. */
  maxSpeed: number;
  /** Folga fixa para jitter de rede (m). */
  slack: number;
  maxPlayers: number;
  minMoveIntervalMs: number;
  maxStrikes: number;
  spawn: Vec3;
}

export const DEFAULT_AUTHORITY_CONFIG: AuthorityConfig = {
  worldBounds: 220, maxSpeed: 16, slack: 1.5, maxPlayers: 32, minMoveIntervalMs: 30, maxStrikes: 8, spawn: { x: 0, y: 0, z: 0 },
};

interface Session {
  uid: string;
  sessionId: string;
  fence: number;
  state: PlayerState;
  lastSeq: number;
  lastMoveAtMs: number;
  strikes: number;
}

export interface JoinResult {
  ok: boolean;
  messages: ServerMessage[];
  /** Sessão antiga do mesmo UID que deve ser fechada (lease exclusivo). */
  replacedSessionId?: string;
}

/**
 * Autoridade do mundo, pura e determinística (sem rede, sem relógio global: o tempo
 * entra como parâmetro). O Durable Object só transporta mensagens para cá.
 * Um UID tem no máximo UMA sessão; a mais nova invalida a anterior (fencing token).
 */
export class WorldAuthority {
  private readonly sessions = new Map<string, Session>();
  private fenceCounter = 0;
  private tickCount = 0;

  public constructor(private readonly config: AuthorityConfig = DEFAULT_AUTHORITY_CONFIG) {}

  public get tick(): number { return this.tickCount; }
  public advanceTick(): number { this.tickCount += 1; return this.tickCount; }

  /** `uid` vem de token JÁ verificado fora daqui; o cliente nunca escolhe o próprio UID. */
  public join(uid: string, nowMs: number, version: number = PROTOCOL_VERSION): JoinResult {
    if (version !== PROTOCOL_VERSION) return { ok: false, messages: [{ t: 'error', reason: 'bad_version' }] };
    const previous = this.sessions.get(uid);
    if (!previous && this.sessions.size >= this.config.maxPlayers) return { ok: false, messages: [{ t: 'error', reason: 'world_full' }] };
    this.fenceCounter += 1;
    const sessionId = `s${this.fenceCounter}`;
    const state: PlayerState = previous ? { ...previous.state } : { id: uid, ...this.config.spawn, ry: 0 };
    this.sessions.set(uid, { uid, sessionId, fence: this.fenceCounter, state, lastSeq: 0, lastMoveAtMs: nowMs, strikes: 0 });
    return {
      ok: true,
      replacedSessionId: previous?.sessionId,
      messages: [{ t: 'welcome', v: PROTOCOL_VERSION, playerId: uid, sessionId, tick: this.tickCount, self: { ...state }, players: this.players() }],
    };
  }

  public leave(uid: string, sessionId: string): void {
    if (this.sessions.get(uid)?.sessionId === sessionId) this.sessions.delete(uid);
  }

  public handle(uid: string, sessionId: string, message: ClientMessage, nowMs: number): ServerMessage[] {
    const session = this.sessions.get(uid);
    if (!session || session.sessionId !== sessionId) return [{ t: 'error', reason: 'replaced' }];
    if (message.t === 'ping') return [{ t: 'pong', n: message.n }];
    if (message.t !== 'move') return [{ t: 'error', reason: 'bad_message' }];

    const reject = (reason: RejectReason): ServerMessage[] => {
      session.strikes += 1;
      if (session.strikes >= this.config.maxStrikes) {
        this.sessions.delete(uid);
        return [{ t: 'error', reason: 'too_many_violations' }];
      }
      const { x, y, z } = session.state;
      return [{ t: 'reject', seq: message.seq, reason, at: { x, y, z } }];
    };

    if (message.seq <= session.lastSeq) return reject('stale_sequence');
    const elapsed = nowMs - session.lastMoveAtMs;
    if (elapsed < this.config.minMoveIntervalMs) return reject('rate_limited');
    const b = this.config.worldBounds;
    if (Math.abs(message.x) > b || Math.abs(message.z) > b || Math.abs(message.y) > b) return reject('out_of_bounds');
    const allowed = this.config.maxSpeed * (elapsed / 1000) + this.config.slack;
    if (Math.hypot(message.x - session.state.x, message.z - session.state.z) > allowed) return reject('too_fast');

    session.lastSeq = message.seq;
    session.lastMoveAtMs = nowMs;
    session.state = { id: uid, x: message.x, y: message.y, z: message.z, ry: message.ry };
    return [];
  }

  public players(): PlayerState[] {
    return [...this.sessions.values()].map((s) => ({ ...s.state })).sort((a, b) => a.id.localeCompare(b.id));
  }

  public snapshot(): ServerMessage { return { t: 'snapshot', tick: this.tickCount, players: this.players() }; }
}
