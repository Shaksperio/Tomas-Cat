import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedCowilaAuthorizationRequest } from "./oauth-policy";

test("accepts only the exact Cowila resource and read scope", () => {
  assert.equal(
    isAllowedCowilaAuthorizationRequest("https://cowila-mcp.example.invalid/mcp", ["mcp:read"]),
    true,
  );
});

test("rejects missing, duplicate, or additional scopes", () => {
  assert.equal(isAllowedCowilaAuthorizationRequest("https://cowila-mcp.example.invalid/mcp", []), false);
  assert.equal(isAllowedCowilaAuthorizationRequest("https://cowila-mcp.example.invalid/mcp", ["mcp:read", "mcp:write"]), false);
  assert.equal(isAllowedCowilaAuthorizationRequest("https://cowila-mcp.example.invalid/mcp", ["mcp:read", "mcp:read"]), false);
});

test("rejects missing, multiple, or unregistered resource indicators", () => {
  assert.equal(isAllowedCowilaAuthorizationRequest(undefined, ["mcp:read"]), false);
  assert.equal(isAllowedCowilaAuthorizationRequest(["https://cowila-mcp.example.invalid/mcp", "https://other.example/mcp"], ["mcp:read"]), false);
  assert.equal(isAllowedCowilaAuthorizationRequest("https://other.example/mcp", ["mcp:read"]), false);
});
