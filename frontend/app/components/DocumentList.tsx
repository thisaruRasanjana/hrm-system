"use client";

import { useEffect, useState } from "react";
import { getMyDocuments, downloadDocument } from "../api/documentApi";

const EMPLOYEE_ID = "PASTE_EMPLOYEE_UUID_HERE";

interface Document {
  id: string;
  document_type: string;
  status: string;
  uploaded_at: string;
}

export default function DocumentList({ refresh }: { refresh: boolean }) {
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    getMyDocuments(EMPLOYEE_ID).then((res) => setDocuments(res.data));
  }, [refresh]);

  return (
    <div className="mt-6">
      <h2 className="text-xl font-bold">My Documents</h2>

      <table className="w-full border mt-2">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Type</th>
            <th className="border p-2">Status</th>
            <th className="border p-2">Uploaded</th>
            <th className="border p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td className="border p-2">{doc.document_type}</td>
              <td className="border p-2">{doc.status}</td>
              <td className="border p-2">
                {new Date(doc.uploaded_at).toLocaleString()}
              </td>
              <td className="border p-2">
                <button
                  className="text-blue-600 underline"
                  onClick={() =>
                    downloadDocument(doc.id, EMPLOYEE_ID)
                  }
                >
                  Download
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
