# Cowila — ChatGPT MCP connector

**Status:** isolated Authorization Worker and MCP Resource Worker implemented; TypeScript strict, 52 unit tests and 5 Workers runtime tests pass in GitHub Actions run #117. Not deployed, not connected to production Firestore, and not registered in ChatGPT.

## Implemented

- Firebase Secure Token refresh with expected-UID equality and sanitized errors.
- AES-256-GCM envelope encryption for Firebase refresh tokens.
- Firebase ID-token RS256/JWKS verification, exact issuer/audience, verified operator email, UID, expiry and recent-authentication checks.
- Google authorization-code flow with S256 PKCE and HTTPS callback validation.
- Google-to-Firebase Identity Toolkit exchange.
- D1 credential repository and SQL migration. The migration has not been applied.
- Read-only Firestore REST reader restricted to `users/{uid}/cowilaLab/real-training-v2`, using the delegated Firebase ID token and preserving Firestore Security Rules.
- Credential refresh/rotation service; ID tokens and refresh tokens never reach MCP tool responses.
- **Authorization Worker** (`src/authorization-server.ts`): Cloudflare `OAuthAuthorizationServer`, exact resource/scope checks, client consent page, one-use browser-bound consent handle, Google upstream redirect, callback state validation, Firebase identity exchange, encrypted D1 credential persistence and OAuth grant completion.
- **Resource Worker** (`src/resource-server.ts`): Cloudflare `OAuthResourceServer`, Service Binding token validation, exact audience, verified UID props and enforced `mcp:read`.
- MCP Streamable HTTP handler using Cloudflare Agents SDK `createMcpHandler` and MCP SDK v2, stateless mode with legacy protocol lane rejected.
- Read-only tools:
  - `cowila_get_training_summary`
  - `cowila_get_recent_messages` (1–25 messages)
  - `cowila_search_messages` (bounded query and at most 20 results)
- Dedicated package manifest and strict TypeScript configuration.
- Local-only Wrangler configurations for two-Worker `workerd` tests, with local KV/D1 bindings and a real local Service Binding; no production IDs or domains.
- Runtime tests cover OAuth metadata, protected-resource challenge, invalid bearer validation through the Service Binding, unauthenticated MCP tool rejection, dynamic client registration, browser-bound consent, Google PKCE redirect and upstream denial callback.
- Exact OAuth grant policy rejects additional, duplicate or missing scopes and any resource other than the one registered.
- GitHub Actions installs isolated dependencies, type-checks the complete integration, runs unit tests and launches the Workers runtime suite.

## Latest verification

GitHub Actions run **#117** on commit `1c4883180b1d9d5d32b434edfcea5597dd3e766e` completed successfully:
- TypeScript strict check: passed.
- Unit tests: **52 passed, 0 failed**.
- Workers runtime suite in `workerd`: **5 passed, 0 failed**.
- Runtime coverage includes OAuth discovery, resource metadata, invalid-token validation through the actual local Service Binding, unauthenticated tool rejection, DCR, browser-bound consent, Google S256 PKCE redirect and a provider-denial callback redirected safely to the OAuth client.

This is a meaningful local runtime integration check, but not a full production OAuth round-trip. It does not prove successful Google authentication, Firebase Identity Toolkit exchange, D1 credential persistence/rotation, an authorized MCP tool read against Firestore, real-project Firestore rules, or ChatGPT client compatibility.

## Configuration intentionally not supplied

`src/config.ts` contains non-deployable `.example.invalid` placeholders for the authorization issuer, MCP resource and Google callback. They must be replaced only after selecting and approving real HTTPS hostnames.

The Authorization Worker requires:
- KV binding `OAUTH_KV` for Cloudflare OAuth provider state and grants.
- D1 binding `DB` for encrypted Firebase refresh credentials.
- Secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_VAULT_KEY`.

The Resource Worker requires:
- Service Binding `AUTH_SERVER` to the Authorization Worker.
- D1 binding `DB`.
- `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_ID`, `FIREBASE_API_KEY`, `FIREBASE_VAULT_KEY`.

The Authorization Worker also requires the Cloudflare compatibility flag `global_fetch_strictly_public` to enable CIMD client metadata lookup. The final Wrangler configurations must be created only after the real hostnames, KV namespace and D1 database have been explicitly selected. No IDs or secrets are invented here.

## Security boundaries

- No service-account bypass: Firestore reads use the delegated Firebase user's ID token.
- No arbitrary Firestore paths, writes, deletes, collection enumeration or bulk export.
- UID is derived from verified OAuth grant props, never from MCP arguments.
- OAuth access tokens are audience-bound to the exact MCP resource.
- Only `mcp:read` is granted.
- Firebase refresh token is encrypted before D1 persistence; vault key belongs in a Worker Secret.
- No changes to `workers/`, Firebase Security Rules, existing documents, production secrets or deployed infrastructure.

## Still required

1. Extend runtime tests to cover consent expiry/replay, token endpoint issuance/refresh, and a valid authorized MCP tool invocation with isolated Firebase/Firestore mocks.
2. Validate successful Google→Firebase exchange and D1 credential write/rotation in an isolated test project.
3. Provision a separate Firebase development project and test the full delegated identity flow.
4. Approve real hostnames, Google OAuth client, KV/D1 resources and secrets.
5. Apply the D1 migration and deploy only after explicit approval; then validate the real read-only path.
6. Register the MCP endpoint in ChatGPT and test actual availability in the Android app. No such connection has been made yet.

The PR remains Draft until the runtime integration tests and development-project validation are complete.
