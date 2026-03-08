"use client";

export default function WeeklyHoursWidget() {
  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-sm text-gray-500 mb-2">
        Weekly Hours
      </h2>

      <div className="text-3xl font-bold text-gray-800">
        37.5
      </div>

      <p className="text-sm text-gray-400">
        hours this week
      </p>
    </div>
  );
}