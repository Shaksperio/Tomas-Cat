import { FirebaseIdentityError, verifyFirebaseIdToken } from "./firebase-identity";

const FIREBASE_IDENTITY_TOOLKIT = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp";

export interface FirebaseGoogleExchangeResult {
  uid: string;
  email: string;
  refreshToken: string;
}

interface IdentityToolkitResponse {
  localId?: unknown;
  email?: unknown;
  idToken?: unknown;
  refreshToken?: unknown;
  providerId?: unknown;
}

export class FirebaseGoogleExchangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirebaseGoogleExchangeError";
  }
}

/**
 * Exchanges a short-lived Google OAuth access token for a Firebase session.
 * The refresh token is secret material: encrypt it immediately and never
 * return it to an MCP client or write it to logs.
 */
export async function exchangeGoogleTokenForFirebaseSession(
  input: {
    googleAccessToken: string;
    firebaseApiKey: string;
    firebaseProjectId: string;
    allowedEmail: string;
    callbackUri: string;
  },
  fetcher: typeof fetch = fetch,
): Promise<FirebaseGoogleExchangeResult> {
  if (!input.googleAccessToken || !input.firebaseApiKey || !input.firebaseProjectId || !input.allowedEmail) {
    throw new FirebaseGoogleExchangeError("Firebase Google sign-in is not configured.");
  }

  let callback: URL;
  try {
    callback = new URL(input.callbackUri);
  } catch {
    throw new FirebaseGoogleExchangeError("Firebase callback URL is invalid.");
  }
  if (callback.protocol !== "https:" || callback.username || callback.password) {
    throw new FirebaseGoogleExchangeError("Firebase callback URL must use HTTPS.");
  }

  const postBody = new URLSearchParams({
    access_token: input.googleAccessToken,
    providerId: "google.com",
  });

  let response: Response;
  try {
    response = await fetcher(`${FIREBASE_IDENTITY_TOOLKIT}?key=${encodeURIComponent(input.firebaseApiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        postBody: postBody.toString(),
        requestUri: callback.toString(),
        returnIdpCredential: false,
        returnSecureToken: true,
      }),
    });
  } catch {
    throw new FirebaseGoogleExchangeError("Firebase Google sign-in is temporarily unavailable.");
  }

  if (!response.ok) {
    throw new FirebaseGoogleExchangeError("Firebase rejected the Google sign-in exchange.");
  }

  let result: IdentityToolkitResponse;
  try {
    result = (await response.json()) as IdentityToolkitResponse;
  } catch {
    throw new FirebaseGoogleExchangeError("Firebase sign-in response is invalid.");
  }

  if (
    typeof result.localId !== "string" ||
    !result.localId ||
    typeof result.email !== "string" ||
    typeof result.idToken !== "string" ||
    !result.idToken ||
    typeof result.refreshToken !== "string" ||
    !result.refreshToken ||
    result.providerId !== "google.com"
  ) {
    throw new FirebaseGoogleExchangeError("Firebase sign-in response is incomplete.");
  }

  let identity;
  try {
    identity = await verifyFirebaseIdToken(result.idToken, input.firebaseProjectId, input.allowedEmail, fetcher);
  } catch (error) {
    if (error instanceof FirebaseIdentityError) {
      throw new FirebaseGoogleExchangeError("Firebase identity could not be verified.");
    }
    throw error;
  }

  if (identity.uid !== result.localId || identity.email !== result.email) {
    throw new FirebaseGoogleExchangeError("Firebase identity response does not match its signed token.");
  }

  return { uid: identity.uid, email: identity.email, refreshToken: result.refreshToken };
}
