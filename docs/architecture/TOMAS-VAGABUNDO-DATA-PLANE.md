# Tomas Vagabundo data plane: D1 and Firebase mirror

**Status:** dedicated Cloudflare D1 is provisioned and its initial schema is live. Repository configuration and Firestore mirror rules are staged on PR #36. Firebase mirroring is designed but is not active until the exact Firebase project and trusted server credentials are configured.

## Authority model

- Cloudflare D1 database `tomas-vagabundo-world` is the operational source of truth for accounts, character ownership, sessions, embodiment leases, snapshots, and the activity journal.
- Firebase Authentication remains the Google sign-in provider and stable account identity source. The verified Firebase UID is the account key; email is only an allowlist attribute.
- Firestore is a read-only per-user mirror for inspection/recovery and must never grant ownership, sessions, or Cowila control.
- Browser clients cannot write mirror documents. A trusted backend writer (Firestore Admin SDK or equivalent service identity) writes mirror documents and updates the D1 outbox only after successful delivery.

## D1 resources

- Database: `tomas-vagabundo-world`
- Database ID: `3af4bbc4-579e-4b20-8f15-4f8c352803c0`
- Cloudflare account: `e31728d760beddc69617fbdb81c5e007`
- Worker binding: `DB`
- Migration: `workers/cowila-auth/migrations/0001_cowila_world_core.sql`

Tables:
- `player_accounts`
- `character_ownership`
- `world_sessions`
- `embodiment_leases` (unique active lease per character; monotonic fencing token)
- `character_snapshots`
- `activity_journal` (unique idempotency key)
- `firebase_mirror_outbox` (retryable delivery queue)
- `firebase_mirror_cursors`

The initial schema was applied directly to the newly created D1 database and the matching migration name was recorded in `d1_migrations`. The schema contains no player records yet.

## Firestore mirror contract

Firestore path root: `serverMirror/{firebaseUid}`.

Suggested documents/subcollections:
- `serverMirror/{uid}/profile/current`: mirror version, UID, sanitized account status, last sync timestamp.
- `serverMirror/{uid}/characters/{characterId}`: world ID, schema version, snapshot pointer, state hash, updated timestamp.
- `serverMirror/{uid}/snapshots/{snapshotId}`: immutable snapshot metadata and sanitized snapshot payload.
- `serverMirror/{uid}/activity/{eventId}`: journal event mirror with event type, actor, outcome, timestamp, and sanitized payload.
- `serverMirror/{uid}/sync/current`: last successful cursor, pending count, last error category.

Do not mirror bearer tokens, service-account credentials, secrets, private model prompts, raw logs, or unredacted sensitive evidence. Large snapshots should be bounded and versioned. D1 remains authoritative if a mirror write is delayed or fails.

The repository Firestore rules add owner-only reads and deny all client writes under `serverMirror/{uid}/**`. The rules file has **not** been deployed to Firebase yet.

## Pending activation requirements

The repository currently contains only placeholder values in `.env.example`; no exact `VITE_FIREBASE_PROJECT_ID` was found. No Firebase Admin service-account credential or Firebase connector is available in this session. Therefore no Firestore database/document has been created or written, and no rules deployment or synchronization job is claimed.

Before enabling the mirror:
1. Confirm the exact Firebase project ID already used by the game.
2. Configure a dedicated least-privilege server identity for Firestore writes as a Cloudflare Worker secret; never put a private key in `VITE_*`, Git, D1, or chat.
3. Deploy the updated Firestore rules to that exact project after reviewing existing save compatibility.
4. Implement the outbox consumer with bounded retries, idempotent document IDs, redaction, and per-user path validation.
5. Test successful sync, duplicate delivery, retry, permission denial, stale cursor, and Firebase outage. A mirror outage must not mutate or roll back authoritative D1 state.

Do not deploy the Worker until Firebase project ID, production origin, and secret configuration are confirmed. The current Worker identity endpoint still lacks token-revocation checks and does not yet create sessions or leases.
