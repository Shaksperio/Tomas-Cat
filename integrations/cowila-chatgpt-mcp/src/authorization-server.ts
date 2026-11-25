import { WorkerEntrypoint } from "cloudflare:workers";
import {
  AuthorizationError,
  authorizationErrorRedirect,
  OAuthAuthorizationServer,
  type AuthRequest,
} from "@cloudflare/workers-oauth-provider";
import {
  exchangeGoogleAuthorizationCode,
  buildGoogleAuthorizationUrl,
} from "./google-oauth";
import { createPkcePair } from "./pkce";
import { isAllowedCowilaAuthorizationRequest } from "./oauth-policy";
import { exchangeGoogleTokenForFirebaseSession } from "./firebase-google-exchange";
import { saveFirebaseCredential, type D1DatabaseLike } from "./firebase-credential-store";
import {
  COWILA_ALLOWED_EMAIL,
  COWILA_AUTH_ISSUER,
  COWILA_GOOGLE_CALLBACK,
  COWILA_MCP_RESOURCE,
  COWILA_SCOPES,
} from "./config";

interface Env {
  OAUTH_KV: KVNamespace;
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  FIREBASE_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_VAULT_KEY: string;
}

interface UpstreamData {
  codeVerifier: string;
}

const authorizationServer = new OAuthAuthorizationServer<Env>({
  issuer: COWILA_AUTH_ISSUER,
  resources: [COWILA_MCP_RESOURCE],
  defaultResource: COWILA_MCP_RESOURCE,
  scopesSupported: [...COWILA_SCOPES],
  clientIdMetadataDocumentEnabled: true,
  clientRegistrationEndpoint: "/oauth/register",
  accessTokenTTL: 3600,
  refreshTokenTTL: 60 * 60 * 24 * 30,
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function html(content: string, headers = new Headers()): Response {
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  return new Response(content, { status: 200, headers });
}

function redirect(location: string, headers = new Headers()): Response {
  headers.set("location", location);
  headers.set("cache-control", "no-store");
  return new Response(null, { status: 302, headers });
}

function errorPage(message: string, status = 400, headers = new Headers()): Response {
  headers.set("content-type", "text/plain; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(message, { status, headers });
}

function validateResourceAndScope(request: AuthRequest): boolean {
  const resource = (request as AuthRequest & { resource?: string | string[] }).resource;
  return isAllowedCowilaAuthorizationRequest(resource, request.scope);
}

async function renderConsent(request: Request, env: Env): Promise<Response> {
  const oauth = authorizationServer.getOAuthApi(env);
  let authRequest: AuthRequest;
  try {
    authRequest = await oauth.parseAuthRequest(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.redirectTo) return redirect(error.redirectTo);
      return errorPage(error.description, 400);
    }
    return errorPage("Authorization request could not be validated.", 400);
  }

  if (!validateResourceAndScope(authRequest)) {
    return errorPage("This Cowila connector only grants mcp:read for its registered MCP resource.", 400);
  }

  const client = await oauth.lookupClient(authRequest.clientId);
  if (!client) return errorPage("Unknown OAuth client.", 400);

  let description;
  try {
    description = await oauth.describeConsent(authRequest);
  } catch {
    return errorPage("OAuth client details could not be verified.", 400);
  }
  const transaction = await oauth.beginConsent(authRequest);
  const clientName = escapeHtml(description.clientName);
  const redirectHost = escapeHtml(description.redirectHost);
  const clientDomain = description.clientDomain
    ? "<p><strong>Verified client domain:</strong> " + escapeHtml(description.clientDomain) + "</p>"
    : "<p><strong>Unverified application name:</strong> this client supplied its own name; it has not been verified.</p>";
  const loopbackWarning = description.redirectIsLoopback
    ? "<p role=\"alert\"><strong>Warning:</strong> the redirect goes to a local application; another local process may be listening there.</p>"
    : "";
  const body =
    "<!doctype html><html lang=\"pt-BR\"><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>Autorizar Cowila</title><body style=\"font:16px system-ui;max-width:620px;margin:48px auto;padding:0 20px;background:#10131a;color:#f3f5f7\">" +
    "<h1>Conectar ao histórico da Cowila</h1><p>O aplicativo <strong>" + clientName +
    "</strong> solicita acesso de leitura ao seu histórico Cowila.</p>" + clientDomain + loopbackWarning +
    "<p><strong>Destino de retorno:</strong> " + redirectHost + "</p>" +
    "<p><strong>Permissão:</strong> leitura (mcp:read). Nenhuma mensagem será alterada ou excluída.</p>" +
    "<p>Ao continuar, você será encaminhado ao Google para confirmar sua identidade.</p>" +
    "<form method=\"post\" action=\"/authorize/consent\"><input type=\"hidden\" name=\"handle\" value=\"" +
    escapeHtml(transaction.handle) + "\"><button name=\"decision\" value=\"approve\">Continuar com Google</button>" +
    "<button name=\"decision\" value=\"deny\">Cancelar</button></form></body></html>";
  return html(body, transaction.headers);
}

async function handleConsentPost(request: Request, env: Env): Promise<Response> {
  const form = await request.formData().catch(() => null);
  const handle = form?.get("handle");
  const decision = form?.get("decision");
  if (typeof handle !== "string" || handle.length < 16 || handle.length > 512) {
    return errorPage("Consentimento inválido ou expirado.", 400);
  }
  const oauth = authorizationServer.getOAuthApi(env);

  if (decision === "deny") {
    try {
      const denied = await oauth.denyConsent(request, handle);
      return redirect(denied.redirectTo, denied.headers);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return errorPage("O pedido de consentimento expirou. Reinicie a conexão.", 400);
      }
      throw error;
    }
  }
  if (decision !== "approve") return errorPage("Decisão de consentimento inválida.", 400);

  try {
    const approved = await oauth.approveConsent(request, handle, { scope: ["mcp:read"] });
    if (!validateResourceAndScope(approved.request)) {
      return errorPage("O recurso ou escopo solicitado não é permitido.", 400, approved.headers);
    }

    const pkce = await createPkcePair();
    const upstream = await oauth.beginUpstream(approved.request, {
      data: { codeVerifier: pkce.verifier } satisfies UpstreamData,
      headers: approved.headers,
    });
    const location = buildGoogleAuthorizationUrl({
      clientId: env.GOOGLE_CLIENT_ID,
      redirectUri: COWILA_GOOGLE_CALLBACK,
      state: upstream.state,
      codeChallenge: pkce.challenge,
    });
    return redirect(location, upstream.headers);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return errorPage("Não foi possível iniciar a autenticação Google. Reinicie a conexão.", 400);
    }
    throw error;
  }
}

