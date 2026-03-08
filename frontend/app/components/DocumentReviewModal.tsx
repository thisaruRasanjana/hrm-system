"use client";

import { useState } from "react";

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

  const approveDocument = async () => {

    setLoading(true);

    await fetch(
      `http://127.0.0.1:8000/documents/review/${document.id}/approve`,
      { method: "PUT" }
    );

    setLoading(false);
    refresh();
    onClose();
  };

  const rejectDocument = async () => {

    if (!reason.trim()) {
      alert("Please enter rejection reason");
      return;
    }

    setLoading(true);

    await fetch(
      `http://127.0.0.1:8000/documents/review/${document.id}/reject`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }
    );

    setLoading(false);
    refresh();
    onClose();
  };

  return (

    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

      {/* Modal */}
      <div className="bg-white w-[1000px] max-h-[90vh] rounded-xl shadow-xl flex flex-col">

        {/* Header */}
        <div className="flex justify-between items-start px-6 py-4 border-b">

          <div>
            <h2 className="text-lg font-semibold">
              {document.employee_name || document.employee_id}
            </h2>

            <p className="text-sm text-gray-500">
              {document.document_type} • Submitted {document.uploaded_at}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black text-xl"
          >
            ✕
          </button>

        </div>


        {/* Scrollable content */}
        <div className="overflow-y-auto p-6 space-y-5">

          {/* Document Preview */}

          <div className="border rounded-lg overflow-hidden h-[520px]">

            <iframe
              src={`http://127.0.0.1:8000/${document.file_path}`}
              className="w-full h-full"
            />

          </div>


          {/* Status Card */}

          {!rejectMode && (

            <div className="border border-orange-200 bg-orange-50 rounded-lg p-4 flex gap-3">

              <div className="w-9 h-9 bg-orange-500 text-white rounded-full flex items-center justify-center">
                ⏱
              </div>

              <div>
                <p className="font-medium text-sm">Pending Review</p>
                <p className="text-xs text-gray-500">
                  This document requires your attention and approval to proceed.
                </p>
              </div>

            </div>

          )}


          {/* Reject textarea */}

          {rejectMode && (

            <textarea
              placeholder="Enter rejection reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border rounded-md p-3"
            />

          )}

        </div>


        {/* Footer Buttons */}

        <div className="border-t p-5 flex gap-4">

          {!rejectMode ? (

            <>
              <button
                disabled={loading}
                onClick={approveDocument}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-md font-medium"
              >
                Approve Document
              </button>

              <button
                disabled={loading}
                onClick={() => setRejectMode(true)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 py-3 rounded-md font-medium"
              >
                Reject Document
              </button>
            </>

          ) : (

            <>
              <button
                disabled={loading}
                onClick={rejectDocument}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-md"
              >
                Submit Rejection
              </button>

              <button
                disabled={loading}
                onClick={() => setRejectMode(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 py-3 rounded-md"
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