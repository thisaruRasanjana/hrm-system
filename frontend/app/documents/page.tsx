"use client";

import { useEffect, useState } from "react";
import DocumentItem from "../components/DocumentItem";
import DocumentTabsHR from "../components/DocumentTabsHR";
import { hasPermission } from "../components/AuthGuard";

type UploadedDocument = {
  id: string;
  document_type: string;
  is_mandatory: boolean;
  status: string;
  rejection_reason?: string;
};

type MergedDocument = {
  id?: string;
  name: string;
  is_mandatory: boolean;
  status: "NOT_UPLOADED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  rejection_reason?: string;
};

const REQUIRED_DOCUMENTS = [
  { name: "Birth Certificate", mandatory: true },
  { name: "NIC", mandatory: true },
  { name: "Passport", mandatory: true },
  { name: "letter", mandatory: true },
  { name: "educational certificate", mandatory: false },
  { name: "performance certificate", mandatory: false },
];

export default function HRDocumentsPage() {
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [canUpload, setCanUpload] = useState(true);

  // Integer DB id written by AuthGuard on login; fall back to seeded test employee
  const employeeDbId =
    typeof window !== "undefined"
      ? (localStorage.getItem("employeeDbId") ?? "6")
      : "6";

  useEffect(() => {
    setCanUpload(hasPermission("document:upload"));
    fetch(`http://localhost:8000/documents/my-documents?employee_id=${employeeDbId}`, {
      headers: { "X-Employee-ID": employeeDbId },
    })
      .then((res) => res.json())
      .then((data) => {
        // Guard: backend may return a 401/403 object instead of an array
        setUploadedDocs(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error("Error fetching documents:", err));
  }, [employeeDbId]);

  const mergedDocuments: MergedDocument[] = REQUIRED_DOCUMENTS.map((template) => {
    const uploaded = uploadedDocs.find((doc) => doc.document_type === template.name);
    if (!uploaded) {
      return { id: undefined, name: template.name, is_mandatory: template.mandatory, status: "NOT_UPLOADED" as const };
    }
    return {
      id: uploaded.id,
      name: uploaded.document_type,
      is_mandatory: template.mandatory,
      rejection_reason: uploaded.rejection_reason,
      status: (uploaded.status === "APPROVED" ? "APPROVED" : uploaded.status === "REJECTED" ? "REJECTED" : "PENDING_REVIEW") as MergedDocument["status"],
    };
  });

  const mandatoryDocs = mergedDocuments.filter((doc) => doc.is_mandatory);
  const optionalDocs = mergedDocuments.filter((doc) => !doc.is_mandatory);
  const completed = mandatoryDocs.filter((doc) => doc.status === "APPROVED").length;
  const percentage = mandatoryDocs.length > 0 ? (completed / mandatoryDocs.length) * 100 : 0;

  return (
    <div className="space-y-6 w-full">
      <DocumentTabsHR />

      <div>
        <h1 className="text-2xl font-semibold">My Documents</h1>
        <p className="text-sm text-gray-500">Upload required documents to complete your employee profile.</p>
      </div>

      {!canUpload && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
          You have read-only access to documents.
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm">
        <h3 className="font-semibold mb-2">Document Completion</h3>
        <p className="text-sm text-gray-500 mb-3">
          Mandatory Documents: <span className="font-medium">{completed} of {mandatoryDocs.length} completed</span>
        </p>
        <div className="w-full bg-gray-200 h-2 rounded-full">
          <div className="bg-[#F2924E] h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
        </div>
        <p className="text-xs text-gray-400 mt-2">{mandatoryDocs.length - completed} documents remaining</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Mandatory Documents</h2>
        {mandatoryDocs.map((doc) => (
          <DocumentItem
            key={doc.name}
            id={doc.id}
            name={doc.name}
            description="Required document"
            status={doc.status}
            isMandatory={true}
            rejectionReason={doc.rejection_reason}
            employeeId={employeeDbId}
            uploadEndpoint="http://localhost:8000/documents/upload"
          />
        ))}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
        <h2 className="font-semibold">Optional Documents</h2>
        {optionalDocs.map((doc) => (
          <DocumentItem
            key={doc.name}
            id={doc.id}
            name={doc.name}
            description="Optional document"
            status={doc.status}
            isMandatory={false}
            employeeId={employeeDbId}
            uploadEndpoint="http://localhost:8000/documents/upload"
          />
        ))}
      </div>
    </div>
  );
}