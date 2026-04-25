/**
 * api.ts — Central HTTP client for the HRM system.
 *
 * TOKEN STORAGE: sessionStorage (NOT localStorage)
 * ─────────────────────────────────────────────────
 * sessionStorage is PER-TAB isolated. Each browser tab has its own
 * independent storage. This means:
 *   - Tab A logged in as admin  → sees admin data only
 *   - Tab B logged in as employee1 → sees employee1 data only
 *   - Refreshing Tab A → still sees admin data (sessionStorage survives refresh)
 *   - Tab A refresh does NOT affect Tab B (unlike localStorage which is shared!)
 *
 * For password-reset flow (cross-page within same tab), reset_email still uses
 * sessionStorage, which is fine because it's the same tab.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

/** Read the access token for THIS tab only */
export function getToken(): string | null {
  return sessionStorage.getItem("access_token");
}

/** Store the access token for THIS tab only */
export function setToken(token: string): void {
  sessionStorage.setItem("access_token", token);
  document.cookie = `access_token=${token}; path=/; SameSite=Lax`;
}

/** Remove the access token for THIS tab only */
export function removeToken(): void {
  sessionStorage.removeItem("access_token");
  document.cookie =
    "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC";
}

async function refreshAccessToken(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Refresh failed");
  const data = await res.json();
  setToken(data.access_token);
  return data.access_token;
}

// ── Core fetch with auto-refresh + FastAPI error parsing (from dev) ────────────

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch (err: any) {
    throw new Error(
      `Network Error: Could not connect to API at ${url}. Please ensure the backend is running. (${err.message})`,
    );
  }

  // 401 → silent token refresh then retry
  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        onRefreshed(newToken);
      } catch (err) {
        isRefreshing = false;
        removeToken();
        window.location.href = "/login";
        throw err;
      }
    }

    return new Promise((resolve) => {
      subscribeTokenRefresh((newToken: string) => {
        resolve(
          request<T>(endpoint, {
            ...options,
            headers: { ...headers, Authorization: `Bearer ${newToken}` },
          }),
        );
      });
    });
  }

  if (!response.ok) {
    // FastAPI detailed error parsing (from dev)
    let errorMessage = `API Request failed: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail
            .map((err: any) =>
              err.msg
                ? `${err.loc?.join(".") || "error"}: ${err.msg}`
                : JSON.stringify(err),
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

  return response.json();
}

// ── Simple api shorthand (from dev) ───────────────────────────────────────────

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: "GET" }),
  post: <T>(endpoint: string, data: any) =>
    request<T>(endpoint, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data: any) =>
    request<T>(endpoint, { method: "PUT", body: JSON.stringify(data) }),
  patch: <T>(endpoint: string, data: any) =>
    request<T>(endpoint, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (endpoint: string) => request(endpoint, { method: "DELETE" }),
};

// ── Raw fetch wrapper (from Sanduni) — used by auth context ───────────────────

export async function apiFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
    credentials: "include",
  });
}
