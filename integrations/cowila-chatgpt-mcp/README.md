# Cowila — ChatGPT MCP connector

**Status:** isolated Authorization Worker and MCP Resource Worker source implemented; TypeScript strict and 49 unit tests pass in GitHub Actions run #78. Not deployed, not connected to production Firestore, and not registered in ChatGPT.

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
- GitHub Actions workflow installs isolated dependencies, type-checks the complete integration and runs unit tests.

## Latest verification

GitHub Actions run **#74** on commit `fcb76c5e85b15204a12e703e28b095867c704dbb` completed successfully:
- TypeScript strict check: passed.
- Unit tests: **49 passed, 0 failed**.

These are unit tests and compile checks. They do not prove OAuth browser round-trip, Worker runtime compatibility, real Google/Firebase sign-in, Firestore permission behavior against the real project, or ChatGPT client compatibility.

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

1. Add isolated Worker runtime/integration tests for OAuth consent, Google callback, token validation and MCP tool calls (including denial, expired state, UID mismatch and missing scope).
2. Run local Workers runtime tests with mock KV/D1 and mocked Google/Firebase/Firestore endpoints.
3. Provision a separate Firebase development project and test the full delegated identity flow.
4. Approve real hostnames, OAuth Google client, KV/D1 resources and secrets.
5. Apply D1 migration and deploy only after explicit approval; then validate the real read-only path.
6. Register the MCP endpoint in ChatGPT and test actual availability in the Android app. No such connection has been made yet.

The PR remains Draft until the runtime integration tests and development-project validation are complete.
