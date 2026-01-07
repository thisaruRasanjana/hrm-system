// Upload document (via Next.js proxy)
export const uploadDocument = async (formData: FormData) => {
  const res = await fetch("/api/proxy/documents", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Upload failed");
  }

  return res.json();
};

// Get documents (via Next.js proxy)
export const getMyDocuments = async (employeeId: string) => {
  const res = await fetch(
    `/api/proxy/documents?employee_id=${employeeId}`
  );

  if (!res.ok) {
    throw new Error("Failed to fetch documents");
  }

  return res.json();
};

// Download document (direct from backend)
export const downloadDocument = (
  documentId: string,
  employeeId: string
) => {
  window.open(
    `http://127.0.0.1:8000/documents/download/${documentId}?employee_id=${employeeId}`,
    "_blank"
  );
};
