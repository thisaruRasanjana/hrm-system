"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Clock, CheckCircle2, AlertCircle, Info } from "lucide-react";

type NotifType = "success" | "info" | "warning";

interface Notification {
  id: number;
  title: string;
  description: string;
  time: string;
  type: NotifType;
  unread: boolean;
}

const initialNotifications: Notification[] = [
  {
    id: 1,
    title: "Leave Request Approved",
    description: "Your vacation leave request for March 15-20 has been approved by your manager.",
    time: "10 minutes ago",
    type: "success",
    unread: true,
  },
  {
    id: 2,
    title: "Time Sheet Reminder",
    description: "Please submit your timesheet for the week ending February 10, 2026.",
    time: "1 hour ago",
    type: "info",
    unread: true,
  },
  {
    id: 3,
    title: "Pending Approval",
    description: "You have 3 pending approval requests that require your attention.",
    time: "2 hours ago",
    type: "warning",
    unread: true,
  },
  {
    id: 4,
    title: "New Company Policy",
    description: "Updated remote work policy has been published. Please review the changes.",
    time: "5 hours ago",
    type: "info",
    unread: false,
  },
  {
    id: 5,
    title: "Performance Review Completed",
    description: "Your Q4 2025 performance review has been finalized and is now available.",
    time: "1 day ago",
    type: "success",
    unread: false,
  },
  {
    id: 6,
    title: "Training Session Scheduled",
    description: "New employee orientation training is scheduled for March 1st at 2:00 PM.",
    time: "2 days ago",
    type: "info",
    unread: false,
  },
  {
    id: 7,
    title: "Benefits Enrollment Deadline",
    description: "Reminder: Benefits enrollment deadline is approaching on February 28th.",
    time: "3 days ago",
    type: "warning",
    unread: false,
  },
  {
    id: 8,
    title: "Expense Report Approved",
    description: "Your expense report #ER-2026-0145 has been approved and processed.",
    time: "1 week ago",
    type: "success",
    unread: false,
  },
];

const typeConfig: Record<NotifType, { icon: React.ElementType; iconColor: string; bg: string; cardBg: string }> = {
  success: {
    icon: CheckCircle2,
    iconColor: "text-green-600",
    bg: "bg-green-100",
    cardBg: "bg-green-50",
  },
  info: {
    icon: Info,
    iconColor: "text-blue-600",
    bg: "bg-blue-100",
    cardBg: "bg-blue-50",
  },
  warning: {
    icon: AlertCircle,
    iconColor: "text-orange-500",
    bg: "bg-orange-100",
    cardBg: "bg-orange-50",
  },
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const markRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  };

  return (
    <div className="flex flex-col gap-6">

      {/* Back link */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-1 text-sm text-[#F2924E] hover:underline w-fit"
      >
        <ChevronLeft size={16} />
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">All Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">Stay on top of your important updates and alerts.</p>
        </div>

        <div className="flex items-center gap-4">
          {unreadCount > 0 && (
            <span className="bg-orange-100 text-orange-600 border border-orange-300 text-sm font-semibold px-3 py-1.5 rounded-lg">
              {unreadCount} Unread
            </span>
          )}
          <button
            onClick={markAllRead}
            className="text-sm text-gray-600 hover:text-gray-900 font-medium transition"
          >
            Mark All as Read
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div className="flex flex-col gap-3">
        {notifications.map((n) => {
          const cfg = typeConfig[n.type];
          const Icon = cfg.icon;

          return (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition
                ${n.unread
                  ? `${cfg.cardBg} border-transparent`
                  : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
            >
              {/* Icon */}
              <div className={`w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon size={18} className={cfg.iconColor} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{n.description}</p>
                <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                  <Clock size={11} />
                  <span>{n.time}</span>
                </div>
              </div>

              {/* Unread dot */}
              {n.unread && (
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0 mt-2" />
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}