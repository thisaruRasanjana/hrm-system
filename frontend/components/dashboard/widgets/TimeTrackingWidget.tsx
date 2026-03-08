"use client";

export default function TimeTrackingWidget() {
  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-sm text-gray-500 mb-2">Time Tracking</h2>

      <div className="text-4xl font-bold text-gray-800">
        0:00:00
      </div>

      <p className="text-sm text-gray-400 mt-2">
        Not clocked in yet
      </p>
    </div>
  );
}