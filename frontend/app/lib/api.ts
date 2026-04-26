/**
 * app/lib/api.ts
 * --------------
 * Centralised API configuration and shared request helpers.
 *
 * WHY a single file for this:
 *   Hardcoding "http://127.0.0.1:8000" in every fetch() call means a URL
 *   change requires grep-and-replace across the entire frontend. Using one
 *   constant means a single edit propagates everywhere.
 *
 *   The console.log in getAuthHeaders has been removed — it would print
 *   user credentials on every API call in production browser consoles.
 */

/** Backend base URL. Override via NEXT_PUBLIC_API_BASE_URL in .env.local */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

/**
 * Build authentication headers from localStorage.
 *
 * The backend uses a gateway-style auth model: the user ID and role are
 * passed as custom headers (x-user-id, x-user-roles) on every request.
 *
 * Returns a safe empty object during SSR (window is undefined) so
 * Next.js server-side rendering does not crash.
 */
export function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") {
    // Server-side rendering — no localStorage available.
    return { "Content-Type": "application/json" };
  }

  const userId = localStorage.getItem("userId") ?? "";
  const role   = localStorage.getItem("role")   ?? "";

  return {
    "Content-Type": "application/json",
    "x-user-id":    userId,
    "x-user-roles": role,
  };
}

/**
 * Perform an authenticated GET request and return the parsed JSON body.
 *
 * Throws an Error with the server's detail message if the response is not ok,
 * so callers receive a human-readable string rather than a raw Response object.
 *
 * @param path - Path relative to API_BASE_URL (e.g. "/leave/balance/me")
 */
export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `Request failed with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Perform an authenticated request with a JSON body (POST / PUT / PATCH).
 *
 * @param method  - HTTP method string
 * @param path    - Path relative to API_BASE_URL
 * @param payload - Object to serialise as the request body
 */
export async function apiRequest<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  payload?: unknown,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: getAuthHeaders(),
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `Request failed with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}