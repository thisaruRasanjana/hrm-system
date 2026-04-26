import React from "react";
import Link from "next/link";
import { EmployeeReportRow, ReportPeriod } from "@/app/(leave)/reports/types";

interface Props {
  rows: EmployeeReportRow[];
  period: ReportPeriod;
}

function periodLabel(period: ReportPeriod): string {
  if (period === "weekly") return "This Week";
  if (period === "monthly") return "This Month";
  return "This Year";
}

export default function EmployeeReportTable({ rows, period }: Props) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[1100px] table-fixed border-separate border-spacing-0">
        <thead>
          <tr className="text-left text-xs uppercase text-gray-400">
            <th className="px-4 py-4 font-medium w-[10%]">Employee ID</th>
            <th className="px-4 py-4 font-medium w-[16%]">Employee Name</th>
            <th className="px-4 py-4 font-medium w-[12%]">Department</th>
            <th className="px-4 py-4 font-medium w-[9%]">Allocated</th>
            <th className="px-4 py-4 font-medium w-[9%]">Used</th>
            <th className="px-4 py-4 font-medium w-[9%]">Pending</th>
            <th className="px-4 py-4 font-medium w-[9%]">Remaining</th>
            <th className="px-4 py-4 font-medium w-[12%] text-blue-500">
              {periodLabel(period)}
            </th>
            <th className="px-4 py-4 font-medium w-[14%] text-right pr-4">Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="px-4 py-4 text-sm text-gray-700 font-medium">{row.employeeCode}</td>

              <td className="px-4 py-4 align-top">
                <div className="text-sm font-medium text-gray-900">{row.name}</div>
                <div className="text-xs text-gray-400">{row.role}</div>
              </td>

              <td className="px-4 py-4 text-sm text-gray-700">{row.department}</td>
              <td className="px-4 py-4 text-sm text-gray-700">{row.totalLeave} days</td>
              <td className="px-4 py-4 text-sm text-orange-500">{row.used} days</td>
              <td className="px-4 py-4 text-sm text-orange-400">{row.pending} days</td>
              <td className="px-4 py-4 text-sm text-green-600">{row.remaining} days</td>

              <td className="px-4 py-4 text-sm">
                {row.periodDays > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
                    {row.periodDays} day{row.periodDays !== 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-gray-300 text-xs">—</span>
                )}
              </td>

              <td className="px-4 py-4 text-sm text-right pr-4">
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