"use client";

export default function LeaveBalanceWidget() {
  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-sm text-gray-500 mb-4">
        Leave Balance
      </h2>

      <div className="space-y-3">

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Annual Leave</span>
            <span>12/20</span>
          </div>

          <div className="w-full bg-gray-200 h-2 rounded">
            <div className="bg-blue-500 h-2 rounded w-3/5"></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Personal</span>
            <span>3/5</span>
          </div>

          <div className="w-full bg-gray-200 h-2 rounded">
            <div className="bg-purple-500 h-2 rounded w-2/5"></div>
          </div>
        </div>

      </div>
    </div>
  );
}