"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface LeaveBalance { used: number; total: number }
interface LeaveData { annual: LeaveBalance; sick: LeaveBalance; casual: LeaveBalance }
interface Props { permissions: string[] }

const LEAVE_TYPES: { key: keyof LeaveData; label: string; color: string; bar: string }[] = [
  { key: "annual",  label: "Annual Leave",  color: "text-blue-600",   bar: "bg-blue-500" },
  { key: "sick",    label: "Sick Leave",    color: "text-purple-600", bar: "bg-purple-500" },
  { key: "casual",  label: "Casual Leave",  color: "text-teal-600",   bar: "bg-teal-500" },
];

export default function LeaveBalanceWidget(_: Props) {
  const router = useRouter();
  const [data, setData] = useState<LeaveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    apiFetch("/leave/balance")
      .then((r) => {
        if (r.ok) return r.json();
        if (r.status === 404 || r.status === 422) { setUnavailable(true); return null; }
        return null;
      })
      .then((d) => d && setData(d))
      .catch(() => setUnavailable(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm h-full w-full flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-base font-semibold text-gray-800">Leave Balance</h3>
        <CalendarDays size={16} className="text-gray-400" />
      </div>

      {/* Content */}
      <div className="space-y-5 flex-1">
        {loading ? (
          // Skeleton
          LEAVE_TYPES.map((lt) => (
            <div key={lt.key}>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">{lt.label}</span>
                <span className="text-gray-300 animate-pulse">Loading…</span>
              </div>
              <div className="bg-gray-100 h-2 rounded-full animate-pulse" />
            </div>
          ))
        ) : unavailable || !data ? (
          // Graceful fallback — leave module not yet merged
          <div className="flex flex-col items-center justify-center h-full py-6 text-center">
            <CalendarDays size={28} className="text-gray-200 mb-3" />
            <p className="text-sm text-gray-400 font-medium">Leave data not available</p>
            <p className="text-xs text-gray-300 mt-1">Pending system integration</p>
          </div>
        ) : (
          LEAVE_TYPES.map((lt) => {
            const b = data[lt.key];
            const remaining = b.total - b.used;
            const pct = b.total > 0 ? (remaining / b.total) * 100 : 0;
            return (
              <div key={lt.key}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-700">{lt.label}</span>
                  <span className={`font-semibold ${lt.color}`}>
                    {remaining} / {b.total} days
                  </span>
                </div>
                <div className="bg-gray-100 h-2 rounded-full">
                  <div
                    className={`${lt.bar} h-2 rounded-full transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-gray-100 flex justify-end">
        <button 
          onClick={() => router.push("/leave-history")}
          className="text-[#f2924e] text-[10px] font-bold uppercase tracking-wider hover:underline"
        >
          View All
        </button>
      </div>
    </div>
  );
}
