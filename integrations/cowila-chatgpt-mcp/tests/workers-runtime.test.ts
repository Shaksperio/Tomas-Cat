import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestHarness } from "wrangler";

const AUTH_SERVER = { configPath: "./wrangler.auth.test.jsonc" };
const MCP_SERVER = { configPath: "./wrangler.resource.test.jsonc" };
const AUTH_TOKEN_FIXTURE = { configPath: "./wrangler.auth.fixture.test.jsonc" };
const AUTHENTICATED_MCP_SERVER = { configPath: "./wrangler.resource.authenticated.test.jsonc" };

const harness = createTestHarness({
  workers: [AUTH_SERVER, MCP_SERVER, AUTH_TOKEN_FIXTURE, AUTHENTICATED_MCP_SERVER],
});
const auth = harness.getWorker("cowila-auth-runtime-test");
const mcp = harness.getWorker("cowila-mcp-runtime-test");
const authFixture = harness.getWorker("cowila-auth-token-fixture");
const authenticatedMcp = harness.getWorker("cowila-mcp-authenticated-runtime-test");

const AUTH_ISSUER = "https://cowila-auth.example.invalid";
const MCP_RESOURCE = "https://cowila-mcp.example.invalid/mcp";

beforeAll(() => harness.listen());
afterAll(() => harness.close());

