const GOOGLE_SECURE_TOKEN_JWKS =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const CLOCK_SKEW_SECONDS = 60;
const MAX_AUTH_AGE_SECONDS = 10 * 60;

export interface VerifiedFirebaseIdentity {
  uid: string;
  email: string;
  emailVerified: true;
  authTime: number;
}

interface FirebaseIdTokenClaims {
  iss?: unknown;
  aud?: unknown;
  sub?: unknown;
  exp?: unknown;
  iat?: unknown;
  auth_time?: unknown;
  email?: unknown;
  email_verified?: unknown;
}

interface FirebaseJwkSet {
  keys?: JsonWebKey[];
}

export class FirebaseIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirebaseIdentityError";
  }
}

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new FirebaseIdentityError("Firebase identity token is malformed.");
  }
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new FirebaseIdentityError("Firebase identity token is malformed.");
  }
}

function decodeJsonPart<T>(value: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
  } catch {
    throw new FirebaseIdentityError("Firebase identity token is malformed.");
  }
}

/**
 * Verifies a Firebase ID token issued by the configured Firebase project.
 * Requires a recent authentication event to reduce account-linking risk.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string,
  allowedEmail: string,
  fetcher: typeof fetch = fetch,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<VerifiedFirebaseIdentity> {
  if (!idToken || !projectId || !allowedEmail) {
    throw new FirebaseIdentityError("Firebase identity verification is not configured.");
  }

  const parts = idToken.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new FirebaseIdentityError("Firebase identity token is malformed.");
  }

  const header = decodeJsonPart<{ alg?: unknown; kid?: unknown; typ?: unknown }>(parts[0]);
  const claims = decodeJsonPart<FirebaseIdTokenClaims>(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string" || header.typ !== "JWT") {
    throw new FirebaseIdentityError("Firebase identity token algorithm or header is invalid.");
  }

  const issuer = `https://securetoken.google.com/${projectId}`;
  if (claims.iss !== issuer || claims.aud !== projectId) {
    throw new FirebaseIdentityError("Firebase identity token issuer or audience is invalid.");
  }
  if (
    typeof claims.sub !== "string" ||
    claims.sub.length < 1 ||
    claims.sub.length > 128 ||
    typeof claims.exp !== "number" ||
    typeof claims.iat !== "number" ||
    typeof claims.auth_time !== "number"
  ) {
    throw new FirebaseIdentityError("Firebase identity token claims are incomplete.");
  }
  if (claims.exp <= nowSeconds - CLOCK_SKEW_SECONDS || claims.iat > nowSeconds + CLOCK_SKEW_SECONDS) {
    throw new FirebaseIdentityError("Firebase identity token is expired or not yet valid.");
  }
  if (
    claims.auth_time > nowSeconds + CLOCK_SKEW_SECONDS ||
    nowSeconds - claims.auth_time > MAX_AUTH_AGE_SECONDS
  ) {
    throw new FirebaseIdentityError("Recent Firebase reauthentication is required.");
  }
  if (claims.email !== allowedEmail || claims.email_verified !== true) {
    throw new FirebaseIdentityError("Firebase account is not the verified, permitted operator.");
  }

  const jwksResponse = await fetcher(GOOGLE_SECURE_TOKEN_JWKS, {
    method: "GET",
    headers: { accept: "application/json" },
  });
  if (!jwksResponse.ok) {
    throw new FirebaseIdentityError("Firebase signing keys could not be retrieved.");
  }

  let jwks: FirebaseJwkSet;
  try {
    jwks = (await jwksResponse.json()) as FirebaseJwkSet;
  } catch {
    throw new FirebaseIdentityError("Firebase signing keys response is invalid.");
  }
  const jwk = jwks.keys?.find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) {
    throw new FirebaseIdentityError("Firebase identity signing key is unknown.");
  }

  let validSignature = false;
  try {
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    validSignature = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    throw new FirebaseIdentityError("Firebase identity signature could not be verified.");
  }
  if (!validSignature) {
    throw new FirebaseIdentityError("Firebase identity signature is invalid.");
  }

  return {
    uid: claims.sub,
    email: allowedEmail,
    emailVerified: true,
    authTime: claims.auth_time,
  };
}
