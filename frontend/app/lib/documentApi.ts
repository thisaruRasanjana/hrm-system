import { apiFetch } from "@/lib/api";

export const uploadDocument = async (formData: FormData) => {
  const res = await apiFetch("/documents/upload", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
};

export const getMyDocuments = async () => {
  const res = await apiFetch("/documents/my-documents");
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
};

export const downloadDocument = async (documentId: string) => {
  const res = await apiFetch(`/documents/download/${documentId}`);
  if (!res.ok) throw new Error("File not found");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.click();
  window.URL.revokeObjectURL(url);
};
