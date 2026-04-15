import React from "react";
import { AttendanceRecord } from "@/app/reports/types";

interface Props {
  records: AttendanceRecord[];
}

export default function AttendanceRecordsTable({ records }: Props) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
      <table className="w-full min-w-[900px]">
        <thead>
          <tr className="text-left text-xs uppercase text-gray-400">
            <th className="py-3 font-medium">Employee</th>
            <th className="py-3 font-medium">Department</th>
            <th className="py-3 font-medium">Present</th>
            <th className="py-3 font-medium">Absent</th>
            <th className="py-3 font-medium">Total Days</th>
            <th className="py-3 font-medium">Rate</th>
            <th className="py-3 font-medium">Trend</th>
          </tr>
        </thead>

        <tbody>
          {records.map((record) => (
            <tr key={record.employeeCode} className="border-t border-gray-100">
              <td className="py-4">
                <div className="text-sm font-medium text-gray-900">
                  {record.employeeName}
                </div>
                <div className="text-sm text-gray-500">{record.employeeCode}</div>
              </td>
              <td className="py-4 text-sm text-gray-700">{record.department}</td>
              <td className="py-4 text-sm text-green-600">{record.present} days</td>
              <td className="py-4 text-sm text-red-400">{record.absent} days</td>
              <td className="py-4 text-sm text-gray-700">{record.totalDays} days</td>
              <td className="py-4 text-sm text-gray-700">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-16 rounded-full bg-orange-100">
                    <div
                      className="h-1.5 rounded-full bg-orange-500"
                      style={{ width: `${record.rate}%` }}
                    />
                  </div>
                  <span>{record.rate}%</span>
                </div>
              </td>
              <td className="py-4 text-sm text-red-400">{record.trend}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}