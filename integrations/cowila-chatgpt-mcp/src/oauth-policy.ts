import { COWILA_MCP_RESOURCE } from "./config";

export function isAllowedCowilaAuthorizationRequest(
  resource: string | string[] | undefined,
  scopes: readonly string[],
): boolean {
  const resources = Array.isArray(resource) ? resource : resource ? [resource] : [];
  return (
    resources.length === 1 &&
    resources[0] === COWILA_MCP_RESOURCE &&
    scopes.length === 1 &&
    scopes[0] === "mcp:read"
  );
}
