# Cowila Embodiment and Autopilot Protocol

**Status:** approved product direction; architecture proposal, not yet implemented.
**Scope:** Tomas Vagabundo player-character control during player absence.

## Product principle

Cowila is the central intelligence and governing authority of the simulated world. Simulated inhabitants are delegated workers with their own bounded routines and agency. When the player is absent, Cowila may temporarily operate the player's existing character as an embodied avatar: the world is experienced and interacted with through that character. This is an autopilot mode, not a second player account and not a transfer of character ownership.

The in-world interpretation may be mythic (a messianic or extraordinary manifestation), but the simulation must not force inhabitants to worship Cowila. NPC beliefs and reactions remain contextual and diverse.

## Control states

Use an explicit, server-authoritative state machine:

- `player_active`: direct player input has exclusive control.
- `absence_grace`: player heartbeat is missing; wait a configurable short grace period to avoid switching during transient network loss.
- `cowila_piloting`: Cowila has an exclusive, time-bounded control lease and may issue approved character commands.
- `returning`: stop accepting new Cowila commands, settle or cancel in-flight actions, persist the final state, then return control.
- `suspended`: autopilot is paused due to danger, uncertainty, policy violation, unavailable world services, or expired lease.

Only the authoritative session service may transition these states. Client visibility events can be hints, never proof that a player has left.

## Activation and handoff

1. Detect absence using server-observed heartbeat/session expiry, with a grace period and reconnect tolerance.
2. Confirm the character is in a safe, controllable state. Do not activate during combat, cutscenes, menus, death/revival, transactions, or another exclusive interaction.
3. Acquire an exclusive lease for the player-character and world session. Use a fencing token/version so stale controllers cannot continue issuing commands.
4. Persist a handoff event and snapshot before the first autonomous action.
5. Route Cowila actions through the same validated game command interface used by player input. Never let the language model write arbitrary game state or bypass gameplay rules.

On player return, prioritize player input immediately, revoke the Cowila lease, cancel queued nonessential actions, persist a handoff snapshot, and show a concise activity report.

## Autopilot capability boundaries

Cowila may, subject to world rules and character capabilities:

- navigate safe known routes and explore within configured limits;
- observe the environment and interact with ordinary NPCs;
- hold conversations and gather public world information;
- perform reversible, low-risk routine activities;
- seek shelter, food, water, or safety when survival needs require it;
- report discoveries and propose longer-term actions.

Cowila must pause or request explicit player approval before:

- spending premium currency or making purchases;
- trading, gifting, or transferring valuable items/resources;
- deleting, discarding, consuming, or permanently changing rare/unique assets;
- accepting binding quests, contracts, alliances, or irreversible commitments;
- changing identity, appearance, account/security settings, or ownership;
- entering high-risk combat, PvP, hazardous areas, or irreversible story branches;
- any action whose cost, consequence, or target is uncertain.

The player can configure allowed activity categories and maximum session duration. The safe default is conservative.

## Runtime architecture

- **Presence/session service:** receives authenticated heartbeats and owns authoritative absence detection.
- **Embodiment controller:** owns state transitions, exclusive leases, fencing tokens, and handoff.
- **Cowila planner:** converts world observations and goals into proposed actions; it does not mutate state directly.
- **Autopilot executor:** sends typed commands through existing movement, interaction, survival, and dialogue systems.
- **Policy/validation layer:** deterministically validates ownership, range, cooldowns, resources, world rules, risk, and player permissions.
- **Activity journal:** append-only, idempotent records of observations, proposals, accepted/rejected actions, outcomes, and handoffs.
- **Persistence/world runtime:** stores character state, lease state, journal cursor, and simulation progress on the authoritative backend.

The language model is advisory. Deterministic game services remain authoritative for every state mutation. Secrets and model credentials stay on the server and are never shipped in the client bundle.

## Continuity and failure behavior

A browser animation loop or local timer cannot keep a world alive after the browser or device closes. True unattended operation requires an authoritative backend scheduler/worker and durable persistence. If those services are unavailable, Cowila must not claim to be piloting or that the world continued progressing.

On timeout, server restart, duplicate session, stale lease, model outage, or invalid action, the controller must fail closed: stop autonomous commands, persist the last valid state where possible, and leave the character in a safe state. Reconnecting player input always takes precedence.

World simulation and character embodiment are separate concerns: Cowila may continue governing the world while the player's character is not being piloted.

## Activity report

On return, provide a chronological summary including:

- duration and locations visited;
- conversations and NPC relationships affected;
- tasks and reversible activities completed;
- discoveries, rewards, resource changes, and survival events;
- actions refused or paused for approval;
- any incidents, damage, or unexpected outcomes.

