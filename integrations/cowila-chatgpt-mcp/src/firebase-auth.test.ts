import { strict as assert } from "node:assert";
import { test } from "node:test";
import { FirebaseAuthError, refreshFirebaseIdToken } from "./firebase-auth";

test("refreshes a Firebase ID token for the already-linked UID", async () => {
  let requestBody = "";
  const result = await refreshFirebaseIdToken(
    "refresh-secret",
    "web-api-key",
    "uid-allowed",
    async (input, init) => {
      assert.match(String(input), /^https:\/\/securetoken\.googleapis\.com\/v1\/token\?/);
      requestBody = String(init?.body);
      return Response.json({
        id_token: "fresh-id-token",
        refresh_token: "rotated-refresh-token",
        user_id: "uid-allowed",
        expires_in: "3600",
      });
    },
  );

  assert.equal(result.uid, "uid-allowed");
  assert.equal(result.idToken, "fresh-id-token");
  assert.equal(result.refreshToken, "rotated-refresh-token");
  assert.equal(result.expiresInSeconds, 3600);
  assert.match(requestBody, /grant_type=refresh_token/);
  assert.match(requestBody, /refresh_token=refresh-secret/);
});

test("rejects a token issued for a different Firebase UID", async () => {
  await assert.rejects(
    refreshFirebaseIdToken("refresh-secret", "web-api-key", "uid-allowed", async () =>
      Response.json({
        id_token: "other-id-token",
        refresh_token: "other-refresh-token",
        user_id: "uid-attacker",
        expires_in: "3600",
      }),
    ),
    (error: unknown) =>
      error instanceof FirebaseAuthError &&
      error.message === "Firebase token subject does not match the linked account.",
  );
});

test("does not expose provider response body on refresh failure", async () => {
  await assert.rejects(
    refreshFirebaseIdToken("refresh-secret", "web-api-key", "uid-allowed", async () =>
      new Response("private provider diagnostic", { status: 401 }),
    ),
    (error: unknown) =>
      error instanceof FirebaseAuthError &&
      !error.message.includes("private provider diagnostic"),
  );
});

test("rejects malformed token responses", async () => {
  await assert.rejects(
    refreshFirebaseIdToken("refresh-secret", "web-api-key", "uid-allowed", async () =>
      Response.json({ id_token: "missing-other-fields" }),
    ),
    FirebaseAuthError,
  );
});
