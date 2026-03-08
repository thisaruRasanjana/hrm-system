const API_BASE = "http://127.0.0.1:8000";

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

async function refreshAccessToken() {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Refresh failed");
  }

  const data = await res.json();

  localStorage.setItem("access_token", data.access_token);

  document.cookie = `access_token=${data.access_token}; path=/`;

  return data.access_token;
}

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let token = localStorage.getItem("access_token");

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

  // Token expired → refresh
  if (!isRefreshing) {
    isRefreshing = true;

    try {
      const newToken = await refreshAccessToken();
      isRefreshing = false;
      onRefreshed(newToken);
    } catch (err) {
      isRefreshing = false;
      localStorage.removeItem("access_token");
      window.location.href = "/login";
      throw err;
    }
  }

  return new Promise((resolve) => {
    subscribeTokenRefresh((newToken: string) => {
      const retryHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newToken}`,
      };

      resolve(
        fetch(`${API_BASE}${url}`, {
          ...options,
          headers: retryHeaders,
          credentials: "include",
        })
      );
    });
  });
}