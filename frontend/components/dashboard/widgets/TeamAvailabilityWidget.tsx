"use client";

export default function TeamAvailabilityWidget() {
  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-sm text-gray-500 mb-4">
        Team Availability
      </h2>

      <ul className="space-y-2 text-sm text-gray-600">
        <li>Sarah J. — Available</li>
        <li>James W. — Available</li>
        <li>Lisa A. — Available</li>
      </ul>
    </div>
  );
}