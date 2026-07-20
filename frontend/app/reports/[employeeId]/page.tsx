"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";

import LeaveTabs from "@/components/LeaveTabs";
import { apiFetch } from "@/lib/api";
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

  const today = new Date();
  const toYMD = (d: Date) => d.toISOString().split("T")[0];
  const initialStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const initialEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [customStart, setCustomStart] = useState<string>(toYMD(initialStart));
  const [customEnd, setCustomEnd] = useState<string>(toYMD(initialEnd));
  const [activeTab, setActiveTab] = useState<DetailTab>("attendance");

  const [employee, setEmployee] = useState<any>(null);
  const [leaveRecords, setLeaveRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Fetch data from backend
  useEffect(() => {
    let url = `/reports/leave?employee_id=${employeeId}`;
    if (customStart && customEnd) {
      url += `&start_date=${customStart}&end_date=${customEnd}`;
    }

    apiFetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!data.records || data.records.length === 0) {
          if (!employee) {
            notFound();
          } else {
            setLeaveRecords([]);
            setLoading(false);
          }
          return;
        }

        const first = data.records[0];

        // ✅ Set employee info
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

        // ✅ Set leave records
        const mappedLeaves = data.records.map((r: any) => ({
          type: r.leave_type_name,
          startDate: r.start_date,
          endDate: r.end_date,
          days: r.total_days,
          reason: r.reason,
          status: r.status,
          created_at: r.created_at,
        }));

        setLeaveRecords(mappedLeaves);
        setLoading(false);
      })
      .catch(() => {
        notFound();
      });
  }, [employeeId, customStart, customEnd]);

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
  if (loading && !employee) {
    return <div className="p-10">Loading...</div>;
  }

  if (!employee) return null;

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-50 flex items-center justify-center">
          <span className="text-gray-500 font-medium">Refreshing...</span>
        </div>
      )}
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
            customStart={customStart}
            customEnd={customEnd}
          />

          <EmployeeReportStats
            employee={employee}
            activeTab={activeTab}
            customStart={customStart}
            setCustomStart={setCustomStart}
            customEnd={customEnd}
            setCustomEnd={setCustomEnd}
          />

          <EmployeeDetailTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            violationCount={violationRecords.length}
          />

          {content}

          <ManagerNotesCard />
    </div>
  );
}