export interface FirebaseTokenRefresh {
  idToken: string;
  refreshToken: string;
  uid: string;
  expiresInSeconds: number;
}

interface FirebaseRefreshApiResponse {
  access_token?: string;
  expires_in?: string;
  id_token?: string;
  refresh_token?: string;
  user_id?: string;
  error?: { message?: string };
}

export class FirebaseAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirebaseAuthError";
  }
}

/**
 * Exchanges a Firebase Secure Token refresh token for a fresh ID token.
 * The caller must keep both tokens out of logs and MCP tool arguments/results.
 */
export async function refreshFirebaseIdToken(
  refreshToken: string,
  apiKey: string,
  expectedUid: string,
  fetcher: typeof fetch = fetch,
): Promise<FirebaseTokenRefresh> {
  if (!refreshToken || !apiKey || !expectedUid) {
    throw new FirebaseAuthError("Firebase refresh configuration is incomplete.");
  }

  const response = await fetcher(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    },
  );

  if (!response.ok) {
    // Never include response bodies: provider errors can contain sensitive context.
    throw new FirebaseAuthError(`Firebase token refresh failed (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as FirebaseRefreshApiResponse;
  if (!payload.id_token || !payload.refresh_token || !payload.user_id || !payload.expires_in) {
    throw new FirebaseAuthError("Firebase token refresh returned an incomplete response.");
  }
  if (payload.user_id !== expectedUid) {
    throw new FirebaseAuthError("Firebase token subject does not match the linked account.");
  }

  const expiresInSeconds = Number(payload.expires_in);
  if (!Number.isSafeInteger(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new FirebaseAuthError("Firebase token refresh returned an invalid expiry.");
  }

  return {
    idToken: payload.id_token,
    refreshToken: payload.refresh_token,
    uid: payload.user_id,
    expiresInSeconds,
  };
}
