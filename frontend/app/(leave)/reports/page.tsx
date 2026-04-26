"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import LeaveTabs from "@/components/LeaveTabs";
import ReportSummaryCards from "@/components/reports/ReportSummaryCards";
import ReportFilterBar from "@/components/reports/ReportFilterBar";
import EmployeeReportTable from "@/components/reports/EmployeeReportTable";
import { ReportPeriod } from "./types";
import { API_BASE_URL, getAuthHeaders } from "@/app/lib/api";
import { usePathname } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────
type EmployeeSummaryRow = {
  employee_id: number;
  employee_code: string;
  employee_name: string;
  department: string;
  designation: string;
  allocated: number;
  used: number;
  pending: number;
  remaining: number;
  period_days: number;
};

type BackendLeaveSummary = {
  total_requests: number;
  total_leave_days: number;
  approved_requests: number;
  pending_requests: number;
  rejected_requests: number;
  req_info_requests: number;
};

type BackendLeaveReportResponse = {
  metadata: Record<string, unknown>;
  summary: BackendLeaveSummary;
  analytics: Record<string, unknown>;
  records: unknown[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function getPeriodDateRange(period: ReportPeriod): { start: string; end: string } {
  const today = new Date();
  const toYMD = (d: Date) => d.toISOString().split("T")[0];

  if (period === "weekly") {
    const day = today.getDay();
    const diffToMon = (day + 6) % 7;
    const mon = new Date(today);
    mon.setDate(today.getDate() - diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { start: toYMD(mon), end: toYMD(sun) };
  }

  if (period === "monthly") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: toYMD(start), end: toYMD(end) };
  }

  // annually — full current year
  const start = new Date(today.getFullYear(), 0, 1);
  const end = new Date(today.getFullYear(), 11, 31);
  return { start: toYMD(start), end: toYMD(end) };
}

function getPeriodLabel(period: ReportPeriod): string {
  if (period === "weekly") return "this week";
  if (period === "monthly") return "this month";
  return "this year";
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All Departments");

  const [reportData, setReportData] = useState<BackendLeaveReportResponse | null>(null);
  const [summaryRows, setSummaryRows] = useState<EmployeeSummaryRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [role, setRole] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    setRole(localStorage.getItem("role"));
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const { start, end } = getPeriodDateRange(period);

      const [reportRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE_URL}/reports/leave?start_date=${start}&end_date=${end}`, {
          headers: getAuthHeaders(),
          cache: "no-store",
        }),
        fetch(`${API_BASE_URL}/leave/summary?start_date=${start}&end_date=${end}`, {
          headers: getAuthHeaders(),
          cache: "no-store",
        }),
      ]);

      if (!reportRes.ok || !summaryRes.ok) {
        throw new Error("Failed to fetch report data");
      }

      const [reportJson, summaryJson] = await Promise.all([
        reportRes.json(),
        summaryRes.json(),
      ]);

      setReportData(reportJson);
      setSummaryRows(summaryJson);
    } catch (err) {
      console.error("Report fetch error:", err);
      setError("Failed to load report data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  // Fetch when period changes OR when navigating back to this page
  useEffect(() => {
    if (mounted && role === "hr") {
      fetchData();
    }
  }, [mounted, role, fetchData]);

  const summaryCards = useMemo(() => {
    if (!reportData) return [];
    const s = reportData.summary;
    return [
      {
        label: "Approved",
        value: s.approved_requests,
        sublabel: "Fully approved requests",
        color: {
          bg: "bg-green-50",     border: "border-green-200",
          value: "text-green-600",
          bar: "bg-green-400",   pill: "bg-green-100",  pillText: "text-green-700",
        },
      },
      {
        label: "Pending",
        value: s.pending_requests,
        sublabel: "Awaiting manager decision",
        color: {
          bg: "bg-yellow-50",    border: "border-yellow-200",
          value: "text-yellow-600",
          bar: "bg-yellow-400",  pill: "bg-yellow-100", pillText: "text-yellow-700",
        },
      },
      {
        label: "Rejected",
        value: s.rejected_requests,
        sublabel: "Not approved by manager",
        color: {
          bg: "bg-red-50",       border: "border-red-200",
          value: "text-red-600",
          bar: "bg-red-400",     pill: "bg-red-100",    pillText: "text-red-700",
        },
      },
    ];
  }, [reportData]);


  const tableRows = useMemo(() =>
    summaryRows.map((row) => ({
      id: String(row.employee_id),
      name: row.employee_name,
      employeeCode: row.employee_code,
      role: row.designation,
      department: row.department,
      totalLeave: row.allocated,
      used: row.used,
      pending: row.pending,
      remaining: row.remaining,
      lastLeave: "",
      periodDays: row.period_days ?? 0,
    })),
    [summaryRows]
  );

  const filteredRows = useMemo(() => {
    return tableRows.filter((row) => {
      const matchesSearch =
        row.name.toLowerCase().includes(search.toLowerCase()) ||
        row.employeeCode.toLowerCase().includes(search.toLowerCase());
      const matchesDepartment =
        department === "All Departments" || row.department === department;
      return matchesSearch && matchesDepartment;
    });
  }, [tableRows, search, department]);

  const handleDownloadCsv = async () => {
    try {
      const { start, end } = getPeriodDateRange(period);
      const url = `${API_BASE_URL}/reports/leave/export/csv?start_date=${start}&end_date=${end}`;
      const response = await fetch(url, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `leave_report_${start}_to_${end}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("CSV Export error:", err);
      alert("Failed to export CSV");
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const { start, end } = getPeriodDateRange(period);
      const url = `${API_BASE_URL}/reports/leave/pdf?start_date=${start}&end_date=${end}`;
      const response = await fetch(url, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `leave_report_${start}_to_${end}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("PDF Export error:", err);
      alert("Failed to export PDF");
    }
  };

  const departmentOptions = useMemo(() => {
    const unique = Array.from(
      new Set(tableRows.map((r) => r.department).filter((d) => d && d !== "N/A"))
    );
    return ["All Departments", ...unique];
  }, [tableRows]);

  if (!mounted || role !== "hr") {
    return <div className="p-10">Access Denied. Only HR can view reports.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <TopBar />

      <div className="ml-64 pt-16">
        <main className="min-h-[calc(100vh-4rem)] overflow-auto px-10 pt-4 pb-8">
          <LeaveTabs />

          <section className="mt-6">
            <h1 className="text-2xl font-semibold text-gray-900 md:text-[24px]">
              Employee Leave Summary
            </h1>
            <p className="mt-1 text-base text-gray-500">
              Showing employees with leave requests {getPeriodLabel(period)} · Year-to-date totals
            </p>
          </section>

          {loading && (
            <div className="mt-6 rounded-2xl bg-white p-6 text-gray-500 shadow-sm animate-pulse">
              Loading report data...
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl bg-red-50 p-6 text-red-600 shadow-sm border border-red-100">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <ReportSummaryCards
                cards={summaryCards}
                total={reportData ? reportData.summary.approved_requests + reportData.summary.pending_requests + reportData.summary.rejected_requests : undefined}
              />

              <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)] md:p-6">
                <ReportFilterBar
                  period={period}
                  setPeriod={setPeriod}
                  search={search}
                  setSearch={setSearch}
                  department={department}
                  setDepartment={setDepartment}
                  departments={departmentOptions}
                  onExportCsv={handleDownloadCsv}
                  onExportPdf={handleDownloadPdf}
                />

                {filteredRows.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    No employees found with leave requests {getPeriodLabel(period)}.
                  </div>
                ) : (
                  <EmployeeReportTable rows={filteredRows} period={period} />
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}