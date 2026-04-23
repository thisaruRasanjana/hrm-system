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

const API_BASE = "http://127.0.0.1:8000";

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
  // Keep cookie in sync for middleware/SSR checks (same-tab scope via sessionStorage authority)
  document.cookie = `access_token=${token}; path=/; SameSite=Lax`;
}

/** Remove the access token for THIS tab only */
export function removeToken(): void {
  sessionStorage.removeItem("access_token");
  document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC";
}

async function refreshAccessToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) throw new Error("Refresh failed");

  const data = await res.json();
  setToken(data.access_token);   // ← sessionStorage
  return data.access_token;
}

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();   // ← sessionStorage (per-tab)

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status !== 401) {
    return response;
  }

  // 401 → try silent token refresh
  if (!isRefreshing) {
    isRefreshing = true;
    try {
      const newToken = await refreshAccessToken();
      isRefreshing = false;
      onRefreshed(newToken);
    } catch (err) {
      isRefreshing = false;
      removeToken();          // ← sessionStorage
      window.location.href = "/login";
      throw err;
    }
  }

  return new Promise((resolve) => {
    subscribeTokenRefresh((newToken: string) => {
      resolve(
        fetch(`${API_BASE}${url}`, {
          ...options,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${newToken}` },
          credentials: "include",
        })
      );
    });
  });
}