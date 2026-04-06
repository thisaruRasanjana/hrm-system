"use client";

import { useRouter } from "next/navigation";
import { BarChart3 } from "lucide-react";

export default function WeeklyHoursWidget() {
  const router = useRouter();

  const hours = [7, 8, 8.5, 6, 8];
  const maxH = Math.max(...hours);
  const days = ["M", "T", "W", "T", "F"];

  return (
    <div
      className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm h-full w-full flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-base font-semibold text-gray-800">Weekly Hours</h3>
        <BarChart3 size={16} className="text-gray-400" />
      </div>

      {/* Big number */}
      <div className="text-3xl font-bold text-gray-900 mt-1">37.5</div>
      <p className="text-xs text-gray-400 mb-4">hours this week</p>

      {/* Bar chart */}
      <div className="flex-1 flex flex-col justify-end">
        <div className="flex items-end gap-2 h-24">
          {hours.map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-[#F2924E] rounded-t-lg relative group cursor-pointer transition-colors hover:bg-[#e07f3f]"
              style={{ height: `${(h / maxH) * 100}%` }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs font-medium py-1 px-2 rounded z-10 whitespace-nowrap shadow-lg">
                {h} hrs
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          ))}
        </div>
        {/* Day labels */}
        <div className="flex gap-2 mt-1.5">
          {days.map((d, i) => (
            <div key={i} className="flex-1 text-xs text-gray-400 text-center">
              {d}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
