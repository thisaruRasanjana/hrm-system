"use client";

import Link from "next/link";
import { FileText, X } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import DocumentTabsEmployee from "@/app/components/DocumentTabsEmployee";

type Request = {
  id: string;
  document_type: string;
  purpose: string;
  status: string;
  created_at: string;
};

export default function RequestDocumentPage() {
  const [documentType, setDocumentType] = useState("");
  const [purpose, setPurpose] = useState("");
  const [requests, setRequests] = useState<Request[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const employeeId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

  const documentTypes = [
    "Service Letter",
    "Salary Confirmation",
    "Employment Confirmation",
    "Bank Letter",
  ];

  const fetchRequests = async () => {
    const res = await fetch(
      `http://localhost:8000/document-requests/${employeeId}`
    );

    const data = await res.json();
    setRequests(data);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleSubmit = async () => {
    setMessage("");
    setError("");
    
    if (!documentType || !purpose) {
      setError("Please fill all fields");
      return;
    }

    const res = await fetch("http://localhost:8000/document-requests/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        employee_id: employeeId,
        document_type: documentType,
        purpose: purpose,
      }),
    });

    if (res.ok) {
      setMessage("Request submitted successfully!");
      setDocumentType("");
      setPurpose("");
      fetchRequests();
      setTimeout(() => setMessage(""), 3000); // Clear success message after 3 seconds
    } else {
      setError("Error submitting request");
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const previousRequests = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-8 w-full">

      {/* Tabs */}
     <DocumentTabsEmployee />

      {/* Title */}
      <div>
        <h1 className="text-2xl font-semibold">Request Document</h1>
        <p className="text-sm text-gray-500">
          Request employment documents and track your requests.
        </p>
      </div>

      {/* New Request */}
      <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">

        <div className="flex items-center gap-3">
          <div className="bg-[#F2924E]/20 p-2 rounded-lg">
            <FileText size={18} className="text-[#F2924E]" />
          </div>
          <h3 className="font-semibold">New Request</h3>
        </div>

        {/* Document Type */}
        <div>
          <label className="text-sm text-gray-600 font-medium">
            Document Type
          </label>

          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            className="mt-2 w-full border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F2924E]"
          >
            <option value="">Select document type</option>

            {documentTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Purpose */}
        <div>
          <label className="text-sm text-gray-600 font-medium">
            Purpose of Request
          </label>

          <textarea
            rows={4}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="mt-2 w-full border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F2924E]"
          />
        </div>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}
        {message && (
          <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg">
            {message}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm rounded-md bg-[#F2924E] text-white hover:opacity-90 transition"
          >
            Submit Request
          </button>
        </div>

      </div>

      {/* Pending Requests */}
      <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">

        <h3 className="font-semibold">Pending Requests</h3>

        {pendingRequests.map((req) => (
          <div
            key={req.id}
            className="flex justify-between items-center border rounded-lg p-4 hover:bg-gray-50 transition"
          >
            <div>
              <p className="font-medium text-sm">{req.document_type}</p>

              <p className="text-xs text-gray-400">
                Requested on {new Date(req.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="flex items-center gap-3">

              <span className="bg-yellow-100 text-yellow-600 px-3 py-1 text-xs rounded-full font-medium">
                Pending
              </span>

              <button
                onClick={() => setSelectedRequest(req)}
                className="bg-gray-200 hover:bg-gray-300 text-xs px-3 py-1 rounded-md transition"
              >
                View
              </button>

            </div>
          </div>
        ))}

      </div>

      {/* Previous Requests */}
      <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">

        <h3 className="font-semibold">Previous Requests</h3>

        {previousRequests.map((req) => (
          <div
            key={req.id}
            className="flex justify-between items-center border rounded-lg p-4 hover:bg-gray-50 transition"
          >
            <div>
              <p className="font-medium text-sm">{req.document_type}</p>

              <p className="text-xs text-gray-400">
                Requested on {new Date(req.created_at).toLocaleDateString()}
              </p>
            </div>

            <span className="bg-green-100 text-green-600 px-3 py-1 text-xs rounded-full font-medium">
              {req.status}
            </span>
          </div>
        ))}

      </div>

      {/* Modal */}
      {selectedRequest &&
  typeof window !== "undefined" &&
  createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={() => setSelectedRequest(null)}
    >
      <div
        className="bg-white w-[420px] rounded-xl shadow-xl p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Icon */}
        <button
          onClick={() => setSelectedRequest(null)}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-[#F2924E]/20 p-2 rounded-lg">
            <FileText size={18} className="text-[#F2924E]" />
          </div>

          <h2 className="text-lg font-semibold text-gray-800">
            Request Details
          </h2>
        </div>

        {/* Details */}
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Document Type</span>
            <span className="font-medium">
              {selectedRequest.document_type}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>

            <span className="bg-yellow-100 text-yellow-600 px-2 py-1 rounded-full text-xs font-medium">
              {selectedRequest.status}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">Requested Date</span>
            <span className="font-medium">
              {new Date(selectedRequest.created_at).toLocaleDateString()}
            </span>
          </div>

          <div className="border-t pt-3">
            <p className="text-gray-500 mb-1">Purpose</p>

            <p className="text-gray-700 leading-relaxed">
              {selectedRequest.purpose}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end mt-6">
          <button
            onClick={() => setSelectedRequest(null)}
            className="px-4 py-2 text-sm rounded-md bg-[#F2924E] text-white hover:opacity-90 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )}

    </div>
  );
}
