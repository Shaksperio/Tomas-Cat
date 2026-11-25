import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestHarness } from "wrangler";

const AUTH_SERVER = { configPath: "./wrangler.auth.test.jsonc" };
const MCP_SERVER = { configPath: "./wrangler.resource.test.jsonc" };

const harness = createTestHarness({ workers: [AUTH_SERVER, MCP_SERVER] });
const auth = harness.getWorker("cowila-auth-runtime-test");
const mcp = harness.getWorker("cowila-mcp-runtime-test");

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
        params: {},
      }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
  });
});
