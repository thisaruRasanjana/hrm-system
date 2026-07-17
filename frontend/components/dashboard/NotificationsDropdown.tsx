"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Info,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface Notification {
  id: number;
  message: string;
  type: "success" | "warning" | "error" | "info";
  is_read: boolean;
  created_at: string;
  category: string;
  link?: string;
}

const TYPE_CONFIG = {
  success: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  warning: { icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-50" },
  error: { icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  info: { icon: Info, color: "text-blue-600", bg: "bg-blue-50" },
} as const;

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationsDropdown({ isOpen, onClose }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchRecentNotifications();
    }
  }, [isOpen, user]);

  const fetchRecentNotifications = async () => {
    setLoading(true);
    try {
      // Fetch inbox notifications. We only need the top 5.
      const res = await apiFetch("/notifications/?folder=inbox");
      if (res.ok) {
        const data: Notification[] = await res.json();
        // Take the first 5
        setNotifications(data.slice(0, 5));
      }
    } catch (error) {
      console.error("Failed to fetch recent notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      try {
        await apiFetch(`/notifications/${notif.id}/read`, { method: "PUT" });
        // Optionally update local state, but we'll probably just navigate
      } catch (err) {
        console.warn("Failed to mark notification as read", err);
      }
    }
    
    onClose();
    if (notif.link) {
      router.push(notif.link);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={dropdownRef}
      className="absolute right-0 mt-3 w-80 bg-white border border-gray-100 rounded-xl shadow-2xl py-2 z-50 overflow-hidden transform origin-top-right transition-all"
    >
      <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800">Notifications</p>
      </div>
      
      <div className="max-h-[340px] overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="w-5 h-5 border-2 border-[#f08a4b] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <Bell size={24} className="text-gray-300 mb-2" />
            <p className="text-sm text-gray-500 font-medium">No recent notifications</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map((notif) => {
              const conf = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
              const Icon = conf.icon;
              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer transition-colors ${
                    !notif.is_read ? "bg-blue-50/30 hover:bg-blue-50/50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${conf.bg} ${conf.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug break-words ${!notif.is_read ? "font-bold text-gray-900" : "text-gray-700"}`}>
                      {notif.message}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!notif.is_read && (
                    <div className="shrink-0 w-2 h-2 rounded-full bg-[#f08a4b] mt-2"></div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-gray-50 p-2">
        <button
          onClick={() => {
            onClose();
            router.push("/dashboard/notifications");
          }}
          className="w-full py-2 text-center text-sm font-semibold text-[#f08a4b] hover:bg-orange-50 rounded-lg transition"
        >
          View all notifications
        </button>
      </div>
    </div>
  );
}
