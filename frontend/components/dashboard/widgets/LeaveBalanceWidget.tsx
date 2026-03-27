"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";

export default function LeaveBalanceWidget() {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push("/dashboard/leave")}
      className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer h-full w-full flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-base font-semibold text-gray-800">Leave Balance</h3>
        <CalendarDays size={16} className="text-gray-400" />
      </div>

      {/* Leave items */}
      <div className="space-y-5 flex-1">
        {/* Annual Leave */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-700">Annual Leave</span>
            <span className="font-semibold text-gray-800">12/20</span>
          </div>
          <div className="bg-gray-100 h-2 rounded-full">
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: "60%" }} />
          </div>
        </div>

        {/* Personal Leave */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-700">Personal</span>
            <span className="font-semibold text-gray-800">3/5</span>
          </div>
          <div className="bg-gray-100 h-2 rounded-full">
            <div className="bg-purple-500 h-2 rounded-full" style={{ width: "60%" }} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <span className="text-[#F2924E] text-sm font-medium">View &rsaquo;</span>
      </div>
    </div>
  );
}
