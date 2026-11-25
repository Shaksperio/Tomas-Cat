# Cowila — ChatGPT MCP connector (proof of concept)

**Status: security primitives only. Not deployed, not connected to Firestore, and not registered in ChatGPT.**

This directory is reserved by task T-223. It must remain isolated from `workers/`, existing Firebase rules/data, and the game's production runtime.

## Implemented

- `src/firebase-auth.ts`: Firebase Secure Token refresh exchange, strict linked-UID equality, expiry validation, and sanitized errors.
- `src/secret-vault.ts`: AES-256-GCM envelope encryption for Firebase refresh tokens using a 32-byte runtime key.
- `src/firebase-identity.ts`: verifies Firebase ID token signature against Google's Secure Token JWKS; enforces exact issuer/audience, permitted verified operator email, UID, expiry, and recent authentication (10-minute maximum auth age).
- `src/firebase-google-exchange.ts`: exchanges a short-lived Google OAuth access token through Firebase Identity Toolkit `accounts:signInWithIdp`, verifies the returned signed Firebase ID token and UID/email consistency, and returns the Firebase refresh token only to the trusted server caller for immediate encryption.
- Unit tests for all four modules, including forged signatures, malformed/expired identity claims, mismatched UID, invalid provider response, and non-HTTPS callback rejection.

## Run tests

From the repository root:

```bash
npx --yes tsx@4.21.0 --test integrations/cowila-chatgpt-mcp/src/*.test.ts
```

Latest CI result: **17 tests passed, 0 failed** (GitHub Actions run #9, Node 22). This is unit-test evidence only, not a Workers deployment/runtime certification.

## Explicit non-goals of this increment

- No OAuth authorization server or MCP HTTP endpoint.
- No Google/Firebase account-linking page or callback. The Google-to-Firebase token-exchange primitive exists, but it is not yet wired to Cloudflare's OAuth callback.
- No D1 binding, schema, migration, Worker deployment, or secret provisioning.
- No Firestore reads or writes.
- No access to production Cowila history.
- No credentials, API keys, tokens, or real account identifiers in source.

## Security notes

The caller must persist only the encrypted envelope returned by `encryptRefreshToken`; never persist the plaintext refresh token. The encryption key must be a Cloudflare Worker Secret, not a D1 value or frontend-exposed variable. Key rotation needs a versioned re-encryption procedure before production.

The identity verifier validates a signed Firebase ID token but does not establish the account link itself. A secure callback still needs single-use state, exact redirect URI checks, OAuth principal binding, and a protected credential handoff. No token should be copied into ChatGPT messages or tool arguments.

## Next gates

1. Validate the current Cloudflare OAuth provider APIs and exact ChatGPT MCP authorization contract.
2. Implement single-use state and the Google/Firebase account-linking callback; prove the refresh token can be handed to the server without manual copy/paste.
3. Add encrypted D1 persistence, refresh-token rotation, unlink, and revocation.
4. Build and test the MCP Streamable HTTP handler, scopes, audience, and per-principal Firebase UID binding.
5. Test in Cloudflare Workers runtime and with an isolated Firebase test project before any production read.
