export function getRole() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("role"); // "employee" | "hr"
}