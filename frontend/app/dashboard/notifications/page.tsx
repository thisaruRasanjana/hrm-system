"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Search,
  CheckCheck,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Info,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Notification {
  id: number;
  message: string;
  type: "success" | "warning" | "error" | "info";
  is_read: boolean;
  created_at: string;
  link?: string;
}

const TYPE_CONFIG = {
  success: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", border: "border-green-100" },
  warning: { icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-100" },
  error: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
  info: { icon: Info, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
} as const;

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch("/notifications/");
      if (res.ok) setNotifications(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleMarkAllRead = async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "PUT" });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) { console.error(err); }
  };

  const handleMarkRead = async (n: Notification) => {
    if (!n.is_read) {
      try {
        await apiFetch(`/notifications/${n.id}/read`, { method: "PUT" });
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      } catch (err) { console.error(err); }
    }
    if (n.link) router.push(n.link);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const filtered = notifications.filter(n => {
    const matchesSearch = n.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" || !n.is_read;
    return matchesSearch && matchesFilter;
  });

  // Group by date
  const grouped = filtered.reduce<Record<string, Notification[]>>((acc, n) => {
    const label = formatDateLabel(n.created_at);
    if (!acc[label]) acc[label] = [];
    acc[label].push(n);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-1 text-sm text-[#f08a4b] hover:underline w-fit"
      >
        <ChevronLeft size={16} />
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Bell className="text-[#f08a4b]" size={26} />
            Notifications
            {unreadCount > 0 && (
              <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-1 rounded-full">
                {unreadCount} new
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Stay updated with the latest alerts and activities.</p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition shadow-sm"
            >
              <CheckCheck size={16} />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-[#f08a4b] transition"
          />
        </div>
        <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-lg capitalize transition ${filter === f ? "bg-[#f08a4b] text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Notification list */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-[#f08a4b] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 text-sm italic">Loading notifications...</p>
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="py-24 text-center px-6">
            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 text-[#f08a4b]">
              <Bell size={40} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No notifications</h3>
            <p className="text-gray-500 max-w-xs mx-auto text-sm">
              {filter === "unread" ? "You've read everything! Switch to 'All' to see past notifications." : "When important events happen, you'll see them here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {Object.entries(grouped).map(([label, items]) => (
              <div key={label}>
                {/* Date group header */}
                <div className="flex items-center gap-3 px-5 py-3 bg-gray-50/60">
                  <Calendar size={13} className="text-gray-400" />
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</span>
                </div>

                {/* Items */}
                {items.map((n) => {
                  const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
                  const Icon = config.icon;
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleMarkRead(n)}
                      className={`group flex items-start gap-4 px-5 py-4 cursor-pointer transition border-b border-gray-50 last:border-b-0
                        ${!n.is_read ? `${config.bg}` : "bg-white hover:bg-gray-50"}`}
                    >
                      <div className={`mt-0.5 p-2 rounded-xl ${config.bg} ${config.color} shadow-sm`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <p className={`text-sm leading-snug ${!n.is_read ? "font-bold text-gray-900" : "text-gray-600"}`}>
                            {n.message}
                          </p>
                          <span className="text-xs text-gray-400 font-medium shrink-0">{formatTime(n.created_at)}</span>
                        </div>
                        {n.link && (
                          <span className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-bold text-[#f08a4b]">
                            View <ChevronRight size={12} />
                          </span>
                        )}
                      </div>
                      {!n.is_read && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#f08a4b] mt-2 flex-shrink-0 shadow-[0_0_8px_#f08a4b]" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}