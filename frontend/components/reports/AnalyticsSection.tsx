"use client";

import React, { useState, useMemo } from "react";

interface LeaveRecord {
  employee_id: number;
  employee_name?: string | null;
  start_date: string;
  end_date: string;
  status: string;
}

interface AnalyticsSectionProps {
  records: LeaveRecord[];
}

export default function AnalyticsSection({ records }: AnalyticsSectionProps) {
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly" | "yearly">("monthly");

  // Filter only approved leaves
  const approvedRecords = useMemo(() => {
    return records.filter((record) => record.status === "APPROVED");
  }, [records]);

  const weeklyData = useMemo(() => {
    const weekMap = new Map<string, Set<number>>();
    const now = new Date();

    approvedRecords.forEach((record) => {
      const startDate = new Date(record.start_date);
      const endDate = new Date(record.end_date);

      // Only count leaves from the last 12 weeks
      const twoMonthsAgo = new Date(now);
      twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 84);

      if (endDate < twoMonthsAgo) return;

      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const weekStart = new Date(currentDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = weekStart.toISOString().split("T")[0];

        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, new Set());
        }
        weekMap.get(weekKey)!.add(record.employee_id);

        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    const data = Array.from(weekMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, employees]) => ({
        week: new Date(week).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        employees: employees.size,
      }))
      .slice(-12);

    return data;
  }, [approvedRecords]);

  const monthlyData = useMemo(() => {
    const monthMap = new Map<string, Set<number>>();
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    approvedRecords.forEach((record) => {
      const startDate = new Date(record.start_date);
      const endDate = new Date(record.end_date);

      if (endDate < twelveMonthsAgo) return;

      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const monthKey = currentDate.toISOString().slice(0, 7);

        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, new Set());
        }
        monthMap.get(monthKey)!.add(record.employee_id);

        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    const data = Array.from(monthMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, employees]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        employees: employees.size,
      }));

    return data;
  }, [approvedRecords]);

  const yearlyData = useMemo(() => {
    const yearMap = new Map<string, Set<number>>();

    approvedRecords.forEach((record) => {
      const startDate = new Date(record.start_date);
      const endDate = new Date(record.end_date);

      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const year = currentDate.getFullYear().toString();

        if (!yearMap.has(year)) {
          yearMap.set(year, new Set());
        }
        yearMap.get(year)!.add(record.employee_id);

        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    const data = Array.from(yearMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, employees]) => ({
        year,
        employees: employees.size,
      }));

    return data;
  }, [approvedRecords]);

  const getChartData = () => {
    switch (activeTab) {
      case "weekly":
        return weeklyData;
      case "monthly":
        return monthlyData;
      case "yearly":
        return yearlyData;
      default:
        return monthlyData;
    }
  };

  const getAxisLabel = () => {
    switch (activeTab) {
      case "weekly":
        return "Week";
      case "monthly":
        return "Month";
      case "yearly":
        return "Year";
      default:
        return "Month";
    }
  };

  const chartData = getChartData();
  const maxEmployees = Math.max(...chartData.map((d) => d.employees), 1);

  return (
    <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)] md:p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Employee Leave Analytics</h2>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("weekly")}
            className={`px-4 py-2 font-medium transition ${
              activeTab === "weekly"
                ? "border-b-2 border-orange-500 text-orange-500"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Weekly View
          </button>
          <button
            onClick={() => setActiveTab("monthly")}
            className={`px-4 py-2 font-medium transition ${
              activeTab === "monthly"
                ? "border-b-2 border-orange-500 text-orange-500"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Monthly View
          </button>
          <button
            onClick={() => setActiveTab("yearly")}
            className={`px-4 py-2 font-medium transition ${
              activeTab === "yearly"
                ? "border-b-2 border-orange-500 text-orange-500"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Annual View
          </button>
        </div>
      </div>

      {/* Simple Bar Chart */}
      <div className="mt-8">
        {chartData.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No leave data available for this period
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Chart */}
            <div className="flex items-end justify-start gap-4 h-64 overflow-x-auto pb-4">
              {chartData.map((data, index) => {
                const height = (data.employees / maxEmployees) * 200;
                const label = 'week' in data ? data.week : 'month' in data ? data.month : 'year' in data ? data.year : '';
                return (
                  <div key={index} className="flex flex-col items-center gap-2 min-w-fit">
                    <div className="relative h-48 w-12">
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-orange-500 rounded-t-lg transition-all hover:bg-orange-600 cursor-pointer"
                        style={{ height: `${height}px` }}
                        title={`${data.employees} employees`}
                      ></div>
                      <div className="absolute -top-6 left-0 right-0 text-center text-sm font-semibold text-gray-900">
                        {data.employees}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 text-center max-w-fit">{label}</div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded-sm"></div>
                <span className="text-sm text-gray-600">Employees on Leave</span>
              </div>
              <div className="text-sm text-gray-500">
                Y-axis: Number of Employees | X-axis: {getAxisLabel()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
