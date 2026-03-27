"use client";

import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

export default function NotificationsWidget() {
  const router = useRouter();

  const notifications = [
    { text: "Leave request approved", time: "2 hours ago", unread: true },
    { text: "New announcement posted", time: "5 hours ago", unread: true },
    { text: "Timesheet reminder", time: "1 day ago", unread: false },
  ];

  return (
    <div
      onClick={() => router.push("/dashboard/notifications")}
      className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer h-full w-full flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-base font-semibold text-gray-800">Notifications</h3>
        <div className="relative">
          <Bell size={16} className="text-gray-400" />
          <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-[#F2924E] rounded-full" />
        </div>
      </div>

      {/* Notification items */}
      <div className="space-y-3 flex-1">
        {notifications.map((n, i) => (
          <div
            key={i}
            className={`p-3 rounded-xl text-sm ${n.unread ? "bg-orange-50" : "bg-gray-50"}`}
          >
            <div className="flex items-start gap-2">
              {n.unread && (
                <span className="mt-1 w-2 h-2 rounded-full bg-[#F2924E] flex-shrink-0" />
              )}
              <div className={!n.unread ? "pl-4" : ""}>
                <p className="text-gray-800 font-medium leading-snug">{n.text}</p>
                <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <span className="text-[#F2924E] text-sm font-medium">View all</span>
      </div>
    </div>
  );
}
