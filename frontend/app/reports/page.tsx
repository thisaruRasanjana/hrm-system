"use client";

import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import LeaveTabs from "@/components/LeaveTabs";
import ReportSummaryCards from "@/components/reports/ReportSummaryCards";
import ReportFilterBar from "@/components/reports/ReportFilterBar";
import EmployeeReportTable from "@/components/reports/EmployeeReportTable";
import { ReportPeriod } from "./types";

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

const API_BASE_URL = "http://127.0.0.1:8000";

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
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

        const response = await fetch(`${API_BASE_URL}/reports/leave`);

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
  }, []);

  const summaryCards = useMemo(() => {
    if (!reportData) return [];

    return [
      {
        label: "Total Requests",
        value: reportData.summary.total_requests,
      },
      {
        label: "Total Leave Days",
        value: reportData.summary.total_leave_days,
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
        label: "Request Info",
        value: reportData.summary.req_info_requests,
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
          totalLeave: 0,
          used: 0,
          pending: 0,
          remaining: 0,
          lastLeave: record.end_date,
        });
      }

      const employee = grouped.get(key)!;

      employee.totalLeave += Number(record.total_days || 0);

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

  const handleDownloadCsv = () => {
    window.open(`${API_BASE_URL}/reports/leave/export/csv`, "_blank");
  };

  const handleDownloadPdf = () => {
    window.open("http://127.0.0.1:8000/reports/leave/pdf", "_blank");
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <TopBar />

      <div className="ml-64 pt-16">
        <main className="min-h-[calc(100vh-4rem)] overflow-auto px-10 py-8">
          <LeaveTabs active="reports" />

          <section className="mt-6">
            <h1 className="text-2xl font-semibold text-gray-900 md:text-[40px]">
              Employee Leave Summary
            </h1>
            <p className="mt-1 text-base text-gray-500 md:text-lg">
              Comprehensive leave report for all employees
            </p>
          </section>

          {loading && (
            <div className="mt-6 rounded-2xl bg-white p-6 text-gray-500 shadow-sm">
              Loading report data...
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl bg-red-50 p-6 text-red-600 shadow-sm">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <ReportSummaryCards cards={summaryCards} />

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

                <EmployeeReportTable rows={filteredRows} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}