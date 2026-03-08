"use client";

import { useRef } from "react";

interface Props {
  id?: string;
  name: string;
  description: string;
  status: "APPROVED" | "PENDING_REVIEW" | "REJECTED" | "NOT_UPLOADED";
  isMandatory: boolean;
}

export default function DocumentItem({
  id,
  name,
  description,
  status,
  isMandatory,
}: Props) {

  const fileInputRef = useRef<HTMLInputElement>(null);

  const employeeId = "11111111-1111-1111-1111-111111111111";

  const badgeStyles = {
    APPROVED: "bg-green-100 text-green-600",
    PENDING_REVIEW: "bg-yellow-100 text-yellow-600",
    REJECTED: "bg-red-100 text-red-600",
    NOT_UPLOADED: "bg-gray-100 text-gray-500",
  };

  const badgeText = {
    APPROVED: "Approved",
    PENDING_REVIEW: "Pending Review",
    REJECTED: "Rejected",
    NOT_UPLOADED: "Not Uploaded",
  };

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {

    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];

    const formData = new FormData();
    formData.append("employee_id", employeeId);
    formData.append("document_type", name);
    formData.append("is_mandatory", String(isMandatory));
    formData.append("file", file);

    try {

      const response = await fetch(
        "http://localhost:8000/documents/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) throw new Error("Upload failed");

      alert("Document uploaded successfully");

      window.location.reload();

    } catch (error) {

      console.error(error);
      alert("Upload failed");

    }
  };

  return (
    <div className="flex items-center justify-between border rounded-lg p-4">

      {/* Document Info */}
      <div>
        <h4 className="font-medium">{name}</h4>
        <p className="text-xs text-gray-400">{description}</p>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-3">

        {/* Status Badge */}
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${badgeStyles[status]}`}
        >
          {badgeText[status]}
        </span>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Upload Button */}
        {status === "NOT_UPLOADED" && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#F2924E] text-white px-4 py-1 rounded-md text-sm"
          >
            Upload
          </button>
        )}

        {/* Replace Button */}
        {(status === "PENDING_REVIEW" || status === "REJECTED") && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-gray-200 px-4 py-1 rounded-md text-sm"
          >
            Replace
          </button>
        )}

      </div>

    </div>
  );
}