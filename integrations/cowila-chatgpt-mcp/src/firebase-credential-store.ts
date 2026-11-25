import { decryptRefreshToken, encryptRefreshToken, type EncryptedSecret } from "./secret-vault";

interface D1Result<T = unknown> {
  success?: boolean;
  results?: T[];
  meta?: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
}

interface CredentialRow {
  firebase_uid: string;
  email: string;
  vault_version: number;
  vault_algorithm: string;
  vault_nonce: string;
  vault_ciphertext: string;
  created_at: number;
  updated_at: number;
  revoked_at: number | null;
}

export interface LinkedFirebaseCredential {
  uid: string;
  email: string;
  refreshToken: string;
  createdAt: number;
  updatedAt: number;
}

export class FirebaseCredentialStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirebaseCredentialStoreError";
  }
}

function validateIdentity(uid: string, email: string): void {
  if (!uid || uid.length > 128 || !/^[A-Za-z0-9_-]+$/.test(uid)) {
    throw new FirebaseCredentialStoreError("Firebase UID is invalid.");
  }
  if (email !== "antonyopintor@gmail.com") {
    throw new FirebaseCredentialStoreError("Firebase account is not permitted.");
  }
}

function rowToEnvelope(row: CredentialRow): EncryptedSecret {
  if (
    row.vault_version !== 1 ||
    row.vault_algorithm !== "AES-GCM" ||
    !row.vault_nonce ||
    !row.vault_ciphertext
  ) {
    throw new FirebaseCredentialStoreError("Stored Firebase credential envelope is invalid.");
  }
  return {
    version: 1,
    algorithm: "AES-GCM",
    nonce: row.vault_nonce,
    ciphertext: row.vault_ciphertext,
  };
}

/** Stores only an AES-GCM envelope; plaintext refresh tokens never enter SQL. */
export async function saveFirebaseCredential(
  db: D1DatabaseLike,
  input: { uid: string; email: string; refreshToken: string },
  vaultKey: string,
  now = Date.now(),
): Promise<void> {
  validateIdentity(input.uid, input.email);
  if (!input.refreshToken) throw new FirebaseCredentialStoreError("Firebase refresh token is empty.");

  const envelope = await encryptRefreshToken(input.refreshToken, vaultKey);
  await db.prepare(
    `INSERT INTO firebase_link_credentials
      (firebase_uid, email, vault_version, vault_algorithm, vault_nonce, vault_ciphertext, created_at, updated_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(firebase_uid) DO UPDATE SET
       email = excluded.email,
       vault_version = excluded.vault_version,
       vault_algorithm = excluded.vault_algorithm,
       vault_nonce = excluded.vault_nonce,
       vault_ciphertext = excluded.vault_ciphertext,
       updated_at = excluded.updated_at,
       revoked_at = NULL`,
  ).bind(
    input.uid,
    input.email,
    envelope.version,
    envelope.algorithm,
    envelope.nonce,
    envelope.ciphertext,
    now,
    now,
  ).run();
}

/** Returns a decrypted token only to trusted server code, never to MCP tools. */
export async function getFirebaseCredential(
  db: D1DatabaseLike,
  uid: string,
  vaultKey: string,
): Promise<LinkedFirebaseCredential | null> {
  if (!uid || uid.length > 128 || !/^[A-Za-z0-9_-]+$/.test(uid)) {
    throw new FirebaseCredentialStoreError("Firebase UID is invalid.");
  }
  const row = await db.prepare(
    `SELECT firebase_uid, email, vault_version, vault_algorithm, vault_nonce, vault_ciphertext,
            created_at, updated_at, revoked_at
       FROM firebase_link_credentials
      WHERE firebase_uid = ? AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(uid).first<CredentialRow>();

  if (!row) return null;
  validateIdentity(row.firebase_uid, row.email);
  const refreshToken = await decryptRefreshToken(rowToEnvelope(row), vaultKey);
  return {
    uid: row.firebase_uid,
    email: row.email,
    refreshToken,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Deletes the stored secret immediately; OAuth grants must also be revoked separately. */
export async function deleteFirebaseCredential(
  db: D1DatabaseLike,
  uid: string,
): Promise<void> {
  if (!uid || uid.length > 128 || !/^[A-Za-z0-9_-]+$/.test(uid)) {
    throw new FirebaseCredentialStoreError("Firebase UID is invalid.");
  }
  await db.prepare(
    "DELETE FROM firebase_link_credentials WHERE firebase_uid = ?",
  ).bind(uid).run();
}
