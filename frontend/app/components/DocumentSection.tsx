"use client";

import { useEffect, useState } from "react";
import DocumentItem from "./DocumentItem";

interface Props {
  title: string;
  required?: boolean;
}

type DocumentStatus =
  | "NOT_UPLOADED"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED";

interface Document {
  id: string;
  document_type: string;
  status: DocumentStatus;
  file_path: string;
}

export default function DocumentSection({ title, required }: Props) {
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    try {
      const res = await fetch("http://127.0.0.1:8000/documents");
      const data = await res.json();
      setDocuments(data);
    } catch (error) {
      console.error("Failed to load documents", error);
    }
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h2 className="font-semibold mb-4">
        {title} {required && <span className="text-red-500">*</span>}
      </h2>

      <div className="space-y-3">
        {documents.map((doc) => (
          <DocumentItem
  key={doc.id}
  name={doc.document_type}
  description={doc.document_type}
  status={
    doc.status === "APPROVED"
      ? "APPROVED"
      : doc.status === "REJECTED"
      ? "REJECTED"
      : doc.status === "PENDING_REVIEW"
      ? "PENDING_REVIEW"
      : "NOT_UPLOADED"
  }
  isMandatory={true}
/>
        ))}
      </div>
    </div>
  );
}