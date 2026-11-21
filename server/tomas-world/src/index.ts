/**
 * RASCUNHO NÃO EXECUTADO (T-219): esqueleto do Worker + Durable Object do mundo compartilhado.
 * Não foi compilado com wrangler nem implantado; não há D1 nem produção. Este arquivo fica
 * fora do `tsconfig` do jogo. Toda a lógica de regras está em `src/game/net/` (testada).
 *
 * Segurança: a autenticação FALHA FECHADA. Sem verificador real de token Firebase, só aceita
 * tokens `dev:<uid>` quando `ALLOW_INSECURE_DEV_TOKENS === 'true'` (apenas desenvolvimento local).
 */
import { WorldAuthority } from '../../../src/game/net/authority';
import { parseClientMessage, type ServerMessage } from '../../../src/game/net/protocol';

interface Env {
  WORLD: DurableObjectNamespace;
  ALLOW_INSECURE_DEV_TOKENS?: string;
}

/** TODO(T-219): verificar o ID token do Firebase (assinatura, aud, iss, exp, revogação). */
async function verifyToken(token: string, env: Env): Promise<string | null> {
  if (env.ALLOW_INSECURE_DEV_TOKENS === 'true' && /^dev:[a-z0-9_-]{3,40}$/i.test(token)) return token.slice(4);
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const worldId = new URL(request.url).searchParams.get('world') ?? '';
    if (!/^[a-z0-9-]{1,64}$/.test(worldId)) return new Response('mundo inválido', { status: 400 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('esperado WebSocket', { status: 426 });
    return env.WORLD.get(env.WORLD.idFromName(worldId)).fetch(request);
  },
};

interface Attachment { uid: string; sessionId: string }

/** Um Durable Object por mundo: estado vivo e relógio lógico próprios. */
export class WorldRoom {
  private readonly authority = new WorldAuthority();

  public constructor(private readonly state: DurableObjectState, private readonly env: Env) {}

  public async fetch(_request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    this.state.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  public async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const message = parseClientMessage(typeof raw === 'string' ? raw : null);
    if (!message) return this.send(ws, { t: 'error', reason: 'bad_message' });
    const now = Date.now();
    const attached = ws.deserializeAttachment() as Attachment | null;

    if (message.t === 'hello') {
      if (attached) return;
      const uid = await verifyToken(message.token, this.env);
      if (!uid) { this.send(ws, { t: 'error', reason: 'unauthorized' }); ws.close(4401, 'unauthorized'); return; }
      const result = this.authority.join(uid, now, message.v);
      if (result.replacedSessionId) {
        for (const other of this.state.getWebSockets()) {
          const a = other.deserializeAttachment() as Attachment | null;
          if (a?.sessionId === result.replacedSessionId) { this.send(other, { t: 'error', reason: 'replaced' }); other.close(4409, 'replaced'); }
        }
      }
      if (!result.ok) { for (const m of result.messages) this.send(ws, m); ws.close(4400, 'rejected'); return; }
      const welcome = result.messages[0];
      if (welcome.t === 'welcome') ws.serializeAttachment({ uid, sessionId: welcome.sessionId } satisfies Attachment);
      for (const m of result.messages) this.send(ws, m);
      return;
    }
    if (!attached) return this.send(ws, { t: 'error', reason: 'unauthorized' });
    for (const reply of this.authority.handle(attached.uid, attached.sessionId, message, now)) this.send(ws, reply);
  }

  public async webSocketClose(ws: WebSocket): Promise<void> {
    const attached = ws.deserializeAttachment() as Attachment | null;
    if (attached) this.authority.leave(attached.uid, attached.sessionId);
  }

  /** Difusão do estado; o relógio real virá de alarmes do Durable Object (T-010). */
  public broadcast(): void {
    const snapshot = JSON.stringify(this.authority.snapshot());
    for (const ws of this.state.getWebSockets()) ws.send(snapshot);
  }

  private send(ws: WebSocket, message: ServerMessage): void { ws.send(JSON.stringify(message)); }
}
