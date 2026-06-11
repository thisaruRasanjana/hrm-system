import React from "react";
import { LeaveHistoryRecord } from "@/app/reports/types";

interface Props {
  records: LeaveHistoryRecord[];
}

export default function LeaveHistoryPanel({ records }: Props) {
  const totalAllowed = 20;
  const leaveUsed = 8;
  const leaveRemaining = 12;

  const statusClasses = (status: LeaveHistoryRecord["status"]) => {
    if (status === "APPROVED") {
      return "bg-green-100 text-green-600";
    }
    if (status === "PENDING") {
      return "bg-yellow-100 text-yellow-700";
    }
    return "bg-red-100 text-red-600";
  };

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-400">Total Leave Allowed</p>
          <h3 className="mt-2 text-3xl font-semibold text-gray-900">20 days</h3>
        </div>

        <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
          <p className="text-xs text-gray-400">Leave Used</p>
          <h3 className="mt-2 text-3xl font-semibold text-orange-500">
            {leaveUsed} days
          </h3>
        </div>

        <div className="rounded-xl border border-green-100 bg-green-50 p-4">
          <p className="text-xs text-gray-400">Leave Remaining</p>
          <h3 className="mt-2 text-3xl font-semibold text-green-600">
            {leaveRemaining} days
          </h3>
        </div>
      </div>

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
            </tr>
          </thead>

          <tbody>
            {records.map((record, index) => (
              <tr key={`${record.type}-${index}`} className="border-t border-gray-100">
                <td className="py-4 text-sm text-gray-700">{record.type}</td>
                <td className="py-4 text-sm text-gray-700">{record.startDate}</td>
                <td className="py-4 text-sm text-gray-700">{record.endDate}</td>
                <td className="py-4 text-sm text-gray-700">{record.days}</td>
                <td className="py-4 text-sm text-gray-700">{record.reason}</td>
                <td className="py-4 text-sm">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(
                      record.status
                    )}`}
                  >
                    {record.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}