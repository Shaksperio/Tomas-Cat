import { strict as assert } from "node:assert";
import { test } from "node:test";
import { getFirebaseCredential, saveFirebaseCredential, type D1DatabaseLike } from "./firebase-credential-store";
import { loadLinkedCowilaTrainingRecord, CowilaServiceError } from "./cowila-service";

const UID = "firebase-uid-123";
const EMAIL = "antonyopintor@gmail.com";
const KEY = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
const CONFIG = {
  projectId: "cowila-test-project",
  databaseId: "cowila-test-db",
  firebaseApiKey: "test-api-key",
  vaultKey: KEY,
};

class MemoryD1 implements D1DatabaseLike {
  row: Record<string, unknown> | null = null;
  prepare(query: string) {
    const db = this;
    let values: unknown[] = [];
    return {
      bind(...args: unknown[]) { values = args; return this; },
      async run() {
        if (query.includes("INSERT INTO firebase_link_credentials")) {
          db.row = {
            firebase_uid: values[0], email: values[1], vault_version: values[2],
            vault_algorithm: values[3], vault_nonce: values[4], vault_ciphertext: values[5],
            created_at: db.row?.created_at ?? values[6], updated_at: values[7], revoked_at: null,
          };
        }
        return { success: true };
      },
      async first<T>() { return db.row ? db.row as T : null; },
    };
  }
}

function firestoreDoc() {
  const str = (stringValue: string) => ({ stringValue });
  const int = (integerValue: number) => ({ integerValue: String(integerValue) });
  return {
    fields: {
      ownerUid: str(UID),
      schemaVersion: int(1),
      instructions: str("Keep the assistant honest."),
      updatedAt: int(1234),
      messages: { arrayValue: { values: [{ mapValue: { fields: {
        role: str("user"), content: str("Remember this context"), createdAt: int(1200),
      } } }] } },
    },
  };
}

async function seededDb() {
  const db = new MemoryD1();
  await saveFirebaseCredential(db, { uid: UID, email: EMAIL, refreshToken: "old-refresh-token" }, KEY, 1000);
  return db;
}

test("refreshes Firebase, rotates encrypted token, and reads only the Cowila v2 record", async () => {
  const db = await seededDb();
  const calls: string[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    const target = String(url);
    calls.push(target);
    if (target.startsWith("https://securetoken.googleapis.com/")) {
      const body = new URLSearchParams(String(init?.body));
      assert.equal(body.get("refresh_token"), "old-refresh-token");
      return Response.json({
        id_token: "fresh-firebase-id-token",
        refresh_token: "rotated-refresh-token",
        user_id: UID,
        expires_in: "3600",
        access_token: "not-used",
      });
    }
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer fresh-firebase-id-token");
    return Response.json(firestoreDoc());
  };

  const record = await loadLinkedCowilaTrainingRecord(db, UID, CONFIG, fetcher);
  assert.equal(record?.messages[0].content, "Remember this context");
  assert.equal(calls.length, 2);
  const stored = await getFirebaseCredential(db, UID, KEY);
  assert.equal(stored?.refreshToken, "rotated-refresh-token");
  assert.equal(JSON.stringify(record).includes("fresh-firebase-id-token"), false);
  assert.equal(JSON.stringify(record).includes("rotated-refresh-token"), false);
});

test("refuses to access Firestore when no Firebase account is linked", async () => {
  const db = new MemoryD1();
  let called = false;
  const fetcher: typeof fetch = async () => { called = true; return Response.json({}); };
  await assert.rejects(
    loadLinkedCowilaTrainingRecord(db, UID, CONFIG, fetcher),
    CowilaServiceError,
  );
  assert.equal(called, false);
});

test("does not query Firestore when Firebase refresh fails", async () => {
  const db = await seededDb();
  let firestoreCalled = false;
  const fetcher: typeof fetch = async (url) => {
    if (String(url).startsWith("https://securetoken.googleapis.com/")) {
      return Response.json({ error: { message: "INVALID_REFRESH_TOKEN" } }, { status: 400 });
    }
    firestoreCalled = true;
    return Response.json(firestoreDoc());
  };
  await assert.rejects(loadLinkedCowilaTrainingRecord(db, UID, CONFIG, fetcher), CowilaServiceError);
  assert.equal(firestoreCalled, false);
});

test("rejects UID mismatch from the Firebase refresh endpoint", async () => {
  const db = await seededDb();
  let firestoreCalled = false;
  const fetcher: typeof fetch = async (url) => {
    if (String(url).startsWith("https://securetoken.googleapis.com/")) {
      return Response.json({
        id_token: "wrong-id-token",
        refresh_token: "wrong-refresh-token",
        user_id: "another-uid",
        expires_in: "3600",
      });
    }
    firestoreCalled = true;
    return Response.json(firestoreDoc());
  };
  await assert.rejects(loadLinkedCowilaTrainingRecord(db, UID, CONFIG, fetcher), CowilaServiceError);
  assert.equal(firestoreCalled, false);
});
