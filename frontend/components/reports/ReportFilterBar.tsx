"use client";

import React from "react";
import { Search, FileText, Download } from "lucide-react";
import { ReportPeriod } from "@/app/(leave)/reports/types";

interface Props {
  period: ReportPeriod;
  setPeriod: (value: ReportPeriod) => void;
  search: string;
  setSearch: (value: string) => void;
  department: string;
  setDepartment: (value: string) => void;
  departments: string[];
  onExportPdf?: () => void;
  onExportCsv?: () => void;
}

export default function ReportFilterBar({
  period,
  setPeriod,
  search,
  setSearch,
  department,
  setDepartment,
  departments,
  onExportPdf,
  onExportCsv,
}: Props) {
  const periodButton = (value: ReportPeriod) =>
    `relative text-sm px-1 pb-2 font-medium transition-colors duration-200 ${period === value
      ? "text-[#F2924E] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-[#F2924E] after:rounded-full"
      : "text-gray-500 hover:text-gray-700"
    }`;

  return (
    <div className="flex flex-col gap-4">
      {/* Top row: period tabs + export buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-8">
          <button onClick={() => setPeriod("weekly")} className={periodButton("weekly")}>
            Weekly
          </button>
          <button onClick={() => setPeriod("monthly")} className={periodButton("monthly")}>
            Monthly
          </button>
          <button onClick={() => setPeriod("annually")} className={periodButton("annually")}>
            Annually
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onExportPdf}
            className="inline-flex items-center gap-2 rounded-xl bg-[#F2924E] px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
          >
            <FileText size={16} />
            Export PDF
          </button>

          <button
            onClick={onExportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Bottom row: search + department filter */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative w-full md:max-w-sm">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search for name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-700 outline-none focus:border-orange-300 transition-colors"
          />
        </div>

        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none md:min-w-[200px] focus:border-orange-300 transition-colors"
        >
          {departments.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}