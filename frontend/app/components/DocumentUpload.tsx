"use client";

import { useState } from "react";
import { uploadDocument } from "../api/documentApi";

const EMPLOYEE_ID = "PASTE_EMPLOYEE_UUID_HERE";

export default function DocumentUpload({
  onUploadSuccess,
}: {
  onUploadSuccess: () => void;
}) {
  const [documentType, setDocumentType] = useState("");
  const [isMandatory, setIsMandatory] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("employee_id", EMPLOYEE_ID);
    formData.append("document_type", documentType);
    formData.append("is_mandatory", String(isMandatory));
    formData.append("file", file);

    await uploadDocument(formData);
    alert("Document uploaded successfully");
    onUploadSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h2 className="text-xl font-bold">Upload Document</h2>

      <input
        className="border p-2 w-full"
        placeholder="Document Type (NIC, Passport)"
        value={documentType}
        onChange={(e) => setDocumentType(e.target.value)}
        required
      />

      <label className="flex gap-2 items-center">
        <input
          type="checkbox"
          checked={isMandatory}
          onChange={(e) => setIsMandatory(e.target.checked)}
        />
        Mandatory
      </label>

      <input
        type="file"
        accept=".pdf,.jpg,.png"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        required
      />

      <button className="bg-blue-600 text-white px-4 py-2 rounded">
        Upload
      </button>
    </form>
  );
}
