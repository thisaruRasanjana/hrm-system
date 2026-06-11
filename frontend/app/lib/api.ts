export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") {
    return {
      "Content-Type": "application/json",
    };
  }

  const userId = localStorage.getItem("userId") || "";
  const role = localStorage.getItem("role") || "";

  console.log("Sending headers:", { userId, role });

  return {
    "Content-Type": "application/json",
    "x-user-id": userId,
    "x-user-roles": role,
  };
}