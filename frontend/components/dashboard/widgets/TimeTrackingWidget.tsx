"use client";

import { useRouter } from "next/navigation";
import { Clock, Play } from "lucide-react";

export default function TimeTrackingWidget() {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push("/dashboard/time-tracking")}
      className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer h-full w-full flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-semibold text-gray-800">Time Tracking</h3>
        <Clock size={16} className="text-gray-400" />
      </div>

      {/* Timer */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
          0:00:00
        </h1>
        <p className="text-gray-400 text-sm mt-2">Not clocked in yet</p>

        <button
          onClick={(e) => { e.stopPropagation(); router.push("/dashboard/time-tracking"); }}
          className="mt-5 bg-[#F2924E] hover:bg-[#e4833f] text-white px-8 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium w-full justify-center transition"
        >
          <Play size={14} fill="white" />
          Start Work
        </button>
      </div>

      {/* Footer */}
      <div className="flex justify-between text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">
        <span>This week</span>
        <span className="font-semibold text-gray-800">41.5 hours</span>
      </div>
    </div>
  );
}
