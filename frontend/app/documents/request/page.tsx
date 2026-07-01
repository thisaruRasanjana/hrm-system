"use client";

import { FileText, X, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import DocumentTabsHR from "@/app/components/DocumentTabsHR";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";

type Request = {
  id: string;
  document_type: string;
  reason: string;
  status: string;
  rejection_reason?: string;
  generated_document_path?: string;
  created_at: string;
};

export default function HRRequestDocumentPage() {
  const { user } = useAuth();
  const [documentType, setDocumentType] = useState("");
  const [purpose, setPurpose] = useState("");
  const [requests, setRequests] = useState<Request[]>([]);
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchRequests = async () => {
    try {
      const res = await apiFetch("/document-requests/my");
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch requests", err);
    }
  };

  // Request document types are managed by admins in the Document Types tab
  // (REQUEST catalogue); only active ones are offered here.
  const fetchDocumentTypes = async () => {
    try {
      const res = await apiFetch("/api/document-types/active/?category=REQUEST");
      const data = await res.json();
      setDocumentTypes(Array.isArray(data) ? data.map((t: { name: string }) => t.name) : []);
    } catch (err) {
      console.error("Failed to fetch document types", err);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchRequests();
    fetchDocumentTypes();
  }, [user]);

  const handleDownload = async (path: string) => {
    try {
      const res = await apiFetch(`/${path}`);
      if (!res.ok) throw new Error("File not found");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = path.split("/").pop() || "document.pdf";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed", err);
      alert("Failed to download the document. The file may no longer be available — please contact HR.");
    }
  };

  const handleSubmit = async () => {
    setMessage("");
    setError("");
    if (!documentType || !purpose) { setError("Please fill all fields"); return; }
    if (purpose.trim().length < 5) { setError("Purpose must be at least 5 characters."); return; }

    try {
      const res = await apiFetch("/document-requests/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_type: documentType, reason: purpose }),
      });
      if (res.ok) {
        setMessage("Request submitted successfully!");
        setDocumentType("");
        setPurpose("");
        fetchRequests();
        setTimeout(() => setMessage(""), 3000);
      } else {
        const err = await res.json();
        const detail = err.detail;
        if (Array.isArray(detail)) {
          setError(detail.map((e: any) => e.msg ?? JSON.stringify(e)).join(", "));
        } else if (typeof detail === "string") {
          setError(detail);
        } else {
          setError("Error submitting request");
        }
      }
    } catch {
      setError("Failed to connect to server");
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const previousRequests = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-8 w-full">

      {/* Tabs */}
     <DocumentTabsHR />

      {/* Title */}
      <div>
        <h1 className="text-2xl font-semibold">Request Document</h1>
        <p className="text-sm text-gray-500">
          Request employment documents and track your requests.
        </p>
      </div>

      {/* New Request */}
      <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-200 space-y-6">

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
            className="mt-2 w-full border-0 bg-gray-50/80 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#F2924E]/30 transition shadow-sm"
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
            className="mt-2 w-full border-0 bg-gray-50/80 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#F2924E]/30 transition shadow-sm"
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
            className="px-6 py-2.5 text-sm font-bold rounded-xl bg-[#F2924E] text-white hover:opacity-90 transition shadow-md hover:shadow-lg"
          >
            Submit Request
          </button>
        </div>

      </div>

      {/* Pending Requests */}
      <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-200 space-y-6">

        <h3 className="font-semibold">Pending Requests</h3>

        {pendingRequests.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No pending requests.</p>
        ) : (
          pendingRequests.map((req) => (
            <div
              key={req.id}
              className="flex justify-between items-center bg-gray-50/50 rounded-xl p-5 hover:bg-gray-50 transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <div>
                <p className="font-bold text-sm text-gray-800">{req.document_type}</p>

                <p className="text-xs text-gray-500 mt-1">
                  Requested on {new Date(req.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-3">

                <span className="bg-orange-50 text-[#F2924E] px-3 py-1 text-[10px] uppercase tracking-wider rounded-full font-bold border border-orange-100">
                  Pending
                </span>

                <button
                  onClick={() => setSelectedRequest(req)}
                  className="bg-white border border-gray-100 hover:bg-gray-50 text-gray-600 text-xs px-4 py-1.5 rounded-lg transition shadow-sm"
                >
                  View
                </button>

              </div>
            </div>
          ))
        )}

      </div>

      {/* Previous Requests */}
      <div className="bg-white p-8 rounded-2xl shadow-md space-y-6">

        <h3 className="font-semibold">Previous Requests</h3>

        {previousRequests.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No previous requests.</p>
        ) : (
          previousRequests.map((req) => (
            <div
              key={req.id}
              className="flex justify-between items-center bg-gray-50/50 rounded-xl p-5 hover:bg-gray-50 transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <div>
                <p className="font-bold text-sm text-gray-800">{req.document_type}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Requested on {new Date(req.created_at).toLocaleDateString()}
                </p>
                {req.status === 'REJECTED' && req.rejection_reason && (
                  <p className="text-xs text-red-500 mt-1">Rejected: {req.rejection_reason}</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 text-[10px] uppercase tracking-wider rounded-full font-bold border ${
                  req.status === 'COMPLETED' ? 'bg-orange-50 text-[#F2924E] border-orange-100' : 'bg-gray-50 text-gray-500 border-gray-100'
                }`}>
                  {req.status}
                </span>
                {req.status === 'COMPLETED' && req.generated_document_path && (
                  <button
                    onClick={() => handleDownload(req.generated_document_path!)}
                    className="flex items-center gap-1.5 bg-[#F2924E] hover:bg-orange-500 text-white text-xs px-4 py-1.5 rounded-lg transition shadow-sm"
                  >
                    <Download size={13} /> Download
                  </button>
                )}
                <button
                  onClick={() => setSelectedRequest(req)}
                  className="bg-white border border-gray-100 hover:bg-gray-50 text-gray-600 text-xs px-4 py-1.5 rounded-lg transition shadow-sm"
                >
                  View
                </button>
              </div>
            </div>
          ))
        )}

      </div>

      {/* Modal */}
      {selectedRequest &&
  typeof window !== "undefined" &&
  createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-backdrop"
      onClick={() => setSelectedRequest(null)}
    >
        <div
          className="bg-white w-[420px] rounded-2xl shadow-2xl p-8 relative animate-modal"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Close Icon */}
        <button
          onClick={() => setSelectedRequest(null)}
          className="absolute right-6 top-6 text-gray-400 hover:text-gray-600 transition"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-[#F2924E]/10 p-2.5 rounded-xl">
            <FileText size={20} className="text-[#F2924E]" />
          </div>

          <h2 className="text-lg font-bold text-gray-900">
            Request Details
          </h2>
        </div>

        {/* Details */}
        <div className="space-y-4 text-sm">
          <div className="flex justify-between items-center py-2 border-b border-gray-50">
            <span className="text-gray-500 font-medium">Document Type</span>
            <span className="font-bold text-gray-900">
              {selectedRequest.document_type}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-gray-50">
            <span className="text-gray-500 font-medium">Status</span>

            <span className="bg-yellow-100 text-yellow-600 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold">
              {selectedRequest.status}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-gray-50">
            <span className="text-gray-500 font-medium">Requested Date</span>
            <span className="font-bold text-gray-900">
              {new Date(selectedRequest.created_at).toLocaleDateString()}
            </span>
          </div>

          <div className="pt-2">
            <p className="text-gray-500 font-medium mb-2">Purpose / Reason</p>

            <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-xl font-medium">
              {selectedRequest.reason}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 mt-8">
          {selectedRequest.status === 'COMPLETED' && selectedRequest.generated_document_path && (
            <button
              onClick={() => handleDownload(selectedRequest.generated_document_path!)}
              className="w-full py-3 text-sm font-bold rounded-xl bg-[#F2924E] text-white hover:opacity-90 transition shadow-md flex items-center justify-center gap-2"
            >
              <Download size={16} /> Download Document
            </button>
          )}
          <button
            onClick={() => setSelectedRequest(null)}
            className={`w-full py-3 text-sm font-bold rounded-xl transition ${
              selectedRequest.status === 'COMPLETED' && selectedRequest.generated_document_path
                ? 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm'
                : 'bg-[#F2924E] text-white hover:opacity-90 shadow-md'
            }`}
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