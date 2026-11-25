const GOOGLE_AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export class GoogleOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleOAuthError";
  }
}

function requireHttpsCallback(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new GoogleOAuthError("Google OAuth callback URL is invalid.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new GoogleOAuthError("Google OAuth callback URL must be a clean HTTPS URL.");
  }
  return url;
}

/**
 * Builds the Google authorization URL after Cloudflare's beginUpstream()
 * has created browser-bound, single-use state. PKCE verifier remains server-side.
 */
export function buildGoogleAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  if (!input.clientId || !input.state || !/^[A-Za-z0-9_-]{16,512}$/.test(input.state)) {
    throw new GoogleOAuthError("Google OAuth authorization parameters are invalid.");
  }
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(input.codeChallenge)) {
    throw new GoogleOAuthError("Google OAuth PKCE challenge is invalid.");
  }
  const redirect = requireHttpsCallback(input.redirectUri);
  const url = new URL(GOOGLE_AUTHORIZE_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: redirect.toString(),
    response_type: "code",
    scope: "openid email profile",
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  }).toString();
  return url.toString();
}

/**
 * Exchanges the authorization code returned to the fixed callback.
 * Call only after Cloudflare finishUpstream() has validated its browser-bound state.
 */
export async function exchangeGoogleAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}, fetcher: typeof fetch = fetch): Promise<{ accessToken: string; expiresIn: number }> {
  if (
    !input.code ||
    !input.clientId ||
    !input.clientSecret ||
    !/^[A-Za-z0-9._~-]{43,128}$/.test(input.codeVerifier)
  ) {
    throw new GoogleOAuthError("Google OAuth code exchange parameters are invalid.");
  }
  const redirect = requireHttpsCallback(input.redirectUri);
  const body = new URLSearchParams({
    code: input.code,
    code_verifier: input.codeVerifier,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: redirect.toString(),
    grant_type: "authorization_code",
  });

  let response: Response;
  try {
    response = await fetcher(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    throw new GoogleOAuthError("Google OAuth token exchange is temporarily unavailable.");
  }
  if (!response.ok) {
    throw new GoogleOAuthError("Google rejected the OAuth authorization code.");
  }

  let result: { access_token?: unknown; token_type?: unknown; expires_in?: unknown };
  try {
    result = (await response.json()) as typeof result;
  } catch {
    throw new GoogleOAuthError("Google OAuth token response is invalid.");
  }
  if (
    typeof result.access_token !== "string" ||
    !result.access_token ||
    result.token_type !== "Bearer" ||
    typeof result.expires_in !== "number" ||
    !Number.isFinite(result.expires_in) ||
    result.expires_in <= 0
  ) {
    throw new GoogleOAuthError("Google OAuth token response is incomplete.");
  }
  return { accessToken: result.access_token, expiresIn: result.expires_in };
}
