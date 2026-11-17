# Cowila Authentication Worker

This isolated Cloudflare Worker is the first trusted backend boundary for Cowila. It verifies Firebase ID tokens issued after Google sign-in and returns a minimal verified identity.

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
- `ALLOWED_ORIGINS` — comma-separated exact HTTPS origins that host the game. Do not include paths or wildcards.

For local development, copy `.dev.vars.example` to `.dev.vars` and replace the Firebase project ID and origin. Do not commit `.dev.vars`.

Example commands after selecting the correct Cloudflare account:

```sh
cd workers/cowila-auth
npx wrangler secret put FIREBASE_PROJECT_ID
npx wrangler secret put ALLOWED_GOOGLE_EMAILS
npx wrangler secret put ALLOWED_ORIGINS
npx wrangler dev
```

Do not deploy until the project ID and production origin have been confirmed against the live Firebase and Pages configuration.

## Verification performed by this Worker

- RS256 signature against Google's published Firebase Secure Token JWK set.
- Exact Firebase issuer and audience/project.
- Expiration, issued-at, authentication time, and UID shape.
- `firebase.sign_in_provider === "google.com"`.
- `email_verified === true`.
- Normalized email membership in the server-side allowlist.

The signing-key endpoint is fetched over HTTPS. The Worker does not log bearer tokens or token claims.

## Explicit scope limits

This endpoint verifies a Firebase ID token cryptographically but does **not yet perform Firebase Admin SDK revocation checks**, persist a backend session, resolve character/world ownership, grant an embodiment lease, or run Cowila's pilot. Firebase ID tokens are short-lived; revocation-aware session enforcement must be added before production autonomy. Do not treat this endpoint alone as sufficient authorization to control a character.

The next backend milestone is a revocation-aware authenticated session and a server-owned UID-to-character/world ownership registry, followed by presence leases and the activity journal. The browser must not write privileged ownership or embodiment state directly.
