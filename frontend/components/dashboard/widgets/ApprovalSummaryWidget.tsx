"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, CheckSquare } from "lucide-react";

const items = [
  {
    label: "Document Approvals",
    count: 3,
    icon: FileText,
    color: "text-purple-600",
    bg: "bg-purple-50",
    route: "/dashboard/documents",
  },
  {
    label: "Requests Submitted",
    count: 2,
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50",
    route: "/dashboard/leave",
  },
];

export default function ApprovalSummaryWidget() {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push("/dashboard/leave")}
      className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer h-full w-full flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-base font-semibold text-gray-800">
          Approval &amp; Request Summary
        </h3>
        <CheckSquare size={16} className="text-gray-400" />
      </div>

      {/* Items */}
      <div className="space-y-4 flex-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              onClick={(e) => { e.stopPropagation(); router.push(item.route); }}
              className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center`}>
                  <Icon size={17} className={item.color} />
                </div>
                <span className="text-sm text-gray-700">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900">{item.count}</span>
                <span className="text-gray-400 text-sm">&rsaquo;</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
