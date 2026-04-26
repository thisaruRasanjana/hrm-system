import React from "react";
import { EmployeeDetail } from "@/app/(leave)/reports/types";

type LeaveBalanceItem = {
  leave_type: string;
  allocated: number;
  used: number;
  remaining: number;
};

interface Props {
  employee: EmployeeDetail;
  activeTab: "attendance" | "leave" | "violations";
  leaveBalance?: LeaveBalanceItem[];
}

const LEAVE_COLORS: Record<string, { bg: string; bar: string; label: string }> = {
  "Annual Leave":  { bg: "bg-orange-50",  bar: "bg-orange-400", label: "text-orange-600" },
  "Medical Leave": { bg: "bg-blue-50",    bar: "bg-blue-400",   label: "text-blue-600"   },
  "Casual Leave":  { bg: "bg-green-50",   bar: "bg-green-400",  label: "text-green-600"  },
};

const DEFAULT_COLOR = { bg: "bg-gray-50", bar: "bg-gray-400", label: "text-gray-600" };

export default function EmployeeReportStats({ leaveBalance = [] }: Props) {
  return (
    <div className="mt-6">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Leave Balance Summary
      </h3>

      {leaveBalance.length === 0 ? (
        <p className="text-sm text-gray-400">No leave balance data available.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {leaveBalance.map((item) => {
            const color = LEAVE_COLORS[item.leave_type] ?? DEFAULT_COLOR;
            const usedPct =
              item.allocated > 0
                ? Math.min(100, Math.round((item.used / item.allocated) * 100))
                : 0;

            return (
              <div
                key={item.leave_type}
                className={`rounded-2xl border border-gray-100 ${color.bg} p-5 shadow-sm`}
              >
                <p className={`text-xs font-semibold uppercase tracking-wide ${color.label}`}>
                  {item.leave_type}
                </p>

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold text-gray-900">{item.remaining}</p>
                    <p className="mt-0.5 text-xs text-gray-500">days remaining</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">{item.used} used</p>
                    <p className="text-xs text-gray-400">of {item.allocated} allocated</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 h-1.5 w-full rounded-full bg-white/70">
                  <div
                    className={`h-1.5 rounded-full ${color.bar} transition-all`}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs text-gray-400">{usedPct}% used</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}