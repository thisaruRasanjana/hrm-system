"use client";

import React, { useRef, useState } from "react";
import { Download, ChevronDown, Check } from "lucide-react";
import { EmployeeDetail, ReportPeriod } from "@/app/(leave)/reports/types";
import { API_BASE_URL, getAuthHeaders } from "@/app/lib/api";

interface Props {
  employee: EmployeeDetail;
  period: ReportPeriod;
  setPeriod: (value: ReportPeriod) => void;
}

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "weekly",   label: "Weekly Report"  },
  { value: "monthly",  label: "Monthly Report" },
  { value: "annually", label: "Annual Report"  },
];

export default function EmployeeReportHeader({ employee, period, setPeriod }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const selectedLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "Monthly Report";

  const handleDownload = async () => {
    setDownloading(true);
    const today = new Date();
    const startDate = new Date();

    if (period === "weekly")        startDate.setDate(today.getDate() - 7);
    else if (period === "monthly")  startDate.setMonth(today.getMonth() - 1);
    else if (period === "annually") startDate.setFullYear(today.getFullYear() - 1);

    const startStr = startDate.toISOString().split("T")[0];
    const endStr   = today.toISOString().split("T")[0];
    const url = `${API_BASE_URL}/reports/leave/pdf?employee_id=${employee.id}&start_date=${startStr}&end_date=${endStr}`;

    try {
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `leave_report_${employee.employeeCode}_${startStr}_to_${endStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("PDF download error:", err);
      alert("Failed to download report. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between px-6 py-5">

        {/* ── LEFT: Avatar + info ────────────────────────────────── */}
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "#F9D2BB" }}
          >
            <span className="text-lg font-medium leading-none" style={{ color: "#8D4A27" }}>
              {getInitials(employee.name)}
            </span>
          </div>

          {/* Name + code */}
          <div className="min-w-[160px]">
            <h2 className="text-[18px] font-semibold leading-tight text-gray-800">
              {employee.name}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">{employee.employeeCode}</p>
          </div>

          {/* Department */}
          <div className="hidden min-w-[110px] md:block">
            <p className="text-xs text-gray-400">Department</p>
            <p className="text-sm font-medium text-gray-800">{employee.department}</p>
          </div>

          {/* Position */}
          <div className="hidden min-w-[140px] lg:block">
            <p className="text-xs text-gray-400">Position</p>
            <p className="text-sm font-medium text-gray-800">{employee.position || "—"}</p>
          </div>

          {/* Join Date */}
          <div className="hidden min-w-[120px] xl:block">
            <p className="text-xs text-gray-400">Join Date</p>
            <p className="text-sm font-medium text-gray-800">{employee.joinDate || "—"}</p>
          </div>
        </div>

        {/* ── RIGHT: Period dropdown + Download button ─────────── */}
        <div className="flex items-center gap-3" ref={dropdownRef}>

          {/* Period selector dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:border-orange-300 hover:text-orange-600"
            >
              <span>{selectedLabel}</span>
              <ChevronDown
                className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setPeriod(opt.value);
                      setDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-orange-50 ${
                      period === opt.value
                        ? "bg-orange-50 font-semibold text-orange-600"
                        : "text-gray-700"
                    }`}
                  >
                    {opt.label}
                    {period === opt.value && <Check className="h-4 w-4 text-orange-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#F2924E] px-5 text-sm font-medium text-white shadow-sm transition hover:bg-[#d87c3b] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Generating..." : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}