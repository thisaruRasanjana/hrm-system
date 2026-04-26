"use client";

import { useRef, useState } from "react";

interface Props {
  id?: string;
  documentTypeId?: number;
  name: string;
  description: string;
  status: "APPROVED" | "PENDING_REVIEW" | "REJECTED" | "NOT_UPLOADED";
  isMandatory: boolean;
  rejectionReason?: string;
  employeeId?: string;
  uploadEndpoint?: string;
}

export default function DocumentItem({
  id,
  documentTypeId,
  name,
  description,
  status,
  isMandatory,
  rejectionReason,
  employeeId,
  uploadEndpoint,
}: Props) {

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
    if (!uploadEndpoint || !documentTypeId) {
      setError("Upload configuration missing");
      return;
    }

    const file = e.target.files[0];

    const formData = new FormData();
    formData.append("employee_id", "6"); // Hardcoded as requested
    formData.append("document_type_id", String(documentTypeId));
    formData.append("is_mandatory", String(isMandatory));
    formData.append("file", file);

    try {

      const response = await fetch(
        uploadEndpoint,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) throw new Error("Upload failed");

      setMessage("✔ Document uploaded successfully");
      setError("");

      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {

      console.error(error);
      setError("Upload failed. Please try again.");
      setMessage("");

    }
  };

  return (
    <div className="flex items-center justify-between border border-gray-200 shadow-sm rounded-xl p-5 bg-white transition-all hover:shadow-md">

      {/* Document Info */}
      <div>
        <h4 className="font-medium">{name}</h4>
        <p className="text-xs text-gray-400">{description}</p>

        {/* Reject reason */}
        {status === "REJECTED" && rejectionReason && (
          <p className="text-xs text-red-500 mt-1">
            Rejection reason: {rejectionReason}
          </p>
        )}

        {/* Success message */}
        {message && (
          <p className="text-xs text-green-600 mt-1">
            {message}
          </p>
        )}

        {/* Error message */}
        {error && (
          <p className="text-xs text-red-600 mt-1">
            {error}
          </p>
        )}
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