interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
  nullValue?: string;
}

interface FirestoreDocument {
  name?: string;
  fields?: Record<string, FirestoreValue>;
}

export interface CowilaTrainingMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  rating?: string;
  feedback?: string;
  approvedForTraining?: boolean;
  latencyMs?: number;
}

export interface CowilaTrainingRecord {
  schemaVersion: 1;
  ownerUid: string;
  messages: CowilaTrainingMessage[];
  instructions: string;
  updatedAt: number;
}

export class CowilaFirestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CowilaFirestoreError";
  }
}

function decodeValue(value: FirestoreValue, depth = 0): unknown {
  if (depth > 5) throw new CowilaFirestoreError("Cowila Firestore document nesting is too deep.");
  if (typeof value.stringValue === "string") return value.stringValue.slice(0, 10_000);
  if (typeof value.integerValue === "string") {
    const parsed = Number(value.integerValue);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  if (typeof value.doubleValue === "number" && Number.isFinite(value.doubleValue)) return value.doubleValue;
  if (typeof value.booleanValue === "boolean") return value.booleanValue;
  if (typeof value.timestampValue === "string") return value.timestampValue;
  if (value.nullValue !== undefined) return null;
  if (value.arrayValue) {
    const values = value.arrayValue.values ?? [];
    if (values.length > 100) throw new CowilaFirestoreError("Cowila Firestore array exceeds its safe limit.");
    return values.map((item) => decodeValue(item, depth + 1));
  }
  if (value.mapValue) {
    const fields = value.mapValue.fields ?? {};
    const entries = Object.entries(fields);
    if (entries.length > 30) throw new CowilaFirestoreError("Cowila Firestore object exceeds its safe field limit.");
    return Object.fromEntries(entries.map(([key, item]) => [key, decodeValue(item, depth + 1)]));
  }
  return null;
}

function numberField(fields: Record<string, FirestoreValue>, key: string): number | null {
  const value = decodeValue(fields[key] ?? {});
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringField(fields: Record<string, FirestoreValue>, key: string): string | null {
  const value = decodeValue(fields[key] ?? {});
  return typeof value === "string" ? value : null;
}

function parseMessage(value: unknown): CowilaTrainingMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    (item.role !== "user" && item.role !== "assistant") ||
    typeof item.content !== "string" ||
    typeof item.createdAt !== "number" ||
    !Number.isFinite(item.createdAt)
  ) return null;

  const message: CowilaTrainingMessage = {
    role: item.role,
    content: item.content.slice(0, 10_000),
    createdAt: item.createdAt,
  };
  if (typeof item.id === "string") message.id = item.id.slice(0, 128);
  if (typeof item.rating === "string") message.rating = item.rating.slice(0, 32);
  if (typeof item.feedback === "string") message.feedback = item.feedback.slice(0, 2_000);
  if (typeof item.approvedForTraining === "boolean") message.approvedForTraining = item.approvedForTraining;
  if (typeof item.latencyMs === "number" && Number.isFinite(item.latencyMs)) message.latencyMs = item.latencyMs;
  return message;
}

/**
 * Reads only users/{uid}/cowilaLab/real-training-v2 using the user's Firebase ID token.
 * Firestore Security Rules remain in force; no service-account bypass is used.
 */
export async function readCowilaTrainingRecord(input: {
  projectId: string;
  databaseId: string;
  uid: string;
  idToken: string;
}, fetcher: typeof fetch = fetch): Promise<CowilaTrainingRecord | null> {
  if (
    !/^[a-z][a-z0-9-]{2,62}$/.test(input.projectId) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(input.databaseId) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(input.uid) ||
    !input.idToken
  ) {
    throw new CowilaFirestoreError("Cowila Firestore request configuration is invalid.");
  }

  const path = [
    "users", input.uid, "cowilaLab", "real-training-v2",
  ].map(encodeURIComponent).join("/");
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(input.projectId)}/databases/${encodeURIComponent(input.databaseId)}/documents/${path}`;

  let response: Response;
  try {
    response = await fetcher(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${input.idToken}`,
        accept: "application/json",
      },
    });
  } catch {
    throw new CowilaFirestoreError("Cowila Firestore is temporarily unavailable.");
  }

  if (response.status === 404) return null;
  if (response.status === 401 || response.status === 403) {
    throw new CowilaFirestoreError("Firebase account is not authorized to read this Cowila record.");
  }
  if (!response.ok) {
    throw new CowilaFirestoreError("Cowila Firestore read failed.");
  }

  let raw: string;
  try {
    raw = await response.text();
  } catch {
    throw new CowilaFirestoreError("Cowila Firestore response could not be read.");
  }
  if (raw.length > 900_000) {
    throw new CowilaFirestoreError("Cowila Firestore record exceeds the safe response limit.");
  }

  let document: FirestoreDocument;
  try {
    document = JSON.parse(raw) as FirestoreDocument;
  } catch {
    throw new CowilaFirestoreError("Cowila Firestore returned an invalid document.");
  }
  const fields = document.fields;
  if (!fields) throw new CowilaFirestoreError("Cowila Firestore record has no fields.");

  const ownerUid = stringField(fields, "ownerUid");
  const schemaVersion = numberField(fields, "schemaVersion");
  const instructions = stringField(fields, "instructions");
  const updatedAt = numberField(fields, "updatedAt");
  const decodedMessages = decodeValue(fields.messages ?? {});
  if (
    ownerUid !== input.uid ||
    schemaVersion !== 1 ||
    typeof instructions !== "string" ||
    instructions.length > 1_500 ||
    updatedAt === null ||
    !Array.isArray(decodedMessages) ||
    decodedMessages.length > 100
  ) {
    throw new CowilaFirestoreError("Cowila Firestore record failed its ownership or schema checks.");
  }

  return {
    schemaVersion: 1,
    ownerUid,
    messages: decodedMessages.map(parseMessage).filter((item): item is CowilaTrainingMessage => item !== null),
    instructions,
    updatedAt,
  };
}
