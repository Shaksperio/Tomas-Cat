import { strict as assert } from "node:assert";
import { webcrypto } from "node:crypto";
import { test } from "node:test";
import {
  decryptRefreshToken,
  encryptRefreshToken,
  SecretVaultError,
} from "./secret-vault";

if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });

const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

test("encrypts and decrypts a Firebase refresh token", async () => {
  const envelope = await encryptRefreshToken("firebase-refresh-secret", key);
  assert.equal(envelope.version, 1);
  assert.equal(envelope.algorithm, "AES-GCM");
  assert.notEqual(envelope.ciphertext, "firebase-refresh-secret");
  assert.equal(await decryptRefreshToken(envelope, key), "firebase-refresh-secret");
});

test("uses a fresh nonce for each encryption", async () => {
  const first = await encryptRefreshToken("same-token", key);
  const second = await encryptRefreshToken("same-token", key);
  assert.notEqual(first.nonce, second.nonce);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test("rejects an invalid vault key length", async () => {
  await assert.rejects(encryptRefreshToken("token", btoa("too-short")), SecretVaultError);
});

test("rejects tampered ciphertext", async () => {
  const envelope = await encryptRefreshToken("firebase-refresh-secret", key);
  const tampered = { ...envelope, ciphertext: btoa("tampered") };
  await assert.rejects(decryptRefreshToken(tampered, key));
});

test("rejects unsupported envelope versions", async () => {
  const envelope = await encryptRefreshToken("firebase-refresh-secret", key);
  await assert.rejects(
    decryptRefreshToken({ ...envelope, version: 2 } as never, key),
    SecretVaultError,
  );
});
