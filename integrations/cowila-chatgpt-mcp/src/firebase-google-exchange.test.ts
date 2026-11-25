import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  exchangeGoogleTokenForFirebaseSession,
  FirebaseGoogleExchangeError,
} from "./firebase-google-exchange";

const NOW = Math.floor(Date.now() / 1000);
const PROJECT_ID = "cowila-test-project";
const API_KEY = "test-web-api-key";
const EMAIL = "antonyopintor@gmail.com";
const UID = "firebase-uid-123";
const CALLBACK = "https://cowila-auth.example.com/callback";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function jsonPart(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}
async function signedFirebaseToken() {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const header = jsonPart({ alg: "RS256", typ: "JWT", kid: "firebase-test-key" });
  const claims = jsonPart({
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    sub: UID,
    exp: NOW + 3600,
    iat: NOW - 5,
    auth_time: NOW - 10,
    email: EMAIL,
    email_verified: true,
  });
  const input = `${header}.${claims}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(input));
  return {
    idToken: `${input}.${base64Url(new Uint8Array(signature))}`,
    publicJwk: { ...publicJwk, kid: "firebase-test-key", alg: "RS256", use: "sig" },
  };
}
async function makeFetcher(options: {
  localId?: string; email?: string; refreshToken?: string; providerId?: string; status?: number; invalidJwks?: boolean;
} = {}) {
  const signed = await signedFirebaseToken();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith("https://identitytoolkit.googleapis.com/")) {
      if (options.status && options.status !== 200) {
        return Response.json({ error: { message: "PRIVATE_PROVIDER_ERROR_DETAIL" } }, { status: options.status });
      }
      return Response.json({
        localId: options.localId ?? UID,
        email: options.email ?? EMAIL,
        idToken: signed.idToken,
        refreshToken: options.refreshToken ?? "firebase-refresh-secret",
        providerId: options.providerId ?? "google.com",
      });
    }
    assert.equal(url, "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    return Response.json({ keys: options.invalidJwks ? [] : [signed.publicJwk] });
  };
  return { fetcher, calls };
}
const input = {
  googleAccessToken: "short-lived-google-access-token",
  firebaseApiKey: API_KEY,
  firebaseProjectId: PROJECT_ID,
  allowedEmail: EMAIL,
  callbackUri: CALLBACK,
};

test("exchanges Google token for the verified Firebase UID and refresh token", async () => {
  const { fetcher, calls } = await makeFetcher();
  const result = await exchangeGoogleTokenForFirebaseSession(input, fetcher);
  assert.deepEqual(result, { uid: UID, email: EMAIL, refreshToken: "firebase-refresh-secret" });
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /^https:\/\/identitytoolkit\.googleapis\.com\/v1\/accounts:signInWithIdp\?key=/);
  const request = JSON.parse(String(calls[0].init?.body));
  assert.equal(request.postBody, "access_token=short-lived-google-access-token&providerId=google.com");
  assert.equal(request.requestUri, CALLBACK);
  assert.equal(request.returnSecureToken, true);
  assert.equal(request.returnIdpCredential, false);
});

test("rejects a response whose UID differs from the signed Firebase token", async () => {
  const { fetcher } = await makeFetcher({ localId: "attacker-controlled-uid" });
  await assert.rejects(exchangeGoogleTokenForFirebaseSession(input, fetcher), FirebaseGoogleExchangeError);
});
test("rejects an incomplete Firebase response", async () => {
  const { fetcher } = await makeFetcher({ refreshToken: "" });
  await assert.rejects(exchangeGoogleTokenForFirebaseSession(input, fetcher), FirebaseGoogleExchangeError);
});
test("rejects a response from a different identity provider", async () => {
  const { fetcher } = await makeFetcher({ providerId: "facebook.com" });
  await assert.rejects(exchangeGoogleTokenForFirebaseSession(input, fetcher), FirebaseGoogleExchangeError);
});
test("sanitizes upstream Firebase errors", async () => {
  const { fetcher } = await makeFetcher({ status: 400 });
  await assert.rejects(
    exchangeGoogleTokenForFirebaseSession(input, fetcher),
    (error: unknown) => error instanceof FirebaseGoogleExchangeError && !error.message.includes("PRIVATE_PROVIDER_ERROR_DETAIL"),
  );
});
test("rejects non-HTTPS callback URLs before contacting Firebase", async () => {
  let called = false;
  const fetcher: typeof fetch = async () => { called = true; return Response.json({}); };
  await assert.rejects(
    exchangeGoogleTokenForFirebaseSession({ ...input, callbackUri: "http://cowila-auth.example.com/callback" }, fetcher),
    FirebaseGoogleExchangeError,
  );
  assert.equal(called, false);
});
test("rejects a Firebase ID token with an unknown signing key", async () => {
  const { fetcher } = await makeFetcher({ invalidJwks: true });
  await assert.rejects(exchangeGoogleTokenForFirebaseSession(input, fetcher), FirebaseGoogleExchangeError);
});
