import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CowilaFirestoreError, readCowilaTrainingRecord } from "./firestore-cowila";

const input = {
  projectId: "cowila-test-project",
  databaseId: "cowila-test-db",
  uid: "firebase-uid-123",
  idToken: "firebase-id-token-secret",
};

function firestoreString(stringValue: string) { return { stringValue }; }
function firestoreInteger(integerValue: number) { return { integerValue: String(integerValue) }; }
function firestoreMap(fields: Record<string, unknown>) {
  return { mapValue: { fields } };
}
function validDocument(overrides: Record<string, unknown> = {}) {
  return {
    name: "projects/cowila-test-project/databases/cowila-test-db/documents/users/firebase-uid-123/cowilaLab/real-training-v2",
    fields: {
      ownerUid: firestoreString(input.uid),
      schemaVersion: firestoreInteger(1),
      instructions: firestoreString("Keep Cowila focused and honest."),
      updatedAt: firestoreInteger(1_800_000_000_000),
      messages: {
        arrayValue: {
          values: [
            firestoreMap({
              id: firestoreString("msg-1"),
              role: firestoreString("user"),
              content: firestoreString("Olá Cowila"),
              createdAt: firestoreInteger(1_800_000_000_000),
            }),
            firestoreMap({
              id: firestoreString("msg-2"),
              role: firestoreString("assistant"),
              content: firestoreString("Olá!"),
              createdAt: firestoreInteger(1_800_000_000_100),
              approvedForTraining: { booleanValue: true },
              rating: firestoreString("positive"),
            }),
          ],
        },
      },
      ...overrides,
    },
  };
}

test("reads only the v2 Cowila document using the Firebase user's bearer token", async () => {
  let requestedUrl = "";
  let authorization = "";
  const fetcher: typeof fetch = async (url, init) => {
    requestedUrl = String(url);
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return Response.json(validDocument());
  };
  const record = await readCowilaTrainingRecord(input, fetcher);
  assert.ok(record);
  assert.equal(record.ownerUid, input.uid);
  assert.equal(record.messages.length, 2);
  assert.equal(record.messages[1].approvedForTraining, true);
  assert.equal(record.instructions, "Keep Cowila focused and honest.");
  assert.match(requestedUrl, /documents\/users\/firebase-uid-123\/cowilaLab\/real-training-v2$/);
  assert.equal(authorization, `Bearer ${input.idToken}`);
});

test("rejects a Firestore response whose document name is not the exact requested path", async () => {
  const doc = validDocument();
  doc.name = "projects/cowila-test-project/databases/cowila-test-db/documents/users/another-user/cowilaLab/real-training-v2";
  const fetcher: typeof fetch = async () => Response.json(doc);
  await assert.rejects(readCowilaTrainingRecord(input, fetcher), CowilaFirestoreError);
});

test("rejects a Firestore response with no canonical document name", async () => {
  const doc = validDocument();
  delete (doc as { name?: string }).name;
  const fetcher: typeof fetch = async () => Response.json(doc);
  await assert.rejects(readCowilaTrainingRecord(input, fetcher), CowilaFirestoreError);
});

test("returns null when the v2 document does not exist", async () => {
  const fetcher: typeof fetch = async () => new Response(null, { status: 404 });
  assert.equal(await readCowilaTrainingRecord(input, fetcher), null);
});

test("rejects a record owned by a different UID", async () => {
  const doc = validDocument();
  doc.fields.ownerUid = firestoreString("another-user");
  const fetcher: typeof fetch = async () => Response.json(doc);
  await assert.rejects(readCowilaTrainingRecord(input, fetcher), CowilaFirestoreError);
});

test("rejects an unsupported schema version", async () => {
  const doc = validDocument();
  doc.fields.schemaVersion = firestoreInteger(2);
  const fetcher: typeof fetch = async () => Response.json(doc);
  await assert.rejects(readCowilaTrainingRecord(input, fetcher), CowilaFirestoreError);
});

test("sanitizes Firestore permission errors", async () => {
  const fetcher: typeof fetch = async () => Response.json({ error: "sensitive provider detail" }, { status: 403 });
  await assert.rejects(
    readCowilaTrainingRecord(input, fetcher),
    (error: unknown) => error instanceof CowilaFirestoreError && !error.message.includes("sensitive provider detail"),
  );
});

test("rejects invalid project and database configuration before network access", async () => {
  let called = false;
  const fetcher: typeof fetch = async () => { called = true; return Response.json({}); };
  await assert.rejects(readCowilaTrainingRecord({ ...input, databaseId: "projects/other" }, fetcher));
  assert.equal(called, false);
});

test("rejects records with more than 100 messages", async () => {
  const doc = validDocument();
  doc.fields.messages = { arrayValue: { values: Array.from({ length: 101 }, () => firestoreMap({
    role: firestoreString("user"),
    content: firestoreString("message"),
    createdAt: firestoreInteger(1),
  })) } };
  const fetcher: typeof fetch = async () => Response.json(doc);
  await assert.rejects(readCowilaTrainingRecord(input, fetcher), CowilaFirestoreError);
});
