"use client";

import { useRouter } from "next/navigation";
import { CheckSquare, FileText, ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  WIDGET_APPROVAL_VIEW_APPROVALS,
  WIDGET_APPROVAL_VIEW_REQUESTS,
} from "@/lib/permissions";

interface Props { permissions: string[] }

export default function ApprovalSummaryWidget({ permissions }: Props) {
  const router = useRouter();
  const [approvalCount, setApprovalCount] = useState<number>(0);
  const [requestCount, setRequestCount] = useState<number>(0);

  const canViewApprovals = permissions.includes(WIDGET_APPROVAL_VIEW_APPROVALS);
  const canViewRequests  = permissions.includes(WIDGET_APPROVAL_VIEW_REQUESTS);

  useEffect(() => {
    // Graceful fallback — shows 0 if document module not merged yet
    if (canViewApprovals) {
      apiFetch("/documents/approvals/count")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d?.count != null && setApprovalCount(d.count))
        .catch(() => {});
    }
    if (canViewRequests) {
      apiFetch("/documents/requests/count")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d?.count != null && setRequestCount(d.count))
        .catch(() => {});
    }
  }, [canViewApprovals, canViewRequests]);

  if (!canViewApprovals && !canViewRequests) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm h-full w-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-base font-semibold text-gray-800">Approval & Request Summary</h3>
        <CheckSquare size={16} className="text-gray-400" />
      </div>

      <div className="space-y-4 flex-1">
        {/* Document Approvals */}
        {canViewApprovals && (
          <div
            onClick={() => router.push("/dashboard/documents")}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                <FileText size={17} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Document Approvals</p>
                <p className="text-xs text-gray-400">Pending your approval</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">{approvalCount}</span>
              <span className="text-gray-400 text-sm">›</span>
            </div>
          </div>
        )}

        {/* Requests Submitted */}
        {canViewRequests && (
          <div
            onClick={() => router.push("/dashboard/documents/requests")}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <ClipboardList size={17} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Requests Submitted</p>
                <p className="text-xs text-gray-400">Your submitted requests</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">{requestCount}</span>
              <span className="text-gray-400 text-sm">›</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-gray-100 flex justify-end">
        <button 
          onClick={() => router.push("/dashboard/documents")}
          className="text-[#f2924e] text-[10px] font-bold uppercase tracking-wider hover:underline"
        >
          View All
        </button>
      </div>
    </div>
  );
}