describe("Cowila Workers runtime boundary", () => {
  it("serves OAuth authorization-server metadata in workerd", async () => {
    const response = await auth.fetch(
      new URL("/.well-known/oauth-authorization-server", AUTH_ISSUER),
    );

    expect(response.status).toBe(200);
    const metadata = (await response.json()) as Record<string, unknown>;
    expect(metadata.issuer).toBe(AUTH_ISSUER);
    expect(metadata.authorization_endpoint).toBe(
      new URL("/authorize", AUTH_ISSUER).toString(),
    );
    expect(metadata.token_endpoint).toBe(
      new URL("/oauth/token", AUTH_ISSUER).toString(),
    );
  });

  it("publishes protected-resource metadata and challenges unauthenticated MCP calls", async () => {
    const response = await mcp.fetch(MCP_RESOURCE);

    expect(response.status).toBe(401);
    const challenge = response.headers.get("www-authenticate") ?? "";
    expect(challenge).toContain("resource_metadata=");

    const metadataUrl = /resource_metadata="([^"]+)"/.exec(challenge)?.[1];
    expect(metadataUrl).toBeTruthy();

    const metadataResponse = await mcp.fetch(metadataUrl!);
    expect(metadataResponse.status).toBe(200);
    const metadata = (await metadataResponse.json()) as {
      resource: string;
      authorization_servers: string[];
      bearer_methods_supported?: string[];
    };
    expect(metadata.resource).toBe(MCP_RESOURCE);
    expect(metadata.authorization_servers).toEqual([AUTH_ISSUER]);
    expect(metadata.bearer_methods_supported).toEqual(["header"]);
  });

  it("rejects malformed bearer tokens through the real Service Binding", async () => {
    const response = await mcp.fetch(MCP_RESOURCE, {
      headers: { Authorization: "Bearer definitely-not-a-valid-cowila-token" },
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("does not expose MCP tools before authentication", async () => {
    const response = await mcp.fetch(MCP_RESOURCE, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} } },
      }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
  });

  it("runs dynamic registration, browser-bound consent, Google PKCE redirect, and safe denial in workerd", async () => {
    const registration = await auth.fetch(new URL("/oauth/register", AUTH_ISSUER), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Cowila runtime test client",
        redirect_uris: ["https://client.example/callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
      }),
    });
    expect(registration.status).toBe(201);
    const client = (await registration.json()) as { client_id: string };
    expect(client.client_id).toBeTruthy();

    const verifier = "cowila-runtime-test-verifier-0123456789-abcdefghijklmnopqrstuvwxyz";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
    const authorizationUrl = new URL("/authorize", AUTH_ISSUER);
    for (const [key, value] of Object.entries({
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: "https://client.example/callback",
      scope: "mcp:read",
      state: "cowila-state-runtime",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: MCP_RESOURCE,
    })) authorizationUrl.searchParams.set(key, value);

    const consent = await auth.fetch(authorizationUrl);
    expect(consent.status).toBe(200);
    const consentHtml = await consent.text();
    const handle = /name="handle" value="([^"]+)"/.exec(consentHtml)?.[1];
    expect(handle).toBeTruthy();
    const consentCookie = consent.headers.get("set-cookie")?.split(";")[0];
    expect(consentCookie).toBeTruthy();

    const consentPostUrl = new URL("/authorize/consent", AUTH_ISSUER);
    const consentPostBody = new URLSearchParams({ handle: handle!, decision: "approve" });
    const wrongBrowser = await auth.fetch(consentPostUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: consentPostBody,
    });
    expect(wrongBrowser.status).toBe(400);

    const approved = await auth.fetch(consentPostUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: consentCookie!,
      },
      body: consentPostBody,
      redirect: "manual",
    });
    expect(approved.status).toBe(302);
    const googleUrl = new URL(approved.headers.get("location")!);
    expect(googleUrl.hostname).toBe("accounts.google.com");
    expect(googleUrl.searchParams.get("state")).toBeTruthy();
    expect(googleUrl.searchParams.get("code_challenge_method")).toBe("S256");

    const setCookieHeaders = approved.headers.get("set-cookie") ?? "";
    const upstreamCookie = /(__Host-oauth-upstream-[^=]+=[^;,]*)/.exec(setCookieHeaders)?.[1];
    expect(upstreamCookie).toBeTruthy();
    const cookies = [consentCookie, upstreamCookie].filter(Boolean).join("; ");
    const callbackUrl = new URL("/google/callback", AUTH_ISSUER);
    callbackUrl.searchParams.set("error", "access_denied");
    callbackUrl.searchParams.set("state", googleUrl.searchParams.get("state")!);
    const callback = await auth.fetch(callbackUrl, {
      headers: { cookie: cookies },
      redirect: "manual",
    });
    expect(callback.status).toBe(302);
    const deniedRedirect = new URL(callback.headers.get("location")!);
    expect(deniedRedirect.origin + deniedRedirect.pathname).toBe("https://client.example/callback");
    expect(deniedRedirect.searchParams.get("error")).toBe("access_denied");
    expect(deniedRedirect.searchParams.get("state")).toBe("cowila-state-runtime");
    expect(deniedRedirect.searchParams.get("iss")).toBe(AUTH_ISSUER);
  });

  it("issues a real local OAuth token and reaches authenticated MCP tools through the Service Binding", async () => {
    const registration = await authFixture.fetch(new URL("/oauth/register", AUTH_ISSUER), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Cowila authenticated runtime test",
        redirect_uris: ["https://client.example/callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
      }),
    });
    expect(registration.status).toBe(201);
    const client = (await registration.json()) as { client_id: string };

    const verifier = "cowila-authenticated-runtime-verifier-0123456789";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
    const authorizeUrl = new URL("/test/authorize", AUTH_ISSUER);
    for (const [key, value] of Object.entries({
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: "https://client.example/callback",
      scope: "mcp:read",
      state: "cowila-authorized-runtime-state",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: MCP_RESOURCE,
    })) authorizeUrl.searchParams.set(key, value);

    const authorization = await authFixture.fetch(authorizeUrl, { redirect: "manual" });
    expect(authorization.status).toBe(302);
    const code = new URL(authorization.headers.get("location")!).searchParams.get("code");
    expect(code).toBeTruthy();

    const tokenResponse = await authFixture.fetch(new URL("/oauth/token", AUTH_ISSUER), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code!,
        redirect_uri: "https://client.example/callback",
        client_id: client.client_id,
        code_verifier: verifier,
        resource: MCP_RESOURCE,
      }),
    });
    expect(tokenResponse.status).toBe(200);
    const tokens = (await tokenResponse.json()) as { access_token: string; token_type: string };
    expect(tokens.token_type.toLowerCase()).toBe("bearer");
    expect(tokens.access_token).toBeTruthy();

    const toolsList = await authenticatedMcp.fetch(MCP_RESOURCE, {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokens.access_token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2026-07-28",
        "Mcp-Method": "tools/list",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} } },
      }),
    });
    const toolsBody = await toolsList.text();
    expect(toolsList.status, toolsBody).toBe(200);
    expect(toolsBody).toContain("cowila_get_training_summary");
    expect(toolsBody).toContain("cowila_get_recent_messages");
    expect(toolsBody).toContain("cowila_search_messages");

    const summary = await authenticatedMcp.fetch(MCP_RESOURCE, {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokens.access_token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2026-07-28",
        "Mcp-Method": "tools/call",
        "Mcp-Name": "cowila_get_training_summary",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} }, name: "cowila_get_training_summary", arguments: {} },
      }),
    });
    const summaryBody = await summary.text();
    expect(summary.status, summaryBody).toBe(200);
    expect(summaryBody).toContain("Cowila training record does not exist yet");
  });
});
