"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { API_BASE_URL, getAuthHeaders } from "@/app/lib/api";

import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import LeaveTabs from "@/components/LeaveTabs";
import EmployeeReportHeader from "@/components/reports/EmployeeReportHeader";
import EmployeeReportStats from "@/components/reports/EmployeeReportStats";
import EmployeeDetailTabs from "@/components/reports/EmployeeDetailTabs";
import AttendanceRecordsTable from "@/components/reports/AttendanceRecordsTable";
import LeaveHistoryPanel from "@/components/reports/LeaveHistoryPanel";
import ViolationsPanel from "@/components/reports/ViolationsPanel";
import ManagerNotesCard from "@/components/reports/ManagerNotesCard";

import { DetailTab, ReportPeriod } from "../types";

export default function EmployeeReportDetailPage() {
  const params = useParams();
  const employeeId = String(params.employeeId);

  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [activeTab, setActiveTab] = useState<DetailTab>("attendance");

  const [employee, setEmployee] = useState<any>(null);
  const [leaveRecords, setLeaveRecords] = useState<any[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<Array<{leave_type:string; allocated:number; used:number; remaining:number}>>([]);
  const [loading, setLoading] = useState(true);

  // Fetch leave records + per-type balance in parallel
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/reports/leave?employee_id=${employeeId}`, { headers: getAuthHeaders() }).then(r => r.json()),
      fetch(`${API_BASE_URL}/reports/employee-balance/${employeeId}`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []),
    ])
      .then(([data, balance]) => {
        if (!data.records || data.records.length === 0) {
          notFound();
          return;
        }

        const first = data.records[0];

        setEmployee({
          id: employeeId,
          name: first.employee_name || "N/A",
          employeeCode: first.employee_code || "N/A",
          department: first.department || "N/A",
          position: first.designation || "N/A",
          manager: "N/A",
          joinDate: first.joined_date || "",
          attendanceRate: 0,
          absentDays: 0,
          lateArrivals: 0,
          totalViolations: 0,
        });

        setLeaveRecords(data.records.map((r: any) => ({
          type: r.leave_type_name,
          startDate: r.start_date,
          endDate: r.end_date,
          days: r.total_days,
          reason: r.reason,
          status: r.status,
          approver: r.approved_by_name,
        })));

        setLeaveBalance(Array.isArray(balance) ? balance : []);
        setLoading(false);
      })
      .catch(() => { notFound(); });
  }, [employeeId]);

  // ⚠️ Placeholder (until backend ready)
  const attendanceRecords: any[] = [];
  const violationRecords: any[] = [];

  const content = useMemo(() => {
    if (activeTab === "attendance") {
      return <AttendanceRecordsTable records={attendanceRecords} />;
    }

    if (activeTab === "leave") {
      return <LeaveHistoryPanel records={leaveRecords} />;
    }

    return <ViolationsPanel records={violationRecords} />;
  }, [activeTab, attendanceRecords, leaveRecords, violationRecords]);

  // ✅ Loading state
  if (loading) {
    return <div className="p-10">Loading...</div>;
  }

  if (!employee) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <TopBar />

      <div className="ml-64 pt-16">
        <main className="min-h-[calc(100vh-4rem)] overflow-auto px-10 pt-4 pb-8">
          <LeaveTabs />

          <div className="mt-2">
            <Link
              href="/reports"
              className="text-sm text-orange-400 hover:text-orange-500 mb-2"
            >
              ← Back to Summary
            </Link>

            <h1 className="mt-3 text-2xl font-semibold text-gray-900 md:text-[24px]">
              Employee Detailed Report
            </h1>
          </div>

          <EmployeeReportHeader
            employee={employee}
            period={period}
            setPeriod={setPeriod}
          />

          <EmployeeReportStats
            employee={employee}
            activeTab={activeTab}
            leaveBalance={leaveBalance}
          />

          <EmployeeDetailTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            violationCount={violationRecords.length}
          />

          {content}

          <ManagerNotesCard />
        </main>
      </div>
    </div>
  );
}