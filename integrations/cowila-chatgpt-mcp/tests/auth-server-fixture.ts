import { WorkerEntrypoint } from "cloudflare:workers";
import { OAuthAuthorizationServer } from "@cloudflare/workers-oauth-provider";
import {
  COWILA_ALLOWED_EMAIL,
  COWILA_AUTH_ISSUER,
  COWILA_MCP_RESOURCE,
  COWILA_SCOPES,
} from "../src/config";

interface Env {
  OAUTH_KV: KVNamespace;
}

const oauthServer = new OAuthAuthorizationServer<Env>({
  issuer: COWILA_AUTH_ISSUER,
  resources: [COWILA_MCP_RESOURCE],
  defaultResource: COWILA_MCP_RESOURCE,
  scopesSupported: [...COWILA_SCOPES],
  clientRegistrationEndpoint: "/oauth/register",
  accessTokenTTL: 3600,
});

export default class CowilaAuthTokenFixture extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/test/authorize" && request.method === "GET") {
      const authorizationUrl = new URL(request.url);
      authorizationUrl.pathname = "/authorize";
      const authRequest = await oauthServer.getOAuthApi(this.env).parseAuthRequest(
        new Request(authorizationUrl, { headers: request.headers }),
      );
      const client = await oauthServer.getOAuthApi(this.env).lookupClient(authRequest.clientId);
      if (!client) return new Response("Unknown test client", { status: 400 });
      const completed = await oauthServer.getOAuthApi(this.env).completeAuthorization({
        request: authRequest,
        userId: "cowila-runtime-user",
        metadata: { clientName: client.clientName ?? "Cowila runtime test client" },
        scope: ["mcp:read"],
        props: {
          userId: "cowila-runtime-user",
          email: COWILA_ALLOWED_EMAIL,
        },
      });
      return new Response(null, {
        status: 302,
        headers: { location: completed.redirectTo, "cache-control": "no-store" },
      });
    }
    return oauthServer.fetch(request, this.env, this.ctx);
  }

  validateToken(resource: string, token: string) {
    return oauthServer.validateToken(resource, token, this.env);
  }
}
