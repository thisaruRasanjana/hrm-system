"use client";

import { Search, Bell, MessageSquare, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import MessagesPanel from "./MessagesPanel";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";

export default function Topbar() {
  const router = useRouter();
  const { user, logout, loading: authLoading } = useAuth();
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const profileImage = user?.profile_image_url ?? null;
  const initials = `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?";

  const fetchUnreadCount = async () => {
    try {
      const res = await apiFetch("/notifications/recent");
      if (res.ok) {
        const data = await res.json();
        setUnreadNotifs(data.filter((n: any) => !n.is_read).length);
      }
    } catch (err) {}
  };

  const fetchUnreadMessages = async () => {
    try {
      const res = await apiFetch("/messages/inbox");
      if (res.ok) {
        const data = await res.json();
        setUnreadMessages(data.filter((m: any) => !m.is_read).length);
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchUnreadCount();
    fetchUnreadMessages();
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchUnreadMessages();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6 sticky top-0 z-20">

      {/* Search Bar */}
      <div className="flex items-center bg-gray-100 rounded-lg px-4 py-2 w-[360px]">
        <Search size={18} className="text-gray-500 mr-2" />
        <input
          type="text"
          placeholder="Search for something..."
          className="bg-transparent outline-none text-sm w-full text-gray-700"
        />
      </div>

      {/* Right Icons */}
      <div className="flex items-center gap-7 text-gray-600">

        <div className="relative cursor-pointer group" onClick={() => router.push("/dashboard/notifications")}>
          <Bell size={22} className="group-hover:text-[#f08a4b] transition" />
          {unreadNotifs > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white animate-pulse">
              {unreadNotifs > 9 ? "9+" : unreadNotifs}
            </span>
          )}
        </div>

        <div className="relative cursor-pointer" onClick={() => { setMessagesOpen(true); setUnreadMessages(0); }}>
          <MessageSquare
            size={22}
            className="hover:text-[#f08a4b] transition"
          />
          {unreadMessages > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#f08a4b] rounded-full border-2 border-white animate-pulse" />
          )}
        </div>

        <div className="relative" ref={dropdownRef}>
          <div onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)} className="cursor-pointer">
            {authLoading ? (
              <div className="skeleton-shimmer w-9 h-9 rounded-full" aria-hidden="true" />
            ) : profileImage ? (
              <img 
                src={profileImage} 
                alt="Profile" 
                className="w-9 h-9 rounded-full object-cover border-2 border-transparent hover:border-[#f08a4b] transition shadow-sm"
              />
            ) : (
              <div className="w-9 h-9 bg-[#f08a4b] text-white rounded-full flex items-center justify-center font-bold text-sm hover:opacity-90 transition shadow-sm">
                {initials}
              </div>
            )}
          </div>
          
          {isProfileDropdownOpen && (
            <div className="absolute right-0 mt-3 w-44 bg-white border border-gray-100 rounded-xl shadow-2xl py-2 z-50 overflow-hidden transform origin-top-right transition-all">
              <div className="px-4 py-2 border-b border-gray-50">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Account</p>
                <p className="text-sm font-bold text-gray-800 truncate">{user?.first_name} {user?.last_name}</p>
              </div>
              <button
                onClick={() => {
                  setIsProfileDropdownOpen(false);
                  router.push("/dashboard/settings/profile");
                }}
                className="block w-full text-left px-4 py-2.5 text-[14px] text-gray-700 hover:bg-orange-50 hover:text-[#f08a4b] transition font-medium"
              >
                Profile Settings
              </button>
              <button
                onClick={() => {
                  setIsProfileDropdownOpen(false);
                  logout();
                }}
                className="block w-full text-left px-4 py-2.5 mt-1 border-t border-gray-50 text-[14px] text-red-500 hover:bg-red-50 transition font-medium"
              >
                Log out
              </button>
            </div>
          )}
        </div>

      </div>

      <MessagesPanel isOpen={messagesOpen} onClose={() => setMessagesOpen(false)} />

    </header>
  );
}