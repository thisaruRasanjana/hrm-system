"use client";

import { useEffect, useState } from "react";
import { getMyDocuments, downloadDocument } from "../lib/documentApi";

const EMPLOYEE_ID = "PASTE_EMPLOYEE_UUID_HERE";

export default function DocumentList({ refresh }: { refresh: boolean }) {
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    // 🔒 Prevent server-side execution
    if (typeof window === "undefined") return;

    getMyDocuments(EMPLOYEE_ID)
      .then(setDocuments)
      .catch((err) => {
        console.error("Fetch failed:", err);
      });
  }, [refresh]);

  return (
    <div>
      <h2>My Documents</h2>

      {documents.map((doc) => (
        <div key={doc.id}>
          {doc.document_type} – {doc.status}
          <button
            onClick={() => downloadDocument(doc.id, EMPLOYEE_ID)}
          >
            Download
          </button>
        </div>
      ))}
    </div>
  );
}
