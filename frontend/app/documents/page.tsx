"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DocumentItem from "../components/DocumentItem";

type UploadedDocument = {
  id: string;
  document_type: string;
  is_mandatory: boolean;
  status: string;
};

type MergedDocument = {
  id?: string;
  name: string;
  is_mandatory: boolean;
  status: "NOT_UPLOADED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
};

//  Predefined system-required documents
const REQUIRED_DOCUMENTS = [
  { name: "Birth Certificate", mandatory: true },
  { name: "NIC", mandatory: true },
  { name: "Passport", mandatory: true },
  { name: "letter", mandatory: true },
  { name: "educational certificate", mandatory: false },
  { name: "performance certificate", mandatory: false },
];

export default function DocumentsPage() {
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);

  const employeeId = "11111111-1111-1111-1111-111111111111";

  useEffect(() => {
    fetch(
      `http://localhost:8000/documents/my-documents?employee_id=${employeeId}`
    )
      .then((res) => res.json())
      .then((data) => setUploadedDocs(data))
      .catch((err) => console.error("Error fetching documents:", err));
  }, []);

  //  Merge template with uploaded data
  const mergedDocuments: MergedDocument[] = REQUIRED_DOCUMENTS.map(
    (template) => {
      const uploaded = uploadedDocs.find(
        (doc) => doc.document_type === template.name
      );

      if (!uploaded) {
        return {
          id: undefined,
          name: template.name,
          is_mandatory: template.mandatory,
          status: "NOT_UPLOADED",
        };
      }

      return {
        id: uploaded.id,
        name: uploaded.document_type,
        is_mandatory: template.mandatory,
        status:
          uploaded.status === "APPROVED"
            ? "APPROVED"
            : "PENDING_REVIEW",
      };
    }
  );

  const mandatoryDocs = mergedDocuments.filter(
    (doc) => doc.is_mandatory
  );

  const optionalDocs = mergedDocuments.filter(
    (doc) => !doc.is_mandatory
  );

  const completed = mandatoryDocs.filter(
    (doc) => doc.status === "APPROVED"
  ).length;

  const percentage =
    mandatoryDocs.length > 0
      ? (completed / mandatoryDocs.length) * 100
      : 0;

  return (
    <div className="space-y-6 w-full">

      {/* Tabs */}
      <div className="inline-flex bg-white p-1 rounded-full shadow-md border">
        <Link
          href="/documents"
          className="px-6 py-2 rounded-full bg-[#F2924E] text-white text-sm font-medium transition"
        >
          My documents
        </Link>

        <Link
          href="/documents/request"
          className="px-6 py-2 rounded-full text-gray-600 text-sm font-medium hover:text-gray-800 transition"
        >
          Request document
        </Link>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-semibold">My Documents</h1>
        <p className="text-sm text-gray-500">
          Upload required documents to complete your employee profile.
        </p>
      </div>

      {/* Progress */}
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <h3 className="font-semibold mb-2">Document Completion</h3>
        <p className="text-sm text-gray-500 mb-3">
          Mandatory Documents:{" "}
          <span className="font-medium">
            {completed} of {mandatoryDocs.length} completed
          </span>
        </p>

        <div className="w-full bg-gray-200 h-2 rounded-full">
          <div
            className="bg-[#F2924E] h-2 rounded-full"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>

        <p className="text-xs text-gray-400 mt-2">
          {mandatoryDocs.length - completed} documents remaining
        </p>
      </div>

      {/* Mandatory */}
      <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Mandatory Documents
        </h2>

        {mandatoryDocs.map((doc) => (
          <DocumentItem
            key={doc.name}
            id={doc.id}
            name={doc.name}
            description="Required document"
            status={doc.status}
            isMandatory={true}
          />
        ))}
      </div>

      {/* Optional */}
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
          />
        ))}
      </div>
    </div>
  );
}