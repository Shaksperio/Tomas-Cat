import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  GoogleOAuthError,
} from "./google-oauth";

const CALLBACK = "https://cowila-auth.example.com/google/callback";
const CODE = "authorization-code";
const VERIFIER = "a".repeat(64);
const CHALLENGE = "b".repeat(43);
const STATE = "state_value_1234567890";

test("builds Google authorization URL with S256 PKCE and required identity scopes", () => {
  const url = new URL(buildGoogleAuthorizationUrl({
    clientId: "google-client-id",
    redirectUri: CALLBACK,
    state: STATE,
    codeChallenge: CHALLENGE,
  }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("client_id"), "google-client-id");
  assert.equal(url.searchParams.get("redirect_uri"), CALLBACK);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.equal(url.searchParams.get("state"), STATE);
  assert.equal(url.searchParams.get("code_challenge"), CHALLENGE);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
});

test("rejects a non-HTTPS Google callback URL", () => {
  assert.throws(
    () => buildGoogleAuthorizationUrl({
      clientId: "google-client-id",
      redirectUri: "http://localhost/callback",
      state: STATE,
      codeChallenge: CHALLENGE,
    }),
    GoogleOAuthError,
  );
});

test("rejects malformed state and PKCE challenge", () => {
  assert.throws(() => buildGoogleAuthorizationUrl({
    clientId: "google-client-id",
    redirectUri: CALLBACK,
    state: "short",
    codeChallenge: CHALLENGE,
  }), GoogleOAuthError);
  assert.throws(() => buildGoogleAuthorizationUrl({
    clientId: "google-client-id",
    redirectUri: CALLBACK,
    state: STATE,
    codeChallenge: "plain-verifier",
  }), GoogleOAuthError);
});

test("exchanges a Google authorization code using the server-held PKCE verifier", async () => {
  let receivedBody = "";
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(String(url), "https://oauth2.googleapis.com/token");
    assert.equal(init?.method, "POST");
    receivedBody = String(init?.body);
    return Response.json({ access_token: "google-short-lived-access-token", token_type: "Bearer", expires_in: 3599 });
  };
  const result = await exchangeGoogleAuthorizationCode({
    code: CODE,
    codeVerifier: VERIFIER,
    clientId: "google-client-id",
    clientSecret: "google-client-secret",
    redirectUri: CALLBACK,
  }, fetcher);
  assert.deepEqual(result, { accessToken: "google-short-lived-access-token", expiresIn: 3599 });
  const form = new URLSearchParams(receivedBody);
  assert.equal(form.get("code"), CODE);
  assert.equal(form.get("code_verifier"), VERIFIER);
  assert.equal(form.get("client_id"), "google-client-id");
  assert.equal(form.get("client_secret"), "google-client-secret");
  assert.equal(form.get("redirect_uri"), CALLBACK);
  assert.equal(form.get("grant_type"), "authorization_code");
});

test("rejects an unsuccessful Google token exchange without exposing provider details", async () => {
  const fetcher: typeof fetch = async () => Response.json({ error: "invalid_grant", secret: "provider-detail" }, { status: 400 });
  await assert.rejects(
    exchangeGoogleAuthorizationCode({
      code: CODE, codeVerifier: VERIFIER, clientId: "id", clientSecret: "secret", redirectUri: CALLBACK,
    }, fetcher),
    (error: unknown) => error instanceof GoogleOAuthError && !error.message.includes("provider-detail"),
  );
});

test("rejects malformed or incomplete Google token responses", async () => {
  const fetcher: typeof fetch = async () => Response.json({ access_token: "token", token_type: "MAC", expires_in: 0 });
  await assert.rejects(
    exchangeGoogleAuthorizationCode({
      code: CODE, codeVerifier: VERIFIER, clientId: "id", clientSecret: "secret", redirectUri: CALLBACK,
    }, fetcher),
    GoogleOAuthError,
  );
});

test("rejects missing code verifier and non-HTTPS token callback", async () => {
  await assert.rejects(
    exchangeGoogleAuthorizationCode({
      code: CODE, codeVerifier: "short", clientId: "id", clientSecret: "secret", redirectUri: CALLBACK,
    }),
    GoogleOAuthError,
  );
  await assert.rejects(
    exchangeGoogleAuthorizationCode({
      code: CODE, codeVerifier: VERIFIER, clientId: "id", clientSecret: "secret", redirectUri: "http://localhost/callback",
    }),
    GoogleOAuthError,
  );
});
