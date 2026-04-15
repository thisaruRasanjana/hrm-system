"use client";

import React from "react";
import { Download, Calendar, ChevronDown } from "lucide-react";
import { EmployeeDetail, ReportPeriod } from "@/app/reports/types";

interface Props {
  employee: EmployeeDetail;
  period: ReportPeriod;
  setPeriod: (value: ReportPeriod) => void;
}

export default function EmployeeReportHeader({
  employee,
  period,
  setPeriod,
}: Props) {
  const getInitials = (name: string) => {
    if (!name) return "";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {/* TOP HEADER SECTION */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ backgroundColor: "#ffffffff" }}
      >
        {/* LEFT SIDE */}
        <div className="flex items-center gap-5">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "#F9D2BB" }}
          >
            <span
              className="text-[18px] font-medium leading-none"
              style={{ color: "#8D4A27" }}
            >
              {getInitials(employee.name)}
            </span>
          </div>

          <div className="min-w-[160px]">
            <h2
              className="text-[18px] font-semibold leading-tight"
              style={{ color: "#2D3748" }}
            >
              {employee.name}
            </h2>
            <p
              className="mt-1 text-[14px] font-medium"
              style={{ color: "#667085" }}
            >
              {employee.employeeCode}
            </p>
          </div>

          <div className="min-w-[110px]">
            <p className="text-[14px] text-gray-500">Department</p>
            <p className="text-[15px] font-medium text-gray-800">
              {employee.department}
            </p>
          </div>

          <div className="min-w-[140px]">
            <p className="text-[14px] text-gray-500">Position</p>
            <p className="text-[15px] font-medium text-gray-800">
              Senior Developer
            </p>
          </div>

          <div className="min-w-[110px]">
            <p className="text-[14px] text-gray-500">Manager</p>
            <p className="text-[15px] font-medium text-gray-800">
              {employee.manager}
            </p>
          </div>

          <div className="min-w-[120px]">
            <p className="text-[14px] text-gray-500">Join Date</p>
            <p className="text-[15px] font-medium text-gray-800">
              {employee.joinDate}
            </p>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-end gap-2">
          
          <button className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#F2924E] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#d87c3b]">
            <Download className="h-5 w-5" />
            Download Full Report(PDF)
          </button>
        </div>
      </div>
    </div>
  );
}