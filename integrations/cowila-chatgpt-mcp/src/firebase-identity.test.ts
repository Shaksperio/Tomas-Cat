import { strict as assert } from "node:assert";
import { test } from "node:test";
import { FirebaseIdentityError, verifyFirebaseIdToken } from "./firebase-identity";

const NOW = 1_800_000_000;
const PROJECT_ID = "cowila-test-project";
const ALLOWED_EMAIL = "antonyopintor@gmail.com";

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function encodeJson(value: unknown): string {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function fixture(overrides: Record<string, unknown> = {}, wrongKey = false) {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKey = wrongKey
    ? (await crypto.subtle.generateKey(
        {
          name: "RSASSA-PKCS1-v1_5",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["sign", "verify"],
      )).privateKey
    : keyPair.privateKey;

  const claims = {
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    sub: "firebase-uid-123",
    exp: NOW + 3600,
    iat: NOW - 30,
    auth_time: NOW - 60,
    email: ALLOWED_EMAIL,
    email_verified: true,
    ...overrides,
  };
  const header = encodeJson({ alg: "RS256", typ: "JWT", kid: "test-key-1" });
  const payload = encodeJson(claims);
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  const token = `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
  const fetcher: typeof fetch = async (input) => {
    assert.equal(String(input), "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    return Response.json({ keys: [{ ...publicJwk, kid: "test-key-1", alg: "RS256", use: "sig" }] });
  };
  return { token, fetcher };
}

test("verifies a signed, recently authenticated Firebase operator identity", async () => {
  const { token, fetcher } = await fixture();
  const identity = await verifyFirebaseIdToken(token, PROJECT_ID, ALLOWED_EMAIL, fetcher, NOW);
  assert.deepEqual(identity, {
    uid: "firebase-uid-123",
    email: ALLOWED_EMAIL,
    emailVerified: true,
    authTime: NOW - 60,
  });
});

test("rejects a token with the wrong Firebase project audience", async () => {
  const { token, fetcher } = await fixture({ aud: "another-project" });
  await assert.rejects(
    verifyFirebaseIdToken(token, PROJECT_ID, ALLOWED_EMAIL, fetcher, NOW),
    FirebaseIdentityError,
  );
});

test("rejects an unverified or different operator email", async () => {
  const { token, fetcher } = await fixture({ email_verified: false });
  await assert.rejects(
    verifyFirebaseIdToken(token, PROJECT_ID, ALLOWED_EMAIL, fetcher, NOW),
    FirebaseIdentityError,
  );
});

test("rejects stale authentication even when the ID token is still valid", async () => {
  const { token, fetcher } = await fixture({ auth_time: NOW - 601 });
  await assert.rejects(
    verifyFirebaseIdToken(token, PROJECT_ID, ALLOWED_EMAIL, fetcher, NOW),
    (error: unknown) =>
      error instanceof FirebaseIdentityError &&
      error.message === "Recent Firebase reauthentication is required.",
  );
});

test("rejects expired tokens", async () => {
  const { token, fetcher } = await fixture({ exp: NOW - 61 });
  await assert.rejects(
    verifyFirebaseIdToken(token, PROJECT_ID, ALLOWED_EMAIL, fetcher, NOW),
    FirebaseIdentityError,
  );
});

test("rejects a forged signature", async () => {
  const { token, fetcher } = await fixture({}, true);
  await assert.rejects(
    verifyFirebaseIdToken(token, PROJECT_ID, ALLOWED_EMAIL, fetcher, NOW),
    FirebaseIdentityError,
  );
});

test("rejects unknown signing keys", async () => {
  const { token } = await fixture();
  const missingKeyFetcher: typeof fetch = async () => Response.json({ keys: [] });
  await assert.rejects(
    verifyFirebaseIdToken(token, PROJECT_ID, ALLOWED_EMAIL, missingKeyFetcher, NOW),
    (error: unknown) =>
      error instanceof FirebaseIdentityError &&
      error.message === "Firebase identity signing key is unknown.",
  );
});

test("rejects malformed JWT input", async () => {
  await assert.rejects(
    verifyFirebaseIdToken("not-a-jwt", PROJECT_ID, ALLOWED_EMAIL, fetch, NOW),
    FirebaseIdentityError,
  );
});
