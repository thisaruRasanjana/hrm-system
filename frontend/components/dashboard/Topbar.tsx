"use client";

import { Search, Bell, MessageSquare, User, CornerDownLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import MessagesPanel from "./MessagesPanel";
import NotificationsDropdown from "./NotificationsDropdown";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";

/**
 * Everything the search can jump to. Each entry is gated by the same permission
 * model as the sidebar, so users only ever see pages they actually have.
 */
type SearchItem = {
  name: string;
  path: string;
  group: string;
  keywords?: string;
  permission?: string;
  anyPermission?: string[];
};

const SEARCH_CATALOG: SearchItem[] = [
  // General
  { name: "Dashboard", path: "/dashboard", group: "General", keywords: "home overview" },
  { name: "Notifications", path: "/dashboard/notifications", group: "General", keywords: "alerts" },

  // People
  { name: "Employee Management", path: "/dashboard/employees", group: "People", keywords: "staff people directory",
    anyPermission: ["employee:view_all", "employee:create", "employee:update", "employee:delete"] },
  { name: "Role Management", path: "/dashboard/EmployeeManagement/assign-role", group: "People", keywords: "roles permissions assign access",
    anyPermission: ["role:view", "role:create", "role:assign"] },
  { name: "Recruitment", path: "/recruitment", group: "People", keywords: "hiring candidates vacancy jobs interview",
    anyPermission: ["recruitment:view", "recruitment:manage", "recruitment:interview_panel"] },

  // Leave
  { name: "Apply for Leave", path: "/apply-leave", group: "Leave", keywords: "request time off vacation", permission: "leave:request" },
  { name: "Leave History", path: "/leave-history", group: "Leave", keywords: "my leave past", permission: "leave:request" },
  { name: "Leave Approvals", path: "/approval", group: "Leave", keywords: "approve pending requests", permission: "leave:approve" },

  // Documents
  { name: "My Documents", path: "/dashboard/documents", group: "Documents", keywords: "files uploads", permission: "document:upload_own" },
  { name: "Request a Document", path: "/dashboard/documents/request", group: "Documents", keywords: "letter request", permission: "document:request_own" },
  { name: "Approval Management", path: "/dashboard/documents/approval", group: "Documents", keywords: "approve review documents", permission: "document:approve" },
  { name: "Request Management", path: "/dashboard/documents/request_management", group: "Documents", keywords: "external requests letters generate", permission: "document:request_manage" },
  { name: "Template Management", path: "/dashboard/documents/templates_management", group: "Documents", keywords: "templates", permission: "document:template_upload" },
  { name: "Document Types", path: "/dashboard/documents/document_types", group: "Documents", keywords: "categories types", permission: "document:type_manage" },

  // Settings (available to everyone)
  { name: "Profile Settings", path: "/dashboard/settings/profile", group: "Settings", keywords: "account personal information avatar name" },
  { name: "Security Settings", path: "/dashboard/settings/security", group: "Settings", keywords: "password two factor 2fa sessions" },
  { name: "Notification Settings", path: "/dashboard/settings/notifications", group: "Settings", keywords: "email alerts quiet hours" },
];

export default function Topbar() {
  const router = useRouter();
  const { user, logout, loading: authLoading, hasPermission, hasAnyPermission } = useAuth();
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // ── Global search ────────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  // Only the destinations this user is actually allowed to open
  const allowedItems = useMemo(
    () =>
      SEARCH_CATALOG.filter((item) => {
        if (item.permission && !hasPermission(item.permission)) return false;
        if (item.anyPermission && !hasAnyPermission(item.anyPermission)) return false;
        return true;
      }),
    [hasPermission, hasAnyPermission]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/);
    return allowedItems
      .filter((item) => {
        const haystack = `${item.name} ${item.group} ${item.keywords ?? ""}`.toLowerCase();
        return terms.every((t) => haystack.includes(t));
      })
      .slice(0, 8);
  }, [query, allowedItems]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Fetch unread notifications count periodically and on events
  useEffect(() => {
    if (!user) return;
    
    const fetchUnreadCount = async () => {
      try {
        const res = await apiFetch("/notifications/unread-count");
        if (res.ok) {
          const data = await res.json();
          if (typeof data.count === "number") setUnreadNotifs(data.count);
        }
      } catch (err) {
        console.warn("Failed to fetch unread notifications count", err);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // 30s polling
    window.addEventListener("notificationsUpdated", fetchUnreadCount);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("notificationsUpdated", fetchUnreadCount);
    };
  }, [user]);

  const goToResult = (item?: SearchItem) => {
    if (!item) return;
    router.push(item.path);
    setQuery("");
    setSearchOpen(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      goToResult(results[activeIndex]);
    } else if (e.key === "Escape") {
      setSearchOpen(false);
    }
  };

  const profileImage = user?.profile_image_url ?? null;
  const initials = `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?";

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
    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6 sticky top-0 z-20">

      {/* Search Bar */}
      <div className="relative w-[360px]" ref={searchRef}>
        <div className="flex items-center bg-gray-100 rounded-lg px-4 py-2">
          <Search size={18} className="text-gray-500 mr-2" />
          <input
            type="text"
            value={query}
            placeholder="Search pages, settings, documents..."
            onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            className="bg-transparent outline-none text-sm w-full text-gray-700"
          />
        </div>

        {searchOpen && query.trim() && (
          <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl py-2 z-50 overflow-hidden max-h-[420px] overflow-y-auto">
            {results.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">
                No matches for “{query.trim()}”.
              </p>
            ) : (
              results.map((item, idx) => (
                <button
                  key={item.path}
                  onMouseDown={(e) => { e.preventDefault(); goToResult(item); }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex items-center justify-between w-full text-left px-4 py-2.5 transition ${
                    idx === activeIndex ? "bg-orange-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${idx === activeIndex ? "text-[#f08a4b]" : "text-gray-800"}`}>
                      {item.name}
                    </p>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{item.group}</p>
                  </div>
                  {idx === activeIndex && <CornerDownLeft size={14} className="text-[#f08a4b] shrink-0 ml-3" />}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Right Icons */}
      <div className="flex items-center gap-7 text-gray-600">

        <div className="relative cursor-pointer group" ref={notifRef}>
          <div onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}>
            <Bell size={22} className={`transition ${isNotificationsOpen ? 'text-[#f08a4b]' : 'group-hover:text-[#f08a4b]'}`} />
            {unreadNotifs > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#f08a4b] text-white text-[11px] font-bold min-w-[20px] h-[20px] px-1 flex items-center justify-center rounded-full border-[2px] border-white shadow-sm">
                {unreadNotifs > 9 ? "9+" : unreadNotifs}
              </span>
            )}
          </div>
          <NotificationsDropdown 
            isOpen={isNotificationsOpen} 
            onClose={() => setIsNotificationsOpen(false)} 
          />
        </div>

        <div className="relative cursor-pointer group" onClick={() => { setMessagesOpen(true); setUnreadMessages(0); }}>
          <MessageSquare
            size={22}
            className="group-hover:text-[#f08a4b] transition"
          />
          {unreadMessages > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-[#f08a4b] text-white text-[11px] font-bold min-w-[20px] h-[20px] px-1 flex items-center justify-center rounded-full border-[2px] border-white shadow-sm">
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
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