"use client";

import { useEffect, useState } from "react";
import DocumentItem from "../../components/DocumentItem";
import DocumentTabs from "../../components/DocumentTabsEmployee";

type DocType = {
  id: string;
  name: string;
  description: string | null;
  is_mandatory: boolean;
  is_active: boolean;
};

type UploadedDoc = {
  id: string;
  document_type: string;
  is_mandatory: boolean;
  status: string;
  rejection_reason?: string;
};

type MergedDocument = {
  id?: string;
  name: string;
  description: string;
  is_mandatory: boolean;
  status: "NOT_UPLOADED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  rejection_reason?: string;
};

// TODO: replace with real authenticated employee ID
const employeeId = 2;

export default function DocumentsPage() {
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("http://localhost:8000/api/document-types/active/").then((r) => r.json()),
      fetch(`http://localhost:8000/documents/my-documents?employee_id=${employeeId}`).then((r) => r.json()),
    ])
      .then(([types, uploads]) => {
        setDocTypes(Array.isArray(types) ? types : []);
        setUploadedDocs(Array.isArray(uploads) ? uploads : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const mergedDocuments: MergedDocument[] = docTypes.map((type) => {
    const uploaded = uploadedDocs.find((u) => u.document_type === type.name);
    if (!uploaded) {
      return {
        id: undefined,
        name: type.name,
        description: type.description || "",
        is_mandatory: type.is_mandatory,
        status: "NOT_UPLOADED",
      };
    }
    return {
      id: uploaded.id,
      name: type.name,
      description: type.description || "",
      is_mandatory: type.is_mandatory,
      rejection_reason: uploaded.rejection_reason,
      status: (["APPROVED", "REJECTED", "PENDING_REVIEW"].includes(uploaded.status)
        ? uploaded.status
        : "PENDING_REVIEW") as MergedDocument["status"],
    };
  });

  const mandatoryDocs = mergedDocuments.filter((d) => d.is_mandatory);
  const optionalDocs = mergedDocuments.filter((d) => !d.is_mandatory);
  const completed = mandatoryDocs.filter((d) => d.status === "APPROVED").length;
  const percentage = mandatoryDocs.length > 0 ? (completed / mandatoryDocs.length) * 100 : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <DocumentTabs />
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading documents...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <DocumentTabs />

      <div>
        <h1 className="text-2xl font-semibold">My Documents</h1>
        <p className="text-sm text-gray-500">Upload required documents to complete your employee profile.</p>
      </div>

      {/* Progress */}
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <h3 className="font-semibold mb-2">Document Completion</h3>
        <p className="text-sm text-gray-500 mb-3">
          Mandatory Documents:{" "}
          <span className="font-medium">{completed} of {mandatoryDocs.length} completed</span>
        </p>
        <div className="w-full bg-gray-200 h-2 rounded-full">
          <div
            className="bg-[#F2924E] h-2 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">{mandatoryDocs.length - completed} documents remaining</p>
      </div>

      {/* Mandatory */}
      {mandatoryDocs.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Mandatory Documents</h2>
          {mandatoryDocs.map((doc) => (
            <DocumentItem
              key={doc.name}
              id={doc.id}
              name={doc.name}
              description={doc.description || "Required document"}
              status={doc.status}
              isMandatory={true}
              rejectionReason={doc.rejection_reason}
              employeeId={employeeId}
              uploadEndpoint="http://localhost:8000/documents/upload"
            />
          ))}
        </div>
      )}

      {/* Optional */}
      {optionalDocs.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
          <h2 className="font-semibold">Optional Documents</h2>
          {optionalDocs.map((doc) => (
            <DocumentItem
              key={doc.name}
              id={doc.id}
              name={doc.name}
              description={doc.description || "Optional document"}
              status={doc.status}
              isMandatory={false}
              rejectionReason={doc.rejection_reason}
              employeeId={employeeId}
              uploadEndpoint="http://localhost:8000/documents/upload"
            />
          ))}
        </div>
      )}

      {docTypes.length === 0 && (
        <div className="bg-white p-8 rounded-xl shadow-sm text-center text-gray-400 text-sm">
          No document types have been configured by HR yet.
        </div>
      )}
    </div>
  );
}