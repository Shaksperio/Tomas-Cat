/**
 * Declarações mínimas dos tipos de runtime do Cloudflare Workers usados pelo esqueleto.
 * Existem só para o `npm run lint` do projeto compilar `server/` sem instalar
 * `@cloudflare/workers-types`. Substituir pelo pacote oficial quando o Worker for provisionado.
 */
interface DurableObjectState {
  acceptWebSocket(ws: WebSocket): void;
  getWebSockets(): WebSocket[];
}
interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}
declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}
interface WebSocket {
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}
interface ResponseInit {
  webSocket?: WebSocket | null;
}
