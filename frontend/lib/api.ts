const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // FastAPI 422 returns detail as an array of validation errors
    if (Array.isArray(errorData.detail)) {
      const messages = errorData.detail.map((e: any) => `${e.loc?.slice(-1)[0]}: ${e.msg}`).join(", ");
      throw new Error(messages);
    }
    throw new Error(
      typeof errorData.detail === "string"
        ? errorData.detail
        : `API Request failed: ${response.status}`
    );
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: "GET" }),
  post: <T>(endpoint: string, data: any) => request<T>(endpoint, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data: any) => request<T>(endpoint, { method: "PUT", body: JSON.stringify(data) }),
  delete: (endpoint: string) => request(endpoint, { method: "DELETE" }),
};
