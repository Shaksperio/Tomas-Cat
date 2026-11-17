# Cowila Authentication Worker

This isolated Cloudflare Worker is the first trusted backend boundary for Cowila. It verifies Firebase ID tokens issued after Google sign-in and returns a minimal verified identity. It is not yet the session/embodiment controller.

## Dedicated D1 database

The Worker configuration binds `DB` to the dedicated `tomas-vagabundo-world` D1 database. Its initial migration is in `migrations/0001_cowila_world_core.sql`.

The live schema contains player account, character ownership, world session, embodiment lease, character snapshot, activity journal, and Firebase mirror outbox/cursor tables. The database has no player records yet. See [the data-plane architecture](../../docs/architecture/TOMAS-VAGABUNDO-DATA-PLANE.md).

## Endpoint

- `GET /health` — deployment health only; does not prove Firebase configuration.
- `POST /v1/auth/verify` — requires an exact allowed browser Origin and `Authorization: Bearer <Firebase ID token>`.

A successful response contains only the verified Firebase UID, normalized email, verified-email flag, Google provider, and authentication time. The client-supplied email and UID are never accepted as identity inputs.

## Required Worker configuration

Configure these values as Worker secrets (or local values in an untracked `.dev.vars` file):

- `FIREBASE_PROJECT_ID` — exact Firebase project ID used by the existing browser app.
- `ALLOWED_GOOGLE_EMAILS` — comma-separated server-side allowlist:
  - `antonyopintor@gmail.com`
  - `acpconsultorias@gmail.com`
  - `ilovedeuza@gmail.com`
- `ALLOWED_ORIGINS` — comma-separated exact HTTPS origins that host the game.

For local development, copy `.dev.vars.example` to `.dev.vars` and replace the Firebase project ID and origin. Do not commit `.dev.vars`.

Do not deploy until the project ID and production origin have been confirmed against the live Firebase and Pages configuration.

## Firebase mirror status

Firestore mirror paths and owner-only read rules are documented and staged in the repository. The rules have not been deployed and no mirror writes are active. The exact Firebase project ID and a dedicated server-side Firestore credential are still required. The browser must never write to `serverMirror`; only a trusted backend writer may consume the D1 outbox. D1 remains authoritative.

## Verification performed by this Worker

- RS256 signature against Google's published Firebase Secure Token JWKs.
- Exact Firebase issuer and audience/project.
- Expiration, issued-at, authentication time, and UID shape.
- `firebase.sign_in_provider === "google.com"`.
- `email_verified === true`.
- Normalized email membership in the server-side allowlist.

The signing-key endpoint is fetched over HTTPS. The Worker does not log bearer tokens or token claims.

## Explicit scope limits

This endpoint verifies a Firebase ID token cryptographically but does **not yet perform Firebase Admin SDK revocation checks**, persist a backend session, resolve character/world ownership, grant an embodiment lease, or run Cowila's pilot. Firebase ID tokens are short-lived; revocation-aware session enforcement must be added before production autonomy. Do not treat this endpoint alone as sufficient authorization to control a character.

The next backend milestone is revocation-aware authenticated sessions, server-owned UID-to-character/world ownership, presence leases, the activity journal, and a trusted Firebase mirror outbox consumer.
