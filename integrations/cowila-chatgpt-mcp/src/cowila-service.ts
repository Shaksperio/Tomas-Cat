import { refreshFirebaseIdToken } from "./firebase-auth";
import {
  getFirebaseCredential,
  saveFirebaseCredential,
  type D1DatabaseLike,
} from "./firebase-credential-store";
import { readCowilaTrainingRecord, type CowilaTrainingRecord } from "./firestore-cowila";

export interface CowilaServiceConfig {
  projectId: string;
  databaseId: string;
  firebaseApiKey: string;
  vaultKey: string;
}

export class CowilaServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CowilaServiceError";
  }
}

/**
 * Refreshes the linked Firebase session, persists the rotated refresh token
 * encrypted, then reads only the Cowila v2 document. The ID token stays inside
 * this server-side function and is never returned to MCP callers.
 */
export async function loadLinkedCowilaTrainingRecord(
  db: D1DatabaseLike,
  uid: string,
  config: CowilaServiceConfig,
  fetcher: typeof fetch = fetch,
): Promise<CowilaTrainingRecord | null> {
  let credential;
  try {
    credential = await getFirebaseCredential(db, uid, config.vaultKey);
  } catch {
    throw new CowilaServiceError("The linked Firebase credential could not be loaded.");
  }
  if (!credential) {
    throw new CowilaServiceError("The Cowila Firebase account is not linked. Reconnect the account first.");
  }

  let session;
  try {
    session = await refreshFirebaseIdToken(
      credential.refreshToken,
      config.firebaseApiKey,
      uid,
      fetcher,
    );
  } catch {
    throw new CowilaServiceError("The Firebase session could not be refreshed. Reconnect the account or retry later.");
  }

  try {
    await saveFirebaseCredential(
      db,
      { uid, email: credential.email, refreshToken: session.refreshToken },
      config.vaultKey,
    );
  } catch {
    throw new CowilaServiceError("The rotated Firebase credential could not be stored securely.");
  }

  try {
    return await readCowilaTrainingRecord({
      projectId: config.projectId,
      databaseId: config.databaseId,
      uid,
      idToken: session.idToken,
    }, fetcher);
  } catch {
    throw new CowilaServiceError("The Cowila Firestore record could not be read with the linked account.");
  }
}
