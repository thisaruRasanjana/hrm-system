"use client";

import { FileText, X, Download, Clock, CheckCircle, XCircle, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import DocumentTabsEmployee from "../../../components/DocumentTabsEmployee";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";

type Request = {
  id: string;
  document_type: string;
  reason: string;
  status: string;
  created_at: string;
  generated_document_path?: string;
  rejection_reason?: string;
};

export default function EmployeeRequestDocumentPage() {
  const { user } = useAuth();
  const [documentType, setDocumentType] = useState("");
  const [reason, setReason] = useState("");
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

  const handleSubmit = async () => {
    setMessage("");
    setError("");
    if (!documentType || !reason) { setError("Please fill all fields"); return; }
    try {
      const res = await apiFetch("/document-requests/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_type: documentType, reason }),
      });
      if (res.ok) {
        setMessage("Request submitted successfully!");
        setDocumentType("");
        setReason("");
        fetchRequests();
        setTimeout(() => setMessage(""), 3000);
      } else {
        const errorData = await res.json();
        setError(errorData.detail || "Error submitting request");
      }
    } catch (err) {
      setError("Failed to connect to server");
    }
  };

  const handleDownload = async (path: string) => {
    try {
      const response = await apiFetch(`/${path}`);
      if (!response.ok) throw new Error("File not found");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = path.split("/").pop() || "document.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed", err);
      alert("Failed to download document. Please try again later.");
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "PENDING" || r.status === "NEW" || r.status === "IN_PROGRESS");
  const previousRequests = requests.filter((r) => r.status === "COMPLETED" || r.status === "REJECTED");

  return (
    <div className="space-y-8 w-full animate-in fade-in duration-500">
      <DocumentTabsEmployee />

      {/* Title */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Request Document</h1>
        <p className="text-sm text-gray-500">
          Request employment documents and track your requests.
        </p>
      </div>

      {/* New Request */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-[#F2924E]/10 p-2 rounded-lg">
            <FileText size={18} className="text-[#F2924E]" />
          </div>
          <h3 className="font-semibold text-gray-800">New Request</h3>
        </div>

        {/* Document Type */}
        <div className="space-y-1.5">
          <label className="text-[12px] text-gray-500 font-bold uppercase tracking-wider">Document Type</label>
          <div className="relative">
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="appearance-none w-full border border-gray-200 shadow-sm rounded-xl px-4 py-2.5 pr-9 text-sm outline-none focus:ring-2 focus:ring-[#F2924E]/20 focus:border-[#F2924E] transition-all bg-white"
            >
              <option value="">Select document type</option>
              {documentTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>

        {/* Reason */}
        <div className="space-y-1.5">
          <label className="text-[12px] text-gray-500 font-bold uppercase tracking-wider">Reason for Request</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border border-gray-200 shadow-sm rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F2924E]/20 focus:border-[#F2924E] transition-all bg-white placeholder-gray-400"
            placeholder="Please specify why you need this document..."
          />
        </div>

        {error && (
          <div className="p-3 text-sm font-bold text-gray-600 bg-gray-50 border border-gray-100 rounded-xl">{error}</div>
        )}
        {message && (
          <div className="p-3 text-sm font-bold text-[#F2924E] bg-orange-50 border border-orange-100 rounded-xl">{message}</div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 text-sm font-bold rounded-xl bg-[#F2924E] text-white hover:bg-[#e07d3a] transition-all shadow-sm active:scale-95"
          >
            Submit Request
          </button>
        </div>
      </div>

      {/* Pending Requests */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-[15px]">
          <Clock size={16} className="text-[#F2924E]" /> Pending Requests
        </h3>
        {pendingRequests.length === 0 && <p className="text-sm text-gray-400 italic bg-gray-50 rounded-lg p-6 text-center">No pending requests</p>}
        <div className="space-y-3">
          {pendingRequests.map((req) => (
            <div key={req.id} className="flex justify-between items-center border border-gray-100 rounded-xl p-4 hover:bg-gray-50/50 transition-all">
              <div>
                <p className="font-bold text-gray-900 text-sm">{req.document_type}</p>
                <p className="text-[11px] text-gray-400 font-medium">Requested on {new Date(req.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${req.status === 'IN_PROGRESS'
                  ? 'bg-orange-50 text-[#F2924E] border-orange-100'
                  : 'bg-gray-50 text-gray-500 border-gray-100'
                  }`}>
                  {req.status}
                </span>
                <button
                  onClick={() => setSelectedRequest(req)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold px-4 py-1.5 rounded-lg transition-all"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Previous Requests */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-[15px]">
          <CheckCircle size={16} className="text-[#F2924E]" /> Previous Requests
        </h3>
        {previousRequests.length === 0 && <p className="text-sm text-gray-400 italic bg-gray-50 rounded-lg p-6 text-center">No previous requests</p>}
        <div className="space-y-3">
          {previousRequests.map((req) => (
            <div key={req.id} className="flex justify-between items-center border border-gray-100 rounded-xl p-4 hover:bg-gray-50/50 transition-all">
              <div>
                <p className="font-bold text-gray-900 text-sm">{req.document_type}</p>
                <p className="text-[11px] text-gray-400 font-medium">Requested on {new Date(req.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${req.status === 'COMPLETED'
                  ? 'bg-orange-50 text-[#F2924E] border-orange-100'
                  : 'bg-gray-50 text-gray-400 border-gray-100'
                  }`}>
                  {req.status}
                </span>
                <button
                  onClick={() => setSelectedRequest(req)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                >
                  <Eye size={14} /> View
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {selectedRequest && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={() => setSelectedRequest(null)}>
          <div className="bg-white w-[420px] rounded-3xl shadow-xl border border-gray-200 p-6 relative animate-modal overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedRequest(null)} className="absolute right-4 top-4 text-gray-300 hover:text-gray-900 transition-colors p-2"><X size={20} /></button>

            <div className="flex items-center gap-3 mb-6">
              <div className="bg-[#F2924E]/10 p-2.5 rounded-xl"><FileText size={20} className="text-[#F2924E]" /></div>
              <h2 className="text-[18px] font-bold text-gray-900 tracking-tight">Request Details</h2>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Document</span>
                <span className="font-bold text-gray-900 text-sm">{selectedRequest.document_type}</span>
              </div>

              <div className="flex justify-between items-center px-2">
                <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Status</span>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${selectedRequest.status === 'COMPLETED' ? 'bg-orange-50 text-[#F2924E] border-orange-100' :
                  selectedRequest.status === 'REJECTED' ? 'bg-gray-50 text-gray-400 border-gray-100' :
                    selectedRequest.status === 'IN_PROGRESS' ? 'bg-orange-50 text-[#F2924E] border-orange-100' :
                      'bg-gray-50 text-gray-500 border-gray-100'
                  }`}>
                  {selectedRequest.status}
                </span>
              </div>

              <div className="flex justify-between items-center px-2">
                <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Requested Date</span>
                <span className="font-bold text-gray-900 text-sm">{new Date(selectedRequest.created_at).toLocaleDateString()}</span>
              </div>

              <div className="bg-gray-50/50 p-4 rounded-xl space-y-1.5 border border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Your Reason</p>
                <p className="text-[13px] text-gray-700 font-medium leading-relaxed italic">"{selectedRequest.reason}"</p>
              </div>

              {selectedRequest.status === 'REJECTED' && selectedRequest.rejection_reason && (
                <div className="bg-gray-50 p-4 rounded-xl space-y-1.5 border border-gray-100">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5"><XCircle size={12} /> HR Feedback</p>
                  <p className="text-[13px] text-gray-700 font-bold leading-relaxed">{selectedRequest.rejection_reason}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 mt-8">
              {selectedRequest.status === 'COMPLETED' && selectedRequest.generated_document_path && (
                <button
                  onClick={() => handleDownload(selectedRequest.generated_document_path!)}
                  className="w-full py-3.5 bg-[#F2924E] hover:bg-[#e07d3a] text-white font-bold rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Download size={18} /> Download Document
                </button>
              )}
              <button
                onClick={() => setSelectedRequest(null)}
                className="w-full py-3 text-[13px] font-bold rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all border border-gray-100 shadow-sm"
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
