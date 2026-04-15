"use client";

import React, { useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import LeaveTabs from "@/components/LeaveTabs";
import ReportSummaryCards from "@/components/reports/ReportSummaryCards";
import ReportFilterBar from "@/components/reports/ReportFilterBar";
import EmployeeReportTable from "@/components/reports/EmployeeReportTable";
import {
  departments,
  employeeReportRowsByPeriod,
  summaryCardsByPeriod,
} from "./data";
import { ReportPeriod } from "./types";

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All Departments");

  const rowsForSelectedPeriod = employeeReportRowsByPeriod[period];
  const cardsForSelectedPeriod = summaryCardsByPeriod[period];

  const filteredRows = useMemo(() => {
    return rowsForSelectedPeriod.filter((employee) => {
      const matchesSearch =
        employee.name.toLowerCase().includes(search.toLowerCase()) ||
        employee.employeeCode.toLowerCase().includes(search.toLowerCase());

      const matchesDepartment =
        department === "All Departments" || employee.department === department;

      return matchesSearch && matchesDepartment;
    });
  }, [rowsForSelectedPeriod, search, department]);

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

          <ReportSummaryCards cards={cardsForSelectedPeriod} />

          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)] md:p-6">
            <ReportFilterBar
              period={period}
              setPeriod={setPeriod}
              search={search}
              setSearch={setSearch}
              department={department}
              setDepartment={setDepartment}
              departments={departments}
            />

            <EmployeeReportTable rows={filteredRows} />
          </div>
        </main>
      </div>
    </div>
  );
}