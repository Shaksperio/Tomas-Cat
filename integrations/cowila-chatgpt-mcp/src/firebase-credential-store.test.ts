import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  deleteFirebaseCredential,
  getFirebaseCredential,
  saveFirebaseCredential,
  type D1DatabaseLike,
} from "./firebase-credential-store";

const UID = "firebase-uid-123";
const EMAIL = "antonyopintor@gmail.com";
const KEY = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));

class MemoryD1 implements D1DatabaseLike {
  row: Record<string, unknown> | null = null;
  lastSql = "";
  lastValues: unknown[] = [];

  prepare(query: string) {
    this.lastSql = query;
    const db = this;
    let values: unknown[] = [];
    return {
      bind(...args: unknown[]) {
        values = args;
        db.lastValues = args;
        return this;
      },
      async run() {
        if (query.includes("INSERT INTO firebase_link_credentials")) {
          db.row = {
            firebase_uid: values[0],
            email: values[1],
            vault_version: values[2],
            vault_algorithm: values[3],
            vault_nonce: values[4],
            vault_ciphertext: values[5],
            created_at: values[6],
            updated_at: values[7],
            revoked_at: null,
          };
        } else if (query.startsWith("DELETE FROM firebase_link_credentials")) {
          db.row = null;
        }
        return { success: true };
      },
      async first<T>() {
        if (!db.row) return null;
        if (query.includes("SELECT")) return db.row as T;
        return null;
      },
    };
  }
}

test("stores an encrypted refresh token and reads it back for the linked UID", async () => {
  const db = new MemoryD1();
  await saveFirebaseCredential(db, { uid: UID, email: EMAIL, refreshToken: "refresh-secret-value" }, KEY, 1000);
  assert.ok(db.row);
  assert.equal(db.row?.vault_algorithm, "AES-GCM");
  assert.notEqual(db.row?.vault_ciphertext, "refresh-secret-value");
  assert.ok(!db.lastValues.includes("refresh-secret-value"));

  const result = await getFirebaseCredential(db, UID, KEY);
  assert.deepEqual(result, {
    uid: UID,
    email: EMAIL,
    refreshToken: "refresh-secret-value",
    createdAt: 1000,
    updatedAt: 1000,
  });
});

test("rotates the encrypted refresh token without changing original creation time", async () => {
  const db = new MemoryD1();
  await saveFirebaseCredential(db, { uid: UID, email: EMAIL, refreshToken: "old-token" }, KEY, 1000);
  await saveFirebaseCredential(db, { uid: UID, email: EMAIL, refreshToken: "rotated-token" }, KEY, 2000);
  const result = await getFirebaseCredential(db, UID, KEY);
  assert.equal(result?.refreshToken, "rotated-token");
  assert.equal(result?.createdAt, 1000);
  assert.equal(result?.updatedAt, 2000);
});

test("refuses to store a different email", async () => {
  const db = new MemoryD1();
  await assert.rejects(
    saveFirebaseCredential(db, { uid: UID, email: "attacker@example.com", refreshToken: "secret" }, KEY),
  );
  assert.equal(db.row, null);
});

test("returns null for an unlinked UID", async () => {
  const db = new MemoryD1();
  assert.equal(await getFirebaseCredential(db, UID, KEY), null);
});

test("deletes the stored credential on unlink", async () => {
  const db = new MemoryD1();
  await saveFirebaseCredential(db, { uid: UID, email: EMAIL, refreshToken: "refresh-secret-value" }, KEY);
  await deleteFirebaseCredential(db, UID);
  assert.equal(await getFirebaseCredential(db, UID, KEY), null);
  assert.match(db.lastSql, /DELETE FROM firebase_link_credentials/);
});

test("rejects malformed stored encryption envelopes", async () => {
  const db = new MemoryD1();
  db.row = {
    firebase_uid: UID, email: EMAIL, vault_version: 2, vault_algorithm: "AES-GCM",
    vault_nonce: "nonce", vault_ciphertext: "cipher", created_at: 1, updated_at: 1, revoked_at: null,
  };
  await assert.rejects(getFirebaseCredential(db, UID, KEY));
});
