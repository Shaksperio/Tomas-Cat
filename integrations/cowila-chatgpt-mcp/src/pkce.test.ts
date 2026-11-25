import { strict as assert } from "node:assert";
import { test } from "node:test";
import { webcrypto } from "node:crypto";
import { createPkcePair } from "./pkce";

if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });

test("creates independent RFC 7636 S256 verifier and challenge pairs", async () => {
  const first = await createPkcePair();
  const second = await createPkcePair();
  assert.match(first.verifier, /^[A-Za-z0-9_-]{43}$/);
  assert.match(first.challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.verifier, first.challenge);
  assert.notEqual(first.verifier, second.verifier);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(first.verifier));
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  assert.equal(first.challenge, expected);
});
