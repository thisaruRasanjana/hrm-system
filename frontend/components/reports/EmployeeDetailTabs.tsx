"use client";

import React from "react";
import { DetailTab } from "@/app/reports/types";

interface Props {
  activeTab: DetailTab;
  setActiveTab: (tab: DetailTab) => void;
  violationCount?: number;
}

export default function EmployeeDetailTabs({
  activeTab,
  setActiveTab,
  violationCount = 0,
}: Props) {
  const buttonClass = (tab: DetailTab) =>
    `rounded-xl px-4 py-2 text-sm ${activeTab === tab
      ? "bg-orange-500 text-white"
      : "text-gray-500 hover:bg-gray-100"
    }`;

  return (
    <div className="mt-6 flex items-center gap-3">
      <button
        type="button"
        onClick={() => setActiveTab("attendance")}
        className={buttonClass("attendance")}
      >
        Attendance Records
      </button>

      <button
        type="button"
        onClick={() => setActiveTab("leave")}
        className={buttonClass("leave")}
      >
        Leave History
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setActiveTab("violations")}
          className={buttonClass("violations")}
        >
          Violations
        </button>

        {violationCount > 0 && (
          <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {violationCount}
          </span>
        )}
      </div>
    </div>
  );
}