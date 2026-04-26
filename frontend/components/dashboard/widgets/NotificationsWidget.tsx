"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Info, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface Notif {
  id: number;
  message: string;
  type: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: any, color: string, bg: string }> = {
  success: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  warning: { icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-50" },
  error: { icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  info: { icon: Info, color: "text-blue-600", bg: "bg-blue-50" },
};

export default function NotificationsWidget() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await apiFetch("/notifications/recent");
      if (res.ok) setItems(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = items.find(n => n.id === id);
    await apiFetch(`/notifications/${id}/read`, { method: "PUT" });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    if (item?.link) router.push(item.link);
  };

  const markAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await apiFetch("/notifications/read-all", { method: "PUT" });
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition h-full w-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2">
           <h3 className="text-base font-semibold text-gray-800">Notifications</h3>
           {unreadCount > 0 && (
             <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
               {unreadCount} NEW
             </span>
           )}
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button onClick={markAll} className="text-gray-400 hover:text-[#f08a4b] transition" title="Mark all as read">
              <CheckCheck size={16} />
            </button>
          )}
          <Bell size={18} className="text-gray-400" />
        </div>
      </div>

      {/* Notification items */}
      <div className="space-y-3 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-20 text-xs text-gray-400 italic">Loading updates...</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-4">
             <CheckCircle2 size={32} className="text-gray-200 mb-2" />
             <p className="text-xs text-gray-400">All caught up!</p>
          </div>
        ) : (
          items.map((n) => {
            const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
            const Icon = config.icon;
            return (
              <div
                key={n.id}
                onClick={(e) => markRead(n.id, e)}
                className={`p-3 rounded-xl transition cursor-pointer group relative border ${!n.is_read ? `${config.bg} border-transparent shadow-sm` : "bg-white border-gray-50 hover:bg-gray-50"}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-lg ${config.bg} ${config.color}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.is_read ? "font-semibold text-gray-900" : "text-gray-600"}`}>
                      {n.message}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 font-medium">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-[#f08a4b] mt-1.5 shadow-[0_0_8px_#f08a4b]" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-gray-100 flex justify-end">
        <button 
          onClick={() => router.push("/dashboard/notifications")}
          className="text-[#f2924e] text-[10px] font-bold uppercase tracking-wider hover:underline"
        >
          View All
        </button>
      </div>
    </div>
  );
}