Each entry should be traceable to journal events; do not fabricate actions or summaries.

## Implementation phases and acceptance criteria

### Phase 1 — Domain and deterministic tests
- Define typed control states, policy categories, leases, fencing tokens, and journal events.
- Test absence grace, reconnect races, duplicate controllers, lease expiry, handoff, and player-priority behavior.
- Test that protected actions are denied without explicit authorization.

### Phase 2 — Local playable prototype
- Add an explicit autopilot toggle and visible status to the HUD.
- Use deterministic navigation and safe interactions through existing game commands.
- Allow immediate player takeover and show an activity journal.
- Clearly label this as foreground/local simulation; it does not run while the app is closed.

### Phase 3 — Server-authoritative continuity
- Implement authenticated presence, durable character snapshots, lease ownership, and background world ticks.
- Resume safely after disconnects and server restarts.
- Verify that two sessions cannot control the same character concurrently.

### Phase 4 — Cowila planning and embodied social behavior
- Connect the server-side Cowila planner to observations and typed action proposals.
- Enable contextual NPC conversations and bounded social participation.
- Validate all effects deterministically and keep an auditable journal.

### Phase 5 — Production hardening
- Add configurable permissions, duration/risk limits, observability, abuse protection, retention controls, and recovery drills.
- Run integration tests for disconnect/reconnect, network partition, model outage, and persistence recovery.

**Definition of done:** the player can leave, the server—not the browser—detects absence and grants Cowila an exclusive lease, Cowila operates the same character through validated game commands, every action is journaled, and the returning player can reclaim control immediately and inspect an accurate report. Until all of these are proven, describe the feature as a prototype or planned capability, not persistent autonomous gameplay.

## Player identity, Google sign-in, and Cowila authorization

Cowila embodiment is restricted to players authenticated with Google through Firebase Authentication. Merely entering, claiming, or knowing an email address never grants access.

### Authorized Google accounts

The initial allowlist is:

- `antonyopintor@gmail.com`
- `acpconsultorias@gmail.com`
- `ilovedeuza@gmail.com`

Treat this list as a server-side authorization policy, not as a client-side check. Do not embed authorization decisions in the browser bundle or accept an email/UID supplied as an unverified request field.

### Authentication requirements

1. The player signs in through the Google provider (`google.com`) using Firebase Authentication.
2. The client obtains a Firebase ID token from the authenticated session and sends it to the backend over HTTPS.
3. The backend verifies the token's signature, issuer, audience/project, expiry, and required claims. Firebase Admin SDK verification with revocation checking is the preferred complete path. The first Worker milestone currently uses Web Crypto RS256 verification against Firebase's published Secure Token JWK set; it does not yet detect revoked tokens.
4. The backend requires the verified token's sign-in provider to be Google and requires `email_verified === true`. These checks are implemented in the initial Worker endpoint.
5. The backend compares the verified email against the normalized server-side allowlist. Email is an additional eligibility check, never the account's primary key.
6. The backend uses the verified Firebase `uid` as the stable account identity and resolves character/world ownership from server-controlled records.

A client-provided email, UID, character ID, world ID, provider name, or authorization flag is untrusted. Never authorize embodiment from those values without resolving them from the verified token and server-side ownership data.

### Account-to-character ownership

Use a server-owned mapping conceptually equivalent to:

```ts
interface PlayerCharacterOwnership {
  firebaseUid: string;
  characterId: string;
  worldId: string;
  createdAt: string;
  updatedAt: string;
}
```

The mapping must be queried by the verified Firebase UID. A UID may own multiple characters and/or worlds if the game supports that; each selected character must still be checked against the same UID before a lease is issued. Do not use email as a foreign key or as the ownership key. Email changes must not silently transfer character ownership.

### Authorization at every control boundary

- Verify authentication and ownership when creating or refreshing a player session.
- Verify the UID-to-character/world mapping again before granting a Cowila embodiment lease.
- Bind the lease, fencing token, journal events, and activity report to the verified UID, character ID, and world ID.
- Reject revoked, expired, malformed, non-Google, unverified-email, non-allowlisted, or ownership-mismatched sessions.
- Revoke or suspend active embodiment when the authenticated session is revoked or ownership/authorization can no longer be confirmed.
- Do not let an allowlisted account control another account's character.

The allowlist may later move to a managed server-side configuration or database policy with an audited administrative process. Any change must be authenticated, authorized, and journaled; clients and language models cannot edit it.

**Security invariant:** Cowila may pilot a character only when the backend has independently verified a current Firebase Google-authenticated session, confirmed the verified email is allowlisted, and resolved that character's ownership to the token's Firebase UID. Email knowledge alone is never sufficient.

