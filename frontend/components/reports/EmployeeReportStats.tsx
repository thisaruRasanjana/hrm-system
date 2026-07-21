import React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { EmployeeDetail } from "@/app/reports/types";

interface Props {
  employee: EmployeeDetail;
  customStart?: string;
  setCustomStart?: (value: string) => void;
  customEnd?: string;
  setCustomEnd?: (value: string) => void;
}

export default function EmployeeReportStats({ employee, customStart, setCustomStart, customEnd, setCustomEnd }: Props) {
  const cards = [
    {
      label: "Attendance Rate",
      value: `${employee.attendanceRate}%`,
      note: "Critical - Below Standards",
      noteColor: "text-red-500",
      icon: <ArrowDownRight className="h-4 w-4 text-red-500" />,
    },
    {
      label: "Absent Days",
      value: employee.absentDays,
      note: "Out of 22 working days",
      noteColor: "text-gray-500",
      icon: null,
    },
    {
      label: "Late Arrivals",
      value: employee.lateArrivals,
      note: "Exceeded limit",
      noteColor: "text-red-500",
      icon: null,
    },
    {
      label: "Total Violations",
      value: employee.totalViolations,
      note:
        employee.totalViolations > 0
          ? `${employee.totalViolations} High-severity`
          : "No violations",
      noteColor: employee.totalViolations > 0 ? "text-red-500" : "text-gray-500",
      icon: employee.totalViolations > 0 ? (
        <ArrowUpRight className="h-4 w-4 text-red-500" />
      ) : null,
    },
  ];

  return (
    <div className="mt-4">
      {/* Report Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <div className="flex items-center gap-2 text-sm ml-auto">
          {setCustomStart && setCustomEnd && (
            <>
              <span className="text-gray-600 font-medium whitespace-nowrap">Date Range:</span>
              <input 
                type="date" 
                value={customStart || ""} 
                onChange={(e) => setCustomStart(e.target.value)} 
                className="rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-orange-300 transition-colors"
              />
              <span className="text-gray-400">to</span>
              <input 
                type="date" 
                value={customEnd || ""} 
                onChange={(e) => setCustomEnd(e.target.value)} 
                className="rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-orange-300 transition-colors"
              />
            </>
          )}
        </div>
      </div>

    </div>
  );
}