"use client";

import { useEffect, useState } from "react";

const EMPLOYEE_ID = "11111111-1111-1111-1111-111111111111";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDocuments = async () => {
    const res = await fetch(
      `http://127.0.0.1:8000/documents/my-documents?employee_id=${EMPLOYEE_ID}`
    );
    const data = await res.json();
    setDocuments(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const uploadDocument = async (file: File, isMandatory: boolean) => {
    setLoading(true);

    const formData = new FormData();
    formData.append("employee_id", EMPLOYEE_ID);
    formData.append("document_type", isMandatory ? "Mandatory Document" : "Optional Document");
    formData.append("is_mandatory", String(isMandatory));
    formData.append("file", file);

    await fetch("http://127.0.0.1:8000/documents/upload", {
      method: "POST",
      body: formData,
    });

    await loadDocuments();
    setLoading(false);
  };

  const mandatoryDocs = documents.filter((d) => d.is_mandatory);
  const optionalDocs = documents.filter((d) => !d.is_mandatory);

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r p-6">
        <h2 className="text-xl font-bold mb-6">HRSM</h2>

        <nav className="space-y-4 text-sm">
          <p className="text-gray-500 font-semibold">MAIN MENU</p>
          <p className="text-gray-600">Dashboard</p>
          <p className="text-gray-600">Recruitment</p>
          <p className="text-orange-600 font-bold">Documents</p>
          <p className="text-gray-600">Leave</p>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-6">Document Management</h1>

        {/* Upload Section */}
        <div className="flex gap-4 mb-8">
          <label className="bg-orange-500 text-white px-4 py-2 rounded cursor-pointer font-semibold text-sm">
            Upload Mandatory Document
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.png"
              onChange={(e) =>
                e.target.files && uploadDocument(e.target.files[0], true)
              }
            />
          </label>

          <label className="bg-gray-700 text-white px-4 py-2 rounded cursor-pointer font-semibold text-sm">
            Upload Optional Document
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.png"
              onChange={(e) =>
                e.target.files && uploadDocument(e.target.files[0], false)
              }
            />
          </label>
        </div>

        {/* Mandatory Documents */}
        <section className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Mandatory Documents</h2>

          {mandatoryDocs.length === 0 && (
            <p className="text-gray-500 text-sm">
              No mandatory documents uploaded.
            </p>
          )}

          <ul className="space-y-3">
            {mandatoryDocs.map((doc) => (
              <li
                key={doc.id}
                className="flex justify-between items-center border rounded px-4 py-3"
              >
                <div>
                  <p className="font-bold">{doc.document_type}</p>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                    {doc.status}
                  </span>
                </div>

                <button
                  className="text-orange-600 font-semibold text-sm"
                  onClick={() =>
                    window.open(
                      `http://127.0.0.1:8000/documents/download/${doc.id}?employee_id=${EMPLOYEE_ID}`
                    )
                  }
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Optional Documents */}
        <section className="bg-white rounded shadow p-6">
          <h2 className="text-lg font-bold mb-4">Optional Documents</h2>

          {optionalDocs.length === 0 && (
            <p className="text-gray-500 text-sm">
              No optional documents uploaded.
            </p>
          )}

          <ul className="space-y-3">
            {optionalDocs.map((doc) => (
              <li
                key={doc.id}
                className="flex justify-between items-center border rounded px-4 py-3"
              >
                <div>
                  <p className="font-bold">{doc.document_type}</p>
                  <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                    {doc.status}
                  </span>
                </div>

                <button
                  className="text-orange-600 font-semibold text-sm"
                  onClick={() =>
                    window.open(
                      `http://127.0.0.1:8000/documents/download/${doc.id}?employee_id=${EMPLOYEE_ID}`
                    )
                  }
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        </section>

        {loading && (
          <p className="text-sm text-gray-500 mt-4">Uploading...</p>
        )}
      </main>
    </div>
  );
}
