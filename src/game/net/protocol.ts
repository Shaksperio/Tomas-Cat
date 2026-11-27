/**
 * Protocolo cliente↔servidor do mundo compartilhado (v1, rascunho de T-219).
 * O cliente envia INTENÇÕES; o servidor valida e responde com o estado autoritativo.
 * Nenhuma mensagem do cliente declara recursos, XP, construções ou resultado de combate.
 */
export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 2048;

export interface Vec3 { x: number; y: number; z: number }

export type ClientMessage =
  | { t: 'hello'; v: number; token: string; worldId: string }
  | { t: 'move'; seq: number; x: number; y: number; z: number; ry: number }
  | { t: 'ping'; n: number };

export interface PlayerState extends Vec3 { id: string; ry: number }

export type RejectReason = 'rate_limited' | 'out_of_bounds' | 'too_fast' | 'stale_sequence' | 'invalid' | 'not_joined';

export type ServerMessage =
  | { t: 'welcome'; v: number; playerId: string; sessionId: string; tick: number; self: PlayerState; players: PlayerState[] }
  | { t: 'snapshot'; tick: number; players: PlayerState[] }
  /** O cliente deve voltar para `at` (posição autoritativa). */
  | { t: 'reject'; seq: number; reason: RejectReason; at: Vec3 }
  | { t: 'pong'; n: number }
  | { t: 'error'; reason: 'bad_version' | 'unauthorized' | 'bad_message' | 'world_full' | 'replaced' | 'too_many_violations' };

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const text = (s: unknown, max: number): s is string => typeof s === 'string' && s.length > 0 && s.length <= max;

/** Validação estrita de entrada não confiável. Devolve null para qualquer mensagem inválida. */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.length > MAX_MESSAGE_BYTES) return null;
    try { value = JSON.parse(raw); } catch { return null; }
  }
  if (typeof value !== 'object' || value === null) return null;
  const m = value as Record<string, unknown>;
  switch (m.t) {
    case 'hello':
      return finite(m.v) && text(m.token, 1500) && text(m.worldId, 64) && /^[a-z0-9-]+$/.test(m.worldId)
        ? { t: 'hello', v: m.v, token: m.token, worldId: m.worldId } : null;
    case 'move':
      return Number.isInteger(m.seq) && finite(m.x) && finite(m.y) && finite(m.z) && finite(m.ry)
        ? { t: 'move', seq: m.seq as number, x: m.x, y: m.y, z: m.z, ry: m.ry } : null;
    case 'ping':
      return Number.isInteger(m.n) ? { t: 'ping', n: m.n as number } : null;
    default:
      return null;
  }
}
