"use client";

import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

const announcements = [
  { title: "Company Holiday - Feb 14", time: "2 days ago", unread: true },
  { title: "New Health Benefits", time: "1 week ago", unread: false },
  { title: "Q1 Performance Review", time: "1 week ago", unread: false },
];

export default function AnnouncementsWidget() {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push("/dashboard/announcements")}
      className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer h-full w-full flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-base font-semibold text-gray-800">Announcements</h3>
        <Bell size={16} className="text-gray-400" />
      </div>

      {/* Items */}
      <div className="space-y-4 flex-1">
        {announcements.map((a, i) => (
          <div key={i} className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-gray-800">{a.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{a.time}</p>
            </div>
            {a.unread && (
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
            )}
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
