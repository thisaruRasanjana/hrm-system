import React from "react";
import { LeaveHistoryRecord } from "@/app/(leave)/reports/types";

interface Props {
  records: LeaveHistoryRecord[];
}

export default function LeaveHistoryPanel({ records }: Props) {
  const statusClasses = (status: LeaveHistoryRecord["status"]) => {
    if (status === "APPROVED") return "bg-green-100 text-green-600";
    if (status === "PENDING") return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-600";
  };

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
      {records.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No leave records found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-400">
                <th className="py-3 font-medium">Type</th>
                <th className="py-3 font-medium">Start Date</th>
                <th className="py-3 font-medium">End Date</th>
                <th className="py-3 font-medium">Days</th>
                <th className="py-3 font-medium">Reason</th>
                <th className="py-3 font-medium">Status</th>
                <th className="py-3 font-medium">Approver</th>
              </tr>
            </thead>

            <tbody>
              {records.map((record, index) => (
                <tr key={`${record.type}-${index}`} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 text-sm font-medium text-gray-800">{record.type}</td>
                  <td className="py-4 text-sm text-gray-600">{record.startDate}</td>
                  <td className="py-4 text-sm text-gray-600">{record.endDate}</td>
                  <td className="py-4 text-sm text-gray-700">{record.days}</td>
                  <td className="py-4 text-sm text-gray-600">{record.reason || '—'}</td>
                  <td className="py-4 text-sm">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(record.status)}`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="py-4 text-sm text-gray-700">{record.approver || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