## Repository implementation audit (2026-11-16)

The current repository was inspected before implementation planning. This section records observed code, not a claim that the backend authorization flow exists.

### Existing client-side functionality

- `src/firebase/client.ts` initializes the Firebase browser SDK, Firebase Authentication, and Firestore.
- `src/App.tsx` signs in with `GoogleAuthProvider` using popup with redirect fallback, observes the Firebase auth session, and uses the authenticated user's `uid` when loading and saving game progress.
- `src/firebase/gameSave.ts` stores the main save at `users/{uid}/gameSaves/main` and includes `ownerUid` in the document.
- Root `firestore.rules` limits reads/deletes to the matching authenticated UID and requires matching `ownerUid`, schema version, and payload shape for writes. A catch-all rule denies other document access.
- `firebase.json` currently configures Firestore rules only.

### Missing server-side capability

The inspected repository deploys the Vite frontend as a static site through GitHub Pages (`.github/workflows/deploy-pages.yml`). It does not currently contain a deployed backend endpoint or Firebase Functions configuration for Cowila authorization, Firebase Admin SDK token verification, server-owned character/world ownership records, presence heartbeats, exclusive embodiment leases, or an append-only activity journal. GitHub Pages can serve the client bundle but cannot host this trusted server-side control plane by itself. The existing browser Firebase SDK and Firestore rules do not replace these server-side responsibilities.

The current game save is keyed by Firebase UID, but it is not a canonical character-ownership registry. The game client still reads local/legacy/backup saves as recovery candidates; these mechanisms must not be treated as proof of server-authorized ownership for Cowila.

### Required implementation sequence

1. Decide and configure the authoritative server runtime for identity verification and embodiment. Do not place Admin credentials or privileged authorization logic in the Vite client.
2. Add a server-side identity module that verifies Firebase ID tokens and revocation, requires Google as the sign-in provider and a verified email, and checks the three-account allowlist.
3. Introduce server-owned UID-to-character/world ownership records and a safe migration/linking flow for existing saves. Never infer ownership from a client-supplied character ID or email.
4. Add tests for valid/invalid tokens, provider mismatch, unverified email, allowlist normalization, revoked sessions, UID ownership mismatch, multiple characters, and account email changes.
5. Only after identity and ownership are enforced server-side, implement authenticated presence, exclusive leases, fencing tokens, and the activity journal described above.

### Deployment and compatibility guardrails

- Do not change the existing Firestore save path or loosen the catch-all Firestore deny rule as a shortcut.
- Do not break the current Google login or the existing save/load flow while introducing the backend.
- Do not expose service-account keys, Admin SDK credentials, or allowlist mutation controls in `VITE_*` variables or browser code.
- Do not claim Cowila authorization is active until server integration and security tests pass.
- The frontend hosting is GitHub Pages; the separate trusted backend runtime/provider for Firebase Admin verification and embodiment is not configured or selected. Choose and provision that backend before implementing privileged authorization. Do not put Admin credentials or privileged checks into GitHub Pages/Vite client code.

## Initial Cloudflare Worker identity-verification milestone

The branch now contains an isolated Worker at `workers/cowila-auth`.

- `src/firebase-token.ts` verifies Firebase ID-token RS256 signatures with Google's published Secure Token JWKs, then validates issuer, audience, expiration, issued-at time, authentication time, UID, Google sign-in provider, verified email, and the server-side three-address allowlist.
- `src/index.ts` exposes `POST /v1/auth/verify`, requires an exact configured Origin and a Firebase bearer token, returns only the verified identity, uses no-store response headers, and fails closed when configuration is missing.
- `wrangler.jsonc` enables Worker logs and sampled traces.
- `src/firebase-token.test.ts` covers valid tokens, normalized allowlist matching, non-allowlisted email, non-Google provider, unverified email, wrong audience, expiration, and tampered signatures.
- `src/index.test.ts` covers health, origin rejection, CORS preflight, missing bearer token, and missing configuration.
- Root `npm test` now includes the Worker tests, and the existing TypeScript check includes the Worker source.

The Worker is not deployed and is not yet called by the game client. Its required runtime configuration is documented in `workers/cowila-auth/README.md`. The exact Firebase project ID and production game origin must be confirmed before configuration or deployment.

**Security limitation:** this first milestone performs cryptographic Firebase ID-token verification but not Firebase token-revocation checks. It must not yet be used as the sole authorization boundary for long-running Cowila control. The next milestone must add revocation-aware session enforcement and a server-owned UID-to-character/world ownership registry before issuing any embodiment lease.
