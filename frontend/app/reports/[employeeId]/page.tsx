"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
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
import {
  attendanceByEmployee,
  employeeDetails,
  leaveHistoryByEmployee,
  violationsByEmployee,
} from "../data";
import { DetailTab, ReportPeriod } from "../types";

export default function EmployeeReportDetailPage() {
  const params = useParams();
  const employeeId = String(params.employeeId);

  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [activeTab, setActiveTab] = useState<DetailTab>("attendance");

  const employee = employeeDetails[employeeId];

  if (!employee) {
    notFound();
  }

  const attendanceRecords = attendanceByEmployee[employeeId] || [];
  const leaveRecords = leaveHistoryByEmployee[employeeId] || [];
  const violationRecords = violationsByEmployee[employeeId] || [];

  const content = useMemo(() => {
    if (activeTab === "attendance") {
      return <AttendanceRecordsTable records={attendanceRecords} />;
    }

    if (activeTab === "leave") {
      return <LeaveHistoryPanel records={leaveRecords} />;
    }

    return <ViolationsPanel records={violationRecords} />;
  }, [activeTab, attendanceRecords, leaveRecords, violationRecords]);

  

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <TopBar />

      <div className="ml-64 pt-16">
        <main className="min-h-[calc(100vh-4rem)] overflow-auto px-10 py-8">
          <LeaveTabs active="reports" />

          <div className="mt-6">
            <Link
              href="/reports"
              className="text-sm text-orange-400 hover:text-orange-500"
            >
              ← Back to Summary
            </Link>

            <h1 className="mt-3 text-2xl font-semibold text-gray-900 md:text-4xl">
              Employee Detailed Report
            </h1>
          </div>

          <EmployeeReportHeader
            employee={employee}
            period={period}
            setPeriod={setPeriod}
          />
          
          <EmployeeReportStats employee={employee} activeTab={activeTab} period={period} setPeriod={setPeriod} />

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