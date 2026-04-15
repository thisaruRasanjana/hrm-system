"use client";

import React from "react";
import { Search, FileText, Download } from "lucide-react";
import { ReportPeriod } from "@/app/reports/types";

interface Props {
  period: ReportPeriod;
  setPeriod: (value: ReportPeriod) => void;
  search: string;
  setSearch: (value: string) => void;
  department: string;
  setDepartment: (value: string) => void;
  departments: string[];
}

export default function ReportFilterBar({
  period,
  setPeriod,
  search,
  setSearch,
  department,
  setDepartment,
  departments,
}: Props) {
  const periodButton = (value: ReportPeriod, label: string) =>
    `text-sm pb-2 px-2 ${
      period === value
        ? "text-orange-500 border-b-2 border-orange-500"
        : "text-gray-500"
    }`;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 mt-6 p-4 md:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-12">
            <button
              onClick={() => setPeriod("weekly")}
              className={periodButton("weekly", "Weekly")}
            >
              Weekly
            </button>
            <button
              onClick={() => setPeriod("monthly")}
              className={periodButton("monthly", "Monthly")}
            >
              Monthly
            </button>
            <button
              onClick={() => setPeriod("annually")}
              className={periodButton("annually", "Annually")}
            >
              Annually
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">
              <FileText size={16} />
              Export PDF
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>

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
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-700 outline-none"
            />
          </div>

          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none md:min-w-[220px]"
          >
            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}