async function handleGoogleCallback(request: Request, env: Env): Promise<Response> {
  const oauth = authorizationServer.getOAuthApi(env);
  let resumed;
  try {
    resumed = await oauth.finishUpstream<UpstreamData>(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return errorPage("A sessão OAuth expirou ou não corresponde a este navegador. Reinicie a conexão.", 400);
    }
    throw error;
  }

  // Reject mismatched resource/scope before exchanging credentials or persisting a Firebase refresh token.
  if (!validateResourceAndScope(resumed.request)) {
    return errorPage("O pedido OAuth não corresponde ao recurso Cowila permitido.", 400, resumed.headers);
  }

  const url = new URL(request.url);
  if (url.searchParams.has("error")) {
    return redirect(authorizationErrorRedirect(resumed.request, "access_denied"), resumed.headers);
  }
  const code = url.searchParams.get("code");
  if (!code || !resumed.data || typeof resumed.data.codeVerifier !== "string") {
    return errorPage("O retorno do Google está incompleto.", 400, resumed.headers);
  }

  try {
    const google = await exchangeGoogleAuthorizationCode({
      code,
      codeVerifier: resumed.data.codeVerifier,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: COWILA_GOOGLE_CALLBACK,
    });
    const firebase = await exchangeGoogleTokenForFirebaseSession({
      googleAccessToken: google.accessToken,
      firebaseApiKey: env.FIREBASE_API_KEY,
      firebaseProjectId: env.FIREBASE_PROJECT_ID,
      allowedEmail: COWILA_ALLOWED_EMAIL,
      callbackUri: COWILA_GOOGLE_CALLBACK,
    });

    await saveFirebaseCredential(
      env.DB as unknown as D1DatabaseLike,
      { uid: firebase.uid, email: firebase.email, refreshToken: firebase.refreshToken },
      env.FIREBASE_VAULT_KEY,
    );

    const client = await oauth.lookupClient(resumed.request.clientId);
    const completed = await oauth.completeAuthorization({
      request: resumed.request,
      userId: firebase.uid,
      metadata: { clientName: client?.clientName ?? "ChatGPT" },
      scope: ["mcp:read"],
      props: { userId: firebase.uid, email: firebase.email },
    });
    return redirect(completed.redirectTo, resumed.headers);
  } catch {
    return errorPage("Não foi possível validar a conta Google/Firebase ou concluir a autorização.", 401, resumed.headers);
  }
}

export default class CowilaAuthorizationWorker extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/authorize" && request.method === "GET") {
      return renderConsent(request, this.env);
    }
    if (url.pathname === "/authorize/consent" && request.method === "POST") {
      return handleConsentPost(request, this.env);
    }
    if (url.pathname === "/google/callback" && request.method === "GET") {
      return handleGoogleCallback(request, this.env);
    }
    return authorizationServer.fetch(request, this.env, this.ctx);
  }

  validateToken(resource: string, token: string) {
    return authorizationServer.validateToken(resource, token, this.env);
  }
}
