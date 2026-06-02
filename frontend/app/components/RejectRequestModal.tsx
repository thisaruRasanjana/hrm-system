"use client";

import { useState } from "react";
import { X, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Props = {
  request: any;
  onClose: () => void;
  onSuccess: () => void;
};

export default function RejectRequestModal({ request, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReject = async () => {
    if (!reason.trim()) {
      setError("Rejection reason is required");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch(`/hr-document-requests/${request.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED", rejection_reason: reason }),
      });

      if (!res.ok) throw new Error("Failed to reject");

      onSuccess();
    } catch (err) {
      console.error(err);
      setError("Failed to reject request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-backdrop">
      <div className="bg-white w-[540px] rounded-3xl shadow-xl overflow-hidden animate-modal p-7">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-gray-200 pb-6 mb-6">
          <div>
            <h2 className="text-[20px] font-bold text-gray-900 mb-1.5">Reject Request</h2>
            <p className="text-[13px] text-gray-500 font-medium">Provide a reason for rejection</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition">
            <X size={20} />
          </button>
        </div>

        {/* Employee Info */}
        <div className="mb-6">
          <p className="text-[14px] font-bold text-gray-900 mb-0.5">{request.employee_name}</p>
          <p className="text-[13px] font-medium text-gray-500 tracking-tight">{request.document_type}</p>
        </div>

        {/* Reason Textarea */}
        <div className="mb-6">
          <label className="block text-[14px] font-bold text-gray-900 mb-3">
            Rejection Reason
          </label>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError("");
            }}
            placeholder="Explain why this request is being rejected. This message will be sent to the employee."
            rows={4}
            className={`w-full border rounded-xl p-4 text-[13px] font-medium text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 transition ${
              error ? "border-red-300 focus:ring-red-200" : "border-gray-200 focus:ring-gray-200 focus:border-gray-300"
            }`}
          />
          {error && <p className="text-xs text-red-500 mt-1.5 font-medium">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t-2 border-gray-200 pt-6">
          <button 
            onClick={onClose} 
            className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[14px] font-bold rounded-2xl transition"
          >
            Cancel
          </button>
          <button
            onClick={handleReject}
            disabled={loading || !reason.trim()}
            className={`flex-1 py-3.5 text-[14px] font-bold rounded-2xl transition flex items-center justify-center gap-2 border ${
              !reason.trim() || loading 
                ? "bg-white border-gray-200 text-gray-400 cursor-not-allowed" 
                : "bg-white border-gray-200 text-gray-800 hover:bg-gray-50 shadow-sm"
            }`}
          >
            <XCircle size={18} />
            {loading ? "Rejecting..." : "Reject Request"}
          </button>
        </div>

      </div>
    </div>
  );
}
