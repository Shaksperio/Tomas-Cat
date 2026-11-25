# Cowila — ChatGPT MCP connector (proof of concept)

**Status: isolated authentication and Firestore access primitives implemented; OAuth server and MCP endpoint are not yet implemented. Not deployed, not connected to real Firestore, and not registered in ChatGPT.**

This directory is reserved by task T-223. It remains isolated from `workers/`, existing Firebase rules/data, and the game's production runtime.

## Implemented and tested

- `src/firebase-auth.ts`: Firebase Secure Token refresh exchange, strict linked-UID equality, expiry validation, and sanitized errors.
- `src/secret-vault.ts`: AES-256-GCM envelope encryption for Firebase refresh tokens using a 32-byte runtime key.
- `src/firebase-identity.ts`: verifies Firebase ID token signatures against Google's Secure Token JWKS; enforces exact issuer/audience, permitted verified operator email, UID, expiry, and recent authentication.
- `src/google-oauth.ts`: Google authorization URL with S256 PKCE, offline access and identity scopes; code exchange using the server-held verifier.
- `src/firebase-google-exchange.ts`: exchanges a short-lived Google OAuth access token through Firebase Identity Toolkit `accounts:signInWithIdp`, verifies the Firebase ID token and UID/email consistency.
- `src/firebase-credential-store.ts` and `migrations/0001_firebase_link_credentials.sql`: D1 credential-store abstraction and schema; only the AES-GCM envelope is persisted.
- `src/firestore-cowila.ts`: read-only REST client restricted to `users/{uid}/cowilaLab/real-training-v2`, using a delegated Firebase ID token so Firestore Security Rules still apply.
- `src/cowila-service.ts`: retrieves the encrypted credential, refreshes Firebase, persists rotated refresh credentials encrypted, and then reads the v2 document. Firebase ID tokens remain server-side.
- Unit tests for these modules, including PKCE, encryption/rotation/unlink, refresh orchestration, Firestore path/ownership/schema/limits, malformed provider responses, forged signatures, expiry, UID mismatch and HTTPS callback checks.

Latest verified workflow: GitHub Actions run #51, commit `f51b68a4a60625ede0e442db7a5b77316b4ca11a`, completed successfully. The preceding fully inspected test run #49 reported **48 tests passed, 0 failed**, with TypeScript strict passing. Run #51 is green on the same implementation plus documentation/PR updates; its individual test count has not been re-read here.

## What is not implemented

- No Cloudflare OAuth Authorization Server or Google callback wired to the primitives.
- No MCP Streamable HTTP Resource Server or callable MCP tools.
- No D1 binding/database provisioned and no migration applied.
- No production secrets, Worker deployment, real Firestore reads, or ChatGPT connection.
- No proof yet that a custom connector is available in the user's ChatGPT plan or Android app.

## Security boundaries

- No service-account bypass. Firestore requests use the linked user's Firebase ID token, preserving Firestore Security Rules.
- Never persist plaintext refresh tokens. The encryption key must be a Cloudflare Worker Secret, not D1 or frontend configuration.
- Never accept UID as an MCP tool argument; derive it from the authenticated OAuth principal's server-side link.
- No arbitrary Firestore paths, writes, deletes, bulk export, or production access during this stage.
- D1 migration, secret provisioning, deployment, and any real-data test require explicit human approval.

## Next implementation gates

1. Verify the current Cloudflare OAuth Provider API and ChatGPT's remote MCP OAuth contract from primary documentation/source.
2. Implement the authorization server, consent, single-use state, Google callback, Firebase identity exchange, and secure credential persistence.
3. Implement a separate MCP resource server using Streamable HTTP, exact resource audience, and enforced `mcp:read`.
4. Add contract tests and run the handlers in a local Workers-compatible runtime.
5. Validate against an isolated Firebase test project. Only then request approval for production configuration and read-only diagnosis.
