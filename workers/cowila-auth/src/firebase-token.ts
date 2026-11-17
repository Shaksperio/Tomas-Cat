const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

export interface VerifiedFirebaseIdentity {
  uid: string;
  email: string;
  emailVerified: true;
  provider: "google.com";
  authTime: number;
}

interface FirebaseClaims {
  aud?: unknown;
  auth_time?: unknown;
  email?: unknown;
  email_verified?: unknown;
  exp?: unknown;
  firebase?: { sign_in_provider?: unknown };
  iat?: unknown;
  iss?: unknown;
  sub?: unknown;
}

interface FirebaseJwkSet {
  keys?: JsonWebKey[];
}

export class FirebaseTokenError extends Error {
  constructor(message = "Firebase ID token is invalid.") {
    super(message);
    this.name = "FirebaseTokenError";
  }
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonPart<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

async function loadSigningKey(kid: string, fetcher: typeof fetch): Promise<JsonWebKey> {
  const response = await fetcher(FIREBASE_JWKS_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error(`Firebase signing-key service returned HTTP ${response.status}.`);
  }

  const keySet = await response.json() as FirebaseJwkSet;
  const key = keySet.keys?.find((candidate) => {
    const metadata = candidate as JsonWebKey & { kid?: string; alg?: string; use?: string };
    return metadata.kid === kid && metadata.kty === "RSA" && metadata.alg === "RS256" && metadata.use === "sig";
  });

  if (!key) throw new FirebaseTokenError("Firebase signing key was not found.");
  return key;
}

export async function verifyFirebaseGoogleIdToken(
  token: string,
  projectId: string,
  allowedEmails: readonly string[],
  nowSeconds = Math.floor(Date.now() / 1000),
  fetcher: typeof fetch = fetch,
): Promise<VerifiedFirebaseIdentity> {
  if (!projectId.trim() || token.length > 16_384 || token.length < 32) {
    throw new FirebaseTokenError();
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) throw new FirebaseTokenError();

  let header: { alg?: unknown; kid?: unknown; typ?: unknown };
  let claims: FirebaseClaims;
  try {
    header = decodeJsonPart(parts[0]);
    claims = decodeJsonPart(parts[1]);
  } catch {
    throw new FirebaseTokenError();
  }

  if (header.alg !== "RS256" || typeof header.kid !== "string" || header.typ !== "JWT") {
    throw new FirebaseTokenError();
  }

  const key = await loadSigningKey(header.kid, fetcher);
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = decodeBase64Url(parts[2]);
  const signatureValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signature,
    signingInput,
  );
  if (!signatureValid) throw new FirebaseTokenError();

  const uid = typeof claims.sub === "string" ? claims.sub : "";
  const email = typeof claims.email === "string" ? normalizeEmail(claims.email) : "";
  const allowed = new Set(allowedEmails.map(normalizeEmail).filter(Boolean));
  const firebaseProvider = claims.firebase?.sign_in_provider;

  if (
    claims.iss !== `https://securetoken.google.com/${projectId}` ||
    claims.aud !== projectId ||
    !uid ||
    uid.length > 128 ||
    typeof claims.iat !== "number" ||
    claims.iat > nowSeconds + 60 ||
    typeof claims.exp !== "number" ||
    claims.exp <= nowSeconds ||
    typeof claims.auth_time !== "number" ||
    claims.auth_time <= 0 ||
    claims.auth_time > nowSeconds + 60 ||
    !email ||
    claims.email_verified !== true ||
    firebaseProvider !== "google.com" ||
    !allowed.has(email)
  ) {
    throw new FirebaseTokenError();
  }

  return {
    uid,
    email,
    emailVerified: true,
    provider: "google.com",
    authTime: claims.auth_time,
  };
}
