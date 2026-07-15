"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

/** One per-type balance row as returned by GET /leave/balance/me */
interface LeaveBalanceRow {
  leave_type_id: number;
  leave_type_name: string;
  entitlement: number | null; // null = unlimited
  used_days: number;
  pending_days: number;
  remaining: number | null;   // null = unlimited
  // accrual-mode extras
  mode?: "flat" | "accrual";
  days_per_month?: number;
  total_accrued?: number;
  total_balance?: number;
  this_month_balance?: number;
}

interface Props { permissions: string[] }

// Cycle a small palette so each leave type gets a distinct colour.
const PALETTE = [
  { text: "text-blue-600", bar: "bg-blue-500" },
  { text: "text-purple-600", bar: "bg-purple-500" },
  { text: "text-teal-600", bar: "bg-teal-500" },
  { text: "text-orange-600", bar: "bg-orange-500" },
  { text: "text-pink-600", bar: "bg-pink-500" },
];

export default function LeaveBalanceWidget(_: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<LeaveBalanceRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    apiFetch("/leave/balance/me")
      .then((r) => {
        if (r.ok) return r.json();
        // 404/422 → user has no leave profile (e.g. not an employee)
        setUnavailable(true);
        return null;
      })
      .then((d) => {
        if (Array.isArray(d)) setRows(d);
        else if (d !== null) setUnavailable(true);
      })
      .catch(() => setUnavailable(true))
      .finally(() => setLoading(false));
  }, []);

  const hasData = Array.isArray(rows) && rows.length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm h-full w-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-base font-semibold text-gray-800">Leave Balance</h3>
        <CalendarDays size={16} className="text-gray-400" />
      </div>

      {/* Content */}
      <div className="space-y-5 flex-1 overflow-y-auto">
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i}>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300 animate-pulse">Loading…</span>
                <span className="text-gray-300 animate-pulse">— / —</span>
              </div>
              <div className="bg-gray-100 h-2 rounded-full animate-pulse" />
            </div>
          ))
        ) : unavailable || !hasData ? (
          <div className="flex flex-col items-center justify-center h-full py-6 text-center">
            <CalendarDays size={28} className="text-gray-200 mb-3" />
            <p className="text-sm text-gray-400 font-medium">No leave balance to show</p>
            <p className="text-xs text-gray-300 mt-1">
              {unavailable ? "No leave profile linked to your account" : "No leave types configured yet"}
            </p>
          </div>
        ) : (
          rows!.map((row, idx) => {
            const color = PALETTE[idx % PALETTE.length];
            const isAccrual = row.mode === "accrual";

            if (isAccrual) {
              // ── Monthly accrual display ──────────────────────────────
              return (
                <div key={row.leave_type_id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{row.leave_type_name}</span>
                    <span className="text-[10px] text-orange-500 font-bold uppercase tracking-wide">Monthly</span>
                  </div>
                  <div className="flex justify-between text-[12px] text-gray-500 mb-1">
                    <span>This month</span>
                    <span className={`font-semibold ${color.text}`}>{row.this_month_balance ?? 0} days</span>
                  </div>
                  <div className="flex justify-between text-[12px] text-gray-500">
                    <span>Total accumulated</span>
                    <span className={`font-semibold ${color.text}`}>{row.total_balance ?? 0} days</span>
                  </div>
                  <div className="bg-gray-100 h-1.5 rounded-full mt-2">
                    <div
                      className={`${color.bar} h-1.5 rounded-full transition-all duration-700`}
                      style={{
                        width: row.total_accrued && row.total_accrued > 0
                          ? `${Math.min(100, ((row.total_balance ?? 0) / row.total_accrued) * 100)}%`
                          : "0%",
                      }}
                    />
                  </div>
                </div>
              );
            }

            // ── Flat / standard display (unchanged) ─────────────────
            const total = row.entitlement;
            const remaining = row.remaining;
            const unlimited = total == null;
            const pct =
              !unlimited && total! > 0 && remaining != null
                ? Math.max(0, Math.min(100, (remaining / total!) * 100))
                : 0;

            return (
              <div key={row.leave_type_id}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-700">{row.leave_type_name}</span>
                  <span className={`font-semibold ${color.text}`}>
                    {unlimited ? "Unlimited" : `${remaining ?? 0} / ${total} days`}
                  </span>
                </div>
                {!unlimited && (
                  <div className="bg-gray-100 h-2 rounded-full">
                    <div
                      className={`${color.bar} h-2 rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
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
