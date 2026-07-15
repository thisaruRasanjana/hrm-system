import React from 'react';

export type LeaveBalanceData = {
  leave_type_id: number;
  leave_type_name: string;
  entitlement: number | null;
  used_days: number;
  pending_days: number;
  remaining: number | null;
  mode?: "flat" | "accrual";
  days_per_month?: number;
  total_accrued?: number;
  total_balance?: number;
  this_month_balance?: number;
};

interface Props {
  balances: LeaveBalanceData[];
}

export default function LeaveBalanceCards({ balances }: Props) {
  return (
    <div className="grid grid-cols-2 gap-6 mb-6">
      {balances
        // don't display sick leave on this page
        .filter((b) => b.leave_type_name.toLowerCase() !== 'sick')
        .map((b) => {
          const isAccrual = b.mode === "accrual";

          if (isAccrual) {
            return (
              <div
                key={b.leave_type_id}
                className="bg-gradient-to-br from-orange-50/60 to-amber-50/40 border-2 border-[#EE7F22]/30 rounded-2xl p-5 shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 bg-[#EE7F22] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-sm">
                  Monthly Accrual
                </div>
                <p className="text-sm text-gray-700 mb-1 font-medium">{b.leave_type_name} Leaves</p>
                <h2 className="text-3xl font-bold text-[#F2924E]">
                  {b.remaining ?? 0} <span className="text-base font-medium text-gray-600">days available</span>
                </h2>
                <div className="mt-3 pt-3 border-t border-[#EE7F22]/20 flex justify-between items-center">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Accrual Rate</span>
                  <span className="text-[12px] font-bold text-gray-700">{b.days_per_month} days / month</span>
                </div>
              </div>
            );
          }

          // Flat mode
          const amount = b.remaining === null ? "Unlimited" : b.remaining;
          return (
            <div
              key={b.leave_type_id}
              className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5"
            >
              <p className="text-sm text-gray-500 mb-1">
                {b.leave_type_name} Leaves
              </p>
              <h2 className="text-2xl font-bold text-[#F2924E]">
                {amount} <span className="text-base font-medium text-gray-500">{amount !== "Unlimited" && "days left"}</span>
              </h2>
            </div>
          );
        })}
    </div>
  );
}