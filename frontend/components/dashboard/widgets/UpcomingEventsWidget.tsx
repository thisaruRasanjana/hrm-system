"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";

const events = [
  { title: "Team Meeting", time: "Feb 15 - 10:00 AM" },
  { title: "Project Deadline", time: "Feb 20 - 5:00 PM" },
  { title: "Training Session", time: "Feb 25 - 2:00 PM" },
];

export default function UpcomingEventsWidget() {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push("/dashboard/events")}
      className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer h-full w-full flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-base font-semibold text-gray-800">Upcoming Events</h3>
        <CalendarDays size={16} className="text-gray-400" />
      </div>

      {/* Items */}
      <div className="space-y-4 flex-1">
        {events.map((e, i) => (
          <div key={i}>
            <p className="text-sm font-medium text-gray-800">{e.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{e.time}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <span className="text-[#F2924E] text-sm font-medium">View All →</span>
      </div>
    </div>
  );
}
