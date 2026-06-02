/**
 * api.ts — Central HTTP client for the HRM system.
 *
 * TOKEN STORAGE: sessionStorage (NOT localStorage)
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL is not set in .env.local");
}

const REFRESH_THRESHOLD_MS = parseInt(
  process.env.NEXT_PUBLIC_TOKEN_REFRESH_THRESHOLD_MINUTES ?? "3"
) * 60 * 1000;

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("access_token");
}

export function setToken(token: string): void {
  sessionStorage.setItem("access_token", token);
  document.cookie = `access_token=${token}; path=/; SameSite=Lax`;
}

export function removeToken(): void {
  sessionStorage.removeItem("access_token");
  document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC";
}

function isTokenExpiringSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresAt = payload.exp * 1000;
    return expiresAt < Date.now() + REFRESH_THRESHOLD_MS;
  } catch {
    return true;
  }
}

export async function refreshAccessToken(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("Unauthorized");
    }
    throw new Error("Refresh failed");
  }
  const data = await res.json();
  setToken(data.access_token);
  return data.access_token;
}

/**
 * handleRefreshFlow ensures only one refresh request happens at a time.
 * All concurrent calls will wait for the same promise.
 */
export async function handleRefreshFlow(): Promise<string> {
  if (isRefreshing) {
    return new Promise((resolve) => subscribeTokenRefresh(resolve));
  }

  isRefreshing = true;
  try {
    const newToken = await refreshAccessToken();
    isRefreshing = false;
    onRefreshed(newToken);
    return newToken;
  } catch (err: any) {
    isRefreshing = false;
    if (err.message === "Unauthorized") {
      removeToken();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    throw err;
  }
}


// ── Core fetch with auto-refresh + FastAPI error parsing ────────────

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  let token = getToken();

  // Proactive refresh
  if (token && isTokenExpiringSoon(token)) {
    try {
      token = await handleRefreshFlow();
    } catch {
      throw new Error("Session expired");
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, credentials: "include" });
  } catch (err: any) {
    throw new Error(
      `Network Error: Could not connect to API at ${url}. Please ensure the backend is running. (${err.message})`
    );
  }

  // 401 → silent token refresh then retry
  if (response.status === 401) {
    // Don't attempt refresh on login endpoint — 401 means wrong credentials
    if (url.includes('/auth/login')) {
      // Return response so the downstream error handler can parse the detail
      // We don't return early here because `request` needs to throw the parsed error
    } else {
      try {
        const newToken = await handleRefreshFlow();
        return request<T>(endpoint, {
          ...options,
          headers: { ...headers, Authorization: `Bearer ${newToken}` },
        });
      } catch (err) {
        throw err;
      }
    }
  }

  if (!response.ok) {
    let errorMessage = `API Request failed: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail
            .map((err: any) =>
              err.msg ? `${err.loc?.join(".") || "error"}: ${err.msg}` : JSON.stringify(err)
            )
            .join(", ");
        } else if (typeof errorData.detail === "string") {
          errorMessage = errorData.detail;
        } else {
          errorMessage = JSON.stringify(errorData.detail);
        }
      } else {
        errorMessage = JSON.stringify(errorData);
      }
    } catch {
      errorMessage = `API Error ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : { success: true }) as T;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: "GET" }),
  post: <T>(endpoint: string, data: any) =>
    request<T>(endpoint, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data: any) =>
    request<T>(endpoint, { method: "PUT", body: JSON.stringify(data) }),
  delete: (endpoint: string) => request(endpoint, { method: "DELETE" }),
};

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = getToken();

  // Proactive refresh
  if (token && isTokenExpiringSoon(token)) {
    try {
      token = await handleRefreshFlow();
    } catch {
      throw new Error("Session expired");
    }
  }

  let headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let response = await fetch(`${API_BASE_URL}${url}`, { ...options, headers, credentials: "include" });

  // 401 Interceptor and Retry
  if (response.status === 401) {
    // Don't attempt refresh on login endpoint — 401 means wrong credentials
    if (url.includes('/auth/login')) {
      return response;
    }
    try {
      const newToken = await handleRefreshFlow();
      const newHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
      return fetch(`${API_BASE_URL}${url}`, { ...options, headers: newHeaders, credentials: "include" });
    } catch (err) {
      throw err;
    }
  }

  return response;
}
