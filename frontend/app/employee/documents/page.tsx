"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import DocumentItem from "../../components/DocumentItem";
import DocumentTabsEmployee from "../../components/DocumentTabsEmployee";

type UploadedDocument = {
  id: string;
  document_type: string;
  is_mandatory: boolean;
  status: string;
  rejection_reason?: string;
};

type MergedDocument = {
  id?: string;
  document_type_id: number;
  name: string;
  is_mandatory: boolean;
  status: "NOT_UPLOADED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  rejection_reason?: string;
};

export default function EmployeeDocumentsPage() {
  const { user } = useAuth();
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    Promise.all([
      apiFetch("/api/document-types/active/").then(r => r.json()),
      apiFetch("/documents/my-documents").then(r => r.json()),
    ])
    .then(([types, uploads]) => {
      setDocTypes(Array.isArray(types) ? types : []);
      setUploadedDocs(Array.isArray(uploads) ? uploads : []);
    })
    .catch((err) => console.error("Error fetching documents:", err))
    .finally(() => setIsLoading(false));
  }, [user]);

  const mergedDocuments: MergedDocument[] = docTypes.map((type) => {
    const uploaded = uploadedDocs.find((doc) => doc.document_type === type.name);
    if (!uploaded) {
      return { 
        id: undefined, 
        document_type_id: type.id,
        name: type.name, 
        is_mandatory: type.is_mandatory, 
        status: "NOT_UPLOADED" as const 
      };
    }
    return {
      id: uploaded.id,
      document_type_id: type.id,
      name: uploaded.document_type,
      is_mandatory: type.is_mandatory,
      rejection_reason: uploaded.rejection_reason,
      status: (uploaded.status === "APPROVED" ? "APPROVED" : uploaded.status === "REJECTED" ? "REJECTED" : "PENDING_REVIEW") as MergedDocument["status"],
    };
  });

  const mandatoryDocs = mergedDocuments.filter((doc) => doc.is_mandatory);
  const optionalDocs = mergedDocuments.filter((doc) => !doc.is_mandatory);
  const completed = mandatoryDocs.filter((doc) => doc.status === "APPROVED").length;
  const percentage = mandatoryDocs.length > 0 ? (completed / mandatoryDocs.length) * 100 : 0;

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading documents...</div>;
  }

  return (
    <div className="space-y-6 w-full">
      <DocumentTabsEmployee />

      <div>
        <h1 className="text-2xl font-semibold">My Documents</h1>
        <p className="text-sm text-gray-500">Upload required documents to complete your employee profile.</p>
      </div>

      {docTypes.length === 0 ? (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-gray-500 text-lg">No document types configured by HR yet</p>
        </div>
      ) : (
        <>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-semibold mb-2">Document Completion</h3>
            <p className="text-sm text-gray-500 mb-3">
              Mandatory Documents: <span className="font-medium text-[#F2924E]">{completed} of {mandatoryDocs.length} completed</span>
            </p>
            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div className="bg-[#F2924E] h-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
            </div>
            <p className="text-xs text-gray-400 mt-2">{mandatoryDocs.length - completed} documents remaining</p>
          </div>

          {mandatoryDocs.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">Mandatory Documents</h2>
              {mandatoryDocs.map((doc) => (
                <DocumentItem
                  key={doc.name}
                  id={doc.id}
                  documentTypeId={doc.document_type_id}
                  name={doc.name}
                  description="Required document"
                  status={doc.status}
                  isMandatory={true}
                  rejectionReason={doc.rejection_reason}
                />
              ))}
            </div>
          )}

          {optionalDocs.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
              <h2 className="font-semibold">Optional Documents</h2>
              {optionalDocs.map((doc) => (
                <DocumentItem
                  key={doc.name}
                  id={doc.id}
                  documentTypeId={doc.document_type_id}
                  name={doc.name}
                  description="Optional document"
                  status={doc.status}
                  isMandatory={false}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
