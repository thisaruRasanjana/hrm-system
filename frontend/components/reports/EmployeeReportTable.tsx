import React from "react";
import Link from "next/link";
import { EmployeeReportRow } from "@/app/reports/types";

interface Props {
  rows: EmployeeReportRow[];
}

export default function EmployeeReportTable({ rows }: Props) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[1000px] border-separate border-spacing-0">
        <thead>
          <tr className="text-left text-xs uppercase text-gray-400">
            <th className="px-4 py-4 font-medium">Employee Name</th>
            <th className="px-4 py-4 font-medium">Department</th>
            <th className="px-4 py-4 font-medium">Allocated Leave Days</th>
            <th className="px-4 py-4 font-medium">Used Leave Days</th>
            <th className="px-4 py-4 font-medium">Pending Leave Days</th>
            <th className="px-4 py-4 font-medium">Remaining Leave Balance</th>
            <th className="px-4 py-4 font-medium">Last Leave Date</th>
            <th className="px-4 py-4 font-medium">Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-gray-100">
              <td className="px-4 py-4 align-top">
                <div className="text-sm font-medium text-gray-900">{row.name}</div>
                <div className="text-sm text-gray-500">{row.role}</div>
              </td>

              <td className="px-4 py-4 text-sm text-gray-700">{row.department}</td>
              <td className="px-4 py-4 text-sm text-gray-700">{row.totalLeave} days</td>
              <td className="px-4 py-4 text-sm text-orange-500">{row.used} days</td>
              <td className="px-4 py-4 text-sm text-orange-500">{row.pending} days</td>
              <td className="px-4 py-4 text-sm text-green-600">{row.remaining} days</td>
              <td className="px-4 py-4 text-sm text-gray-700">
                {new Date(row.lastLeave).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </td>
              <td className="px-4 py-4 text-sm">
                <Link
                  href={`/reports/${row.id}`}
                  className="font-medium text-orange-500 hover:text-orange-600"
                >
                  View Details
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}