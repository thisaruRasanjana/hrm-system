import React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { EmployeeDetail } from "@/app/reports/types";

interface Props {
  employee: EmployeeDetail;
  activeTab: "attendance" | "leave" | "violations";
  period: "weekly" | "monthly" | "annually";
  setPeriod: (value: "weekly" | "monthly" | "annually") => void;
}

export default function EmployeeReportStats({ employee, period, setPeriod }: Props) {
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
      <div className="flex gap-6 border-b border-gray-200 pb-0">
        <button
          onClick={() => setPeriod("weekly")}
          className={`pb-3 text-sm font-medium transition-colors ${
            period === "weekly"
              ? "border-b-2 border-[#F2924E] text-gray-900"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Weekly Report
        </button>
        <button
          onClick={() => setPeriod("monthly")}
          className={`pb-3 text-sm font-medium transition-colors ${
            period === "monthly"
              ? "border-b-2 border-[#F2924E] text-gray-900"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Monthly Report
        </button>
        <button
          onClick={() => setPeriod("annually")}
          className={`pb-3 text-sm font-medium transition-colors ${
            period === "annually"
              ? "border-b-2 border-[#F2924E] text-gray-900"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Annual Report
        </button>
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