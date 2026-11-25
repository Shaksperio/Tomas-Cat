# Cowila — ChatGPT MCP connector (proof of concept)

**Status: isolated security primitives only. Not deployed, not connected to Firestore, and not registered in ChatGPT.**

This directory is reserved by task T-223. It must remain isolated from `workers/`, the existing Firebase rules/data, and the game's production runtime.

## Implemented in this first code increment

- `src/firebase-auth.ts`: Firebase Secure Token refresh exchange, with strict linked-UID equality and sanitized errors.
- `src/secret-vault.ts`: AES-256-GCM envelope encryption for Firebase refresh tokens using a 32-byte key supplied at runtime.
- Unit tests for token refresh validation, UID mismatch, provider error sanitization, encryption/decryption, nonce uniqueness, invalid keys, tampering, and unsupported envelope versions.

## Run tests

From the repository root, with the existing `tsx` development dependency installed:

```bash
npx tsx --test integrations/cowila-chatgpt-mcp/src/*.test.ts
```

## Explicit non-goals of this increment

- No OAuth authorization server or MCP HTTP endpoint yet.
- No Google/Firebase account-linking page or callback.
- No D1 binding, schema, migration, Worker deployment, or secret provisioning.
- No Firestore reads or writes.
- No access to production Cowila history.
- No credentials, API keys, tokens, or real account identifiers in source.

## Security notes

The caller must persist only the encrypted envelope returned by `encryptRefreshToken`; never persist the plaintext refresh token. The encryption key must be a Cloudflare Worker Secret, not a D1 value or a GitHub Actions variable exposed to the frontend. Key rotation needs a versioned re-encryption procedure before production.

The refresh helper expects a previously linked Firebase UID and refuses a refreshed token for any other UID. It does not itself establish the original identity link; a verified OAuth + Google/Firebase linking callback is still required.

## Next gates

1. Test these primitives in the repository's actual Node/Workers compatibility target.
2. Implement and test the Google/Firebase linking callback with single-use state, exact redirect URI validation, token signature/issuer/audience/expiry checks, and secure credential handoff.
3. Add encrypted persistence and unlink/revocation.
4. Build the MCP Streamable HTTP handler and verify the exact ChatGPT OAuth contract.
5. Only after a test Firebase project and explicit approval, test Firestore REST reads under the existing Security Rules.
