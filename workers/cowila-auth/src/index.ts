import { FirebaseTokenError, verifyFirebaseGoogleIdToken } from "./firebase-token";

export interface Env {
  FIREBASE_PROJECT_ID: string;
  ALLOWED_GOOGLE_EMAILS: string;
  ALLOWED_ORIGINS: string;
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
};

function allowedOrigins(env: Env): Set<string> {
  return new Set((env.ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean));
}

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, cors?: HeadersInit): Response {
  const headers = new Headers(JSON_HEADERS);
  if (cors) new Headers(cors).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(body), { status, headers });
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization");
  const match = authorization?.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  return match?.[1] ?? null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "cowila-auth", stage: "identity-verification" }, 200);
    }

    if (url.pathname !== "/v1/auth/verify") {
      return json({ error: "not_found" }, 404);
    }

    const origin = request.headers.get("Origin");
    const origins = allowedOrigins(env);
    if (!origin || !origins.has(origin)) {
      return json({ error: "origin_not_allowed" }, 403);
    }
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, cors);
    }

    if (!env.FIREBASE_PROJECT_ID?.trim() || !env.ALLOWED_GOOGLE_EMAILS?.trim()) {
      return json({ error: "service_not_configured" }, 503, cors);
    }

    const token = bearerToken(request);
    if (!token) return json({ error: "unauthorized" }, 401, cors);

    try {
      const identity = await verifyFirebaseGoogleIdToken(
        token,
        env.FIREBASE_PROJECT_ID,
        env.ALLOWED_GOOGLE_EMAILS.split(","),
      );
      return json({ ok: true, identity }, 200, cors);
    } catch (error) {
      if (error instanceof FirebaseTokenError) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      // Do not log or return tokens, claims, emails, or upstream response bodies.
      console.error(JSON.stringify({
        event: "firebase_identity_verification_unavailable",
        reason: error instanceof Error ? error.message : "unknown",
      }));
      return json({ error: "identity_verification_unavailable" }, 503, cors);
    }
  },
};
