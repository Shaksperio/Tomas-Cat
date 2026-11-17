import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { Buffer } from "node:buffer";
import { verifyFirebaseGoogleIdToken, FirebaseTokenError } from "./firebase-token";

const PROJECT_ID = "tomas-vagabundo-test";
const NOW = 1_800_000_000;
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = publicKey.export({ format: "jwk" });
const signingJwk = { ...jwk, kid: "test-key", alg: "RS256", use: "sig" };

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function makeToken(overrides: Record<string, unknown> = {}): string {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "test-key" }));
  const claims = base64Url(JSON.stringify({
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    sub: "firebase-user-123",
    email: "antonyopintor@gmail.com",
    email_verified: true,
    iat: NOW - 60,
    exp: NOW + 3_540,
    auth_time: NOW - 120,
    firebase: { sign_in_provider: "google.com" },
    ...overrides,
  }));
  const input = `${header}.${claims}`;
  const signature = sign("RSA-SHA256", Buffer.from(input), privateKey);
  return `${input}.${base64Url(signature)}`;
}

const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({ keys: [signingJwk] }), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});

test("accepts a valid Google Firebase ID token for an allowlisted account", async () => {
  const identity = await verifyFirebaseGoogleIdToken(
    makeToken(),
    PROJECT_ID,
    ["antonyopintor@gmail.com", "acpconsultorias@gmail.com", "ilovedeuza@gmail.com"],
    NOW,
    fakeFetch,
  );
  assert.deepEqual(identity, {
    uid: "firebase-user-123",
    email: "antonyopintor@gmail.com",
    emailVerified: true,
    provider: "google.com",
    authTime: NOW - 120,
  });
});

test("normalizes email case and whitespace in the server-side allowlist", async () => {
  const identity = await verifyFirebaseGoogleIdToken(
    makeToken({ email: "ACPCONSULTORIAS@GMAIL.COM" }),
    PROJECT_ID,
    [" acpconsultorias@gmail.com "],
    NOW,
    fakeFetch,
  );
  assert.equal(identity.email, "acpconsultorias@gmail.com");
});

test("rejects an email that is not allowlisted", async () => {
  await assert.rejects(
    verifyFirebaseGoogleIdToken(makeToken({ email: "intruder@example.com" }), PROJECT_ID, ["antonyopintor@gmail.com"], NOW, fakeFetch),
    FirebaseTokenError,
  );
});

test("rejects a token signed in through a provider other than Google", async () => {
  await assert.rejects(
    verifyFirebaseGoogleIdToken(makeToken({ firebase: { sign_in_provider: "password" } }), PROJECT_ID, ["antonyopintor@gmail.com"], NOW, fakeFetch),
    FirebaseTokenError,
  );
});

test("rejects an unverified email", async () => {
  await assert.rejects(
    verifyFirebaseGoogleIdToken(makeToken({ email_verified: false }), PROJECT_ID, ["antonyopintor@gmail.com"], NOW, fakeFetch),
    FirebaseTokenError,
  );
});

test("rejects wrong project audience and expired tokens", async () => {
  await assert.rejects(
    verifyFirebaseGoogleIdToken(makeToken({ aud: "another-project" }), PROJECT_ID, ["antonyopintor@gmail.com"], NOW, fakeFetch),
    FirebaseTokenError,
  );
  await assert.rejects(
    verifyFirebaseGoogleIdToken(makeToken({ exp: NOW - 1 }), PROJECT_ID, ["antonyopintor@gmail.com"], NOW, fakeFetch),
    FirebaseTokenError,
  );
});

test("rejects a tampered token signature", async () => {
  const token = makeToken();
  const parts = token.split(".");
  parts[1] = base64Url(JSON.stringify({ sub: "attacker" }));
  await assert.rejects(
    verifyFirebaseGoogleIdToken(parts.join("."), PROJECT_ID, ["antonyopintor@gmail.com"], NOW, fakeFetch),
    FirebaseTokenError,
  );
});
