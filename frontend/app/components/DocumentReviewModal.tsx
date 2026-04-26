"use client";

import { useState } from "react";
import { X, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";

type Props = {
  document: any;
  onClose: () => void;
  refresh: () => void;
};

export default function DocumentReviewModal({
  document,
  onClose,
  refresh,
}: Props) {

  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const approveDocument = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `http://localhost:8000/documents/review/${document.id}/approve`,
        { method: "PATCH" }
      );
      if (!res.ok) throw new Error("Approval failed");
      
      refresh();
      onClose();
    } catch (err) {
      setError("Failed to approve document. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const rejectDocument = async () => {
    if (!reason.trim()) {
      setError("Please enter a rejection reason");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `http://localhost:8000/documents/review/${document.id}/reject`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );
      if (!res.ok) throw new Error("Rejection failed");

      refresh();
      onClose();
    } catch (err) {
      setError("Failed to reject document. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-backdrop p-4">
      <div className="bg-white w-[1100px] max-h-[95vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-modal">
        
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#F2924E] text-white rounded-2xl flex items-center justify-center text-lg font-bold shadow-sm">
              {document.employee_name?.slice(0, 2).toUpperCase() || "EP"}
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-gray-900 leading-none mb-1.5">
                {document.employee_name || "Employee " + document.employee_id}
              </h2>
              <p className="text-[13px] text-gray-500 font-medium tracking-tight">
                {document.document_type} • Submitted {new Date(document.uploaded_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-gray-400 hover:text-gray-900 transition-all border border-transparent hover:border-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-white">
          <div className="flex flex-col gap-6">
            
            {/* Main Preview Container */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-gray-200 to-gray-100 rounded-[2rem] blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative bg-white border border-gray-200 rounded-[1.8rem] overflow-hidden shadow-sm h-[600px]">
                <iframe
                  src={`http://localhost:8000/${document.file_path}`}
                  className="w-full h-full border-none"
                  title="Document Preview"
                />
              </div>
            </div>

            {/* Info and Action Box */}
            <div className="flex flex-col gap-4">
              {!rejectMode ? (
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#F2924E] rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-gray-900 mb-1">Pending Review</h3>
                    <p className="text-[13px] text-gray-600 font-medium leading-relaxed">
                      Please carefully review the document above. Verify that all information is correct and the document is legible before proceeding with approval.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
                      <XCircle size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-[14px] font-bold text-gray-900 mb-1">Rejecting Document</h3>
                      <p className="text-[13px] text-gray-600 font-medium mb-4">
                        Please provide a clear reason for rejection. This feedback will be shared with the employee to help them provide a corrected version.
                      </p>
                      <textarea
                        placeholder="e.g., The document is blurred, or the name does not match our records."
                        value={reason}
                        onChange={(e) => {
                          setReason(e.target.value);
                          setError("");
                        }}
                        className="w-full border border-gray-200 rounded-xl p-4 text-[13px] font-medium text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-gray-100 focus:border-gray-300 bg-white transition-all h-32 shadow-inner"
                      />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl p-4 text-[13px] font-bold animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-gray-100 bg-gray-50/50 flex gap-4">
          {!rejectMode ? (
            <>
              <button
                disabled={loading}
                onClick={approveDocument}
                className="flex-1 bg-[#F2924E] hover:bg-[#e07d3a] text-white py-4 rounded-2xl font-bold text-[14px] transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Approving..." : <><CheckCircle size={18} /> Approve Document</>}
              </button>
              <button
                disabled={loading}
                onClick={() => setRejectMode(true)}
                className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-4 rounded-2xl font-bold text-[14px] transition-all flex items-center justify-center gap-2"
              >
                <XCircle size={18} /> Reject Document
              </button>
            </>
          ) : (
            <>
              <button
                disabled={loading || !reason.trim()}
                onClick={rejectDocument}
                className="flex-1 bg-gray-800 hover:bg-gray-900 text-white py-4 rounded-2xl font-bold text-[14px] transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Submitting..." : "Submit Rejection"}
              </button>
              <button
                disabled={loading}
                onClick={() => {
                  setRejectMode(false);
                  setError("");
                }}
                className="flex-1 bg-white border border-gray-100 hover:bg-gray-50 text-gray-600 py-4 rounded-2xl font-bold text-[14px] transition-all duration-300 shadow-sm"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}