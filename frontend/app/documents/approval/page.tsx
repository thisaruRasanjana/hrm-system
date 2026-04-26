"use client";

import { useEffect, useState } from "react";
import DocumentReviewModal from "../../components/DocumentReviewModal";
import StatusBadge from "../../components/statusBadge";
import DocumentTabs from "../../components/DocumentTabsHR";
import { Clock } from "lucide-react";

type Document = {
  id: string;
  employee_id: string;
  employee_name: string;
  document_type: string;
  file_path: string;
  status: "NOT_UPLOADED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  uploaded_at: string;
};

export default function ApprovalPage() {

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    const employeeDbId =
      typeof window !== "undefined"
        ? (localStorage.getItem("employeeDbId") ?? "8")
        : "8";
    const res = await fetch("http://localhost:8000/documents/review/pending", {
      headers: { "X-Employee-ID": employeeDbId },
    });
    const data = await res.json();
    setDocuments(Array.isArray(data) ? data : []);
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <DocumentTabs  />
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Document Review & Approval</h1>
        <p className="text-gray-500 text-sm">
          Review and approve employee submitted documents
        </p>
      </div>

      {/* Pending Card */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-6 flex justify-between items-center">

        <div>
          <p className="text-xs text-gray-400">PENDING REVIEW</p>
          <h2 className="text-3xl font-semibold">{documents.length}</h2>
          <p className="text-xs text-gray-400">
            documents require your attention
          </p>
        </div>

        <div className="flex items-center justify-center text-[#F2924E]">
          <Clock size={32} strokeWidth={2.5} />
        </div>

      </div>

      {/* Search */}
      <input
        placeholder="Search employee name..."
        className="w-full border border-gray-100 shadow-sm rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition"
      />

      {/* Document List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">

        {documents.map((doc) => (

          <div
            key={doc.id}
            className="flex items-center justify-between px-6 py-4"
          >

            {/* Left */}
            <div className="flex items-center gap-4">

              {/* Avatar */}
              <div className="w-10 h-10 bg-orange-400 text-white rounded-full flex items-center justify-center text-sm font-medium">
                {doc.employee_name.slice(0, 2)}
              </div>

              {/* Info */}
              <div>
                <p className="font-medium">{doc.employee_name}</p>
                <p className="text-xs text-gray-500">{doc.document_type}</p>
                <p className="text-xs text-gray-400">
                  {new Date(doc.uploaded_at).toLocaleDateString()}
                </p>
              </div>

            </div>

            {/* Right */}
            <div className="flex items-center gap-4">

              <StatusBadge status={doc.status} />

              <button
                onClick={() => setSelectedDoc(doc)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md text-sm"
              >
                View
              </button>

            </div>

          </div>

        ))}

      </div>

      {/* Modal */}
      {selectedDoc && (
        <DocumentReviewModal
          document={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          refresh={fetchDocuments}
        />
      )}

    </div>
  );
}