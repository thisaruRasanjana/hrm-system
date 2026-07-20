import React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { EmployeeDetail } from "@/app/reports/types";

interface Props {
  employee: EmployeeDetail;
  activeTab: "attendance" | "leave" | "violations";
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

      {/* Stats Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-[20px] border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-gray-600">
              {card.label}
            </p>
            {card.icon ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50">
                {card.icon}
              </span>
            ) : (
              <span className="h-8 w-8" />
            )}
          </div>
          <h3 className="mt-4 text-3xl font-bold text-gray-900">{card.value}</h3>
          <p className={`mt-3 text-sm ${card.noteColor}`}>{card.note}</p>
        </div>
      ))}
      </div>
    </div>
  );
}