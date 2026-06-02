import { getToken } from "@/lib/api";

const API = "http://localhost:8000";

function authHeaders(json = false): Record<string, string> {
  const token = getToken();
  const h: Record<string, string> = {};
  if (token) h["Authorization"] = `Bearer ${token}`;
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export const uploadDocument = async (formData: FormData) => {
  const res = await fetch(`${API}/documents/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
};

export const getMyDocuments = async () => {
  const res = await fetch(`${API}/documents/my-documents`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
};

export const downloadDocument = (documentId: string) => {
  const token = getToken();
  const url = `${API}/documents/download/${documentId}`;
  // Open with token in URL query as fallback for browser downloads
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  if (token) {
    // Fetch and create blob URL so we can attach the auth header
    fetch(url, { headers: { "Authorization": `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        a.href = URL.createObjectURL(blob);
        a.click();
      });
  } else {
    a.click();
  }
};
