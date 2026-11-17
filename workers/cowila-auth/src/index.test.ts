import test from "node:test";
import assert from "node:assert/strict";
import worker, { type Env } from "./index";

const env: Env = {
  FIREBASE_PROJECT_ID: "firebase-project",
  ALLOWED_GOOGLE_EMAILS: "antonyopintor@gmail.com,acpconsultorias@gmail.com,ilovedeuza@gmail.com",
  ALLOWED_ORIGINS: "https://game.example",
};

test("health endpoint reports only service health", async () => {
  const response = await worker.fetch(new Request("https://worker.example/health"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "cowila-auth",
    stage: "identity-verification",
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("rejects browser origins not in the exact allowlist", async () => {
  const response = await worker.fetch(new Request("https://worker.example/v1/auth/verify", {
    method: "POST",
    headers: { Origin: "https://attacker.example" },
  }), env);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "origin_not_allowed" });
});

test("rejects requests without an allowed browser origin", async () => {
  const response = await worker.fetch(new Request("https://worker.example/v1/auth/verify", {
    method: "POST",
  }), env);
  assert.equal(response.status, 403);
});

test("handles preflight only for an allowed origin", async () => {
  const response = await worker.fetch(new Request("https://worker.example/v1/auth/verify", {
    method: "OPTIONS",
    headers: { Origin: "https://game.example" },
  }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://game.example");
});

test("requires a Firebase bearer token before verification", async () => {
  const response = await worker.fetch(new Request("https://worker.example/v1/auth/verify", {
    method: "POST",
    headers: { Origin: "https://game.example" },
  }), env);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "unauthorized" });
});

test("fails closed when the Firebase project is not configured", async () => {
  const response = await worker.fetch(new Request("https://worker.example/v1/auth/verify", {
    method: "POST",
    headers: {
      Origin: "https://game.example",
      Authorization: "Bearer not-a-real-token",
    },
  }), { ...env, FIREBASE_PROJECT_ID: "" });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "service_not_configured" });
});
