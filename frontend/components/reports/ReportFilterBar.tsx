"use client";

import React from "react";
import { Search, FileText, Download } from "lucide-react";

interface Props {
  search: string;
  setSearch: (value: string) => void;
  department: string;
  setDepartment: (value: string) => void;
  departments: string[];
  onExportPdf?: () => void;
  onExportCsv?: () => void;
  customStart?: string;
  setCustomStart?: (val: string) => void;
  customEnd?: string;
  setCustomEnd?: (val: string) => void;
}

export default function ReportFilterBar({
  search,
  setSearch,
  department,
  setDepartment,
  departments,
  onExportPdf,
  onExportCsv,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      {/* Top row: date filters + export buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-3">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {setCustomStart && setCustomEnd && (
            <div className="flex items-center gap-2 text-sm">
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
            </div>
          )}
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