"use client";

import React, { useEffect, useMemo, useState } from "react";
import LeaveTabs from "@/components/LeaveTabs";
import ReportSummaryCards from "@/components/reports/ReportSummaryCards";
import ReportFilterBar from "@/components/reports/ReportFilterBar";
import EmployeeReportTable from "@/components/reports/EmployeeReportTable";
import { ReportPeriod } from "./types";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

type BackendLeaveRecord = {
  leave_request_id: number;
  employee_id: number;
  employee_code?: string | null;
  employee_name?: string | null;
  department?: string | null;
  designation?: string | null;
  joined_date?: string | null;
  employee_status?: string | null;
  leave_type_id: number;
  leave_type_name?: string | null;
  allocated?: number | null;
  start_date: string;
  end_date: string;
  total_days: number;
  half_day: boolean;
  status: string;
  reason?: string | null;
  approved_by?: number | null;
  approved_date?: string | null;
  rejection_reason?: string | null;
  manager_comment?: string | null;
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
  summary: BackendLeaveSummary;
  records: BackendLeaveRecord[];
};


const today = new Date();
const toYMD = (d: Date) => d.toISOString().split("T")[0];

export default function ReportsPage() {
  const { loading: authLoading, hasPermission } = useAuth();
  const canViewReports = hasPermission("leave:report");

  const initialStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const initialEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [customStart, setCustomStart] = useState<string>(toYMD(initialStart));
  const [customEnd, setCustomEnd] = useState<string>(toYMD(initialEnd));
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All Departments");

  const [reportData, setReportData] = useState<BackendLeaveReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await apiFetch(`/reports/leave?start_date=${customStart}&end_date=${customEnd}`);

        if (!response.ok) {
          throw new Error("Failed to fetch report data");
        }

        const data: BackendLeaveReportResponse = await response.json();
        setReportData(data);
      } catch (err) {
        console.error("Report fetch error:", err);
        setError("Failed to load report data");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [customStart, customEnd]);

  const summaryCards = useMemo(() => {
    if (!reportData) return [];

    return [
      {
        label: "Total Leave Requests",
        value: reportData.summary.total_requests,
      },
      {
        label: "Approved Requests",
        value: reportData.summary.approved_requests,
      },
      {
        label: "Pending Requests",
        value: reportData.summary.pending_requests,
      },
      {
        label: "Rejected Requests",
        value: reportData.summary.rejected_requests,
      },
      {
        label: "Total Leave Days Taken",
        value: reportData.summary.total_leave_days,
      },
    ];
  }, [reportData]);

  const tableRows = useMemo(() => {
    if (!reportData) return [];

    const grouped = new Map<
      number,
      {
        id: string;
        name: string;
        employeeCode: string;
        role: string;
        department: string;
        totalLeave: number;
        used: number;
        pending: number;
        remaining: number;
        lastLeave: string;
      }
    >();

    reportData.records.forEach((record) => {
      const key = record.employee_id;

      if (!grouped.has(key)) {
        grouped.set(key, {
          id: String(record.employee_id),
          name: record.employee_name || `Employee ${record.employee_id}`,
          employeeCode:
            record.employee_code || `EMP-${String(record.employee_id).padStart(3, "0")}`,
          role: record.designation || "Staff",
          department: record.department || "N/A",
          // "Allocated" is the employee's real yearly entitlement, not the sum
          // of requested days. It is identical on every record for the employee.
          totalLeave: Number(record.allocated || 0),
          used: 0,
          pending: 0,
          remaining: 0,
          lastLeave: record.end_date,
        });
      }

      const employee = grouped.get(key)!;

      if (record.status === "APPROVED") {
        employee.used += Number(record.total_days || 0);
      }

      if (record.status === "PENDING") {
        employee.pending += Number(record.total_days || 0);
      }

      if (record.end_date > employee.lastLeave) {
        employee.lastLeave = record.end_date;
      }
    });

    for (const employee of grouped.values()) {
      employee.remaining = Math.max(
        employee.totalLeave - employee.used - employee.pending,
        0
      );
    }

    return Array.from(grouped.values());
  }, [reportData]);

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

  // Authenticated download: window.open can't send the JWT, so fetch a blob
  const downloadReport = async (path: string, filename: string) => {
    try {
      const res = await apiFetch(path);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Report download error:", err);
      alert("Failed to download report.");
    }
  };

  const handleDownloadCsv = () => {
    downloadReport(
      `/reports/leave/export/csv?start_date=${customStart}&end_date=${customEnd}`,
      "leave_report.csv"
    );
  };

  const handleDownloadPdf = () => {
    downloadReport(
      `/reports/leave/pdf?start_date=${customStart}&end_date=${customEnd}`,
      "leave_report.pdf"
    );
  };

  const departmentOptions = useMemo(() => {
    const uniqueDepartments = Array.from(
      new Set(
        tableRows
          .map((row) => row.department)
          .filter((d) => d && d !== "N/A")
      )
    );

    return ["All Departments", ...uniqueDepartments];
  }, [tableRows]);

  if (authLoading) {
    return null;
  }

  if (!canViewReports) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 text-sm">
        You don&apos;t have permission to view leave reports.
      </div>
    );
  }

  return (
    <div>
      <LeaveTabs />

      <section className="mt-6">
        <h1 className="text-2xl font-semibold text-gray-900 md:text-[24px]">
          Employee Leave Summary
        </h1>
        <p className="mt-1 md:text-[16px] text-base text-gray-500 md:text-lg">
          Comprehensive leave report for all employees
        </p>
      </section>

      {!reportData && loading && (
        <div className="mt-6 rounded-2xl bg-white p-6 text-gray-500 shadow-sm">
          Loading report data...
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl bg-red-50 p-6 text-red-600 shadow-sm">
          {error}
        </div>
      )}

      {reportData && !error && (
        <>
          <ReportSummaryCards cards={summaryCards} />

          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)] md:p-6 relative">
            {loading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-3xl">
                <span className="text-gray-500 font-medium">Refreshing...</span>
              </div>
            )}

            <ReportFilterBar
              search={search}
              setSearch={setSearch}
              department={department}
              setDepartment={setDepartment}
              departments={departmentOptions}
              onExportCsv={handleDownloadCsv}
              onExportPdf={handleDownloadPdf}
              customStart={customStart}
              setCustomStart={setCustomStart}
              customEnd={customEnd}
              setCustomEnd={setCustomEnd}
            />

            <EmployeeReportTable rows={filteredRows} />
          </div>
        </>
      )}
    </div>
  );
}