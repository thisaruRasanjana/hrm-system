const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (err: any) {
    throw new Error(`Network Error: Could not connect to API at ${url}. Please ensure the backend is running. (${err.message})`);
  }

  if (!response.ok) {
    let errorMessage = `API Request failed: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        if (Array.isArray(errorData.detail)) {
          // FastAPI validation error format: [{"msg": "...", "loc": [...]}, ...]
          errorMessage = errorData.detail.map((err: any) =>
            err.msg ? `${err.loc?.join(".") || "error"}: ${err.msg}` : JSON.stringify(err)
          ).join(", ");
        } else if (typeof errorData.detail === "string") {
          errorMessage = errorData.detail;
        } else {
          errorMessage = JSON.stringify(errorData.detail);
        }
      } else {
        errorMessage = JSON.stringify(errorData);
      }
    } catch {
      // If response is not JSON, just use status message
      errorMessage = `API Error ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: "GET" }),
  post: <T>(endpoint: string, data: any) => request<T>(endpoint, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data: any) => request<T>(endpoint, { method: "PUT", body: JSON.stringify(data) }),
  delete: (endpoint: string) => request(endpoint, { method: "DELETE" }),
};
