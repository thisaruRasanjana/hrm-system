"use client";

import { Search, Bell, MessageSquare, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import MessagesPanel from "./MessagesPanel";

export default function Topbar() {
  const router = useRouter();
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch("http://127.0.0.1:8000/auth/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProfileImage(data.profile_image_url);
        }
      } catch (err) {}
    };
    fetchUser();
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
          placeholder="Search"
          className="bg-transparent outline-none text-sm w-full"
        />
      </div>

      {/* Right Icons */}
      <div className="flex items-center gap-7 text-gray-600">

        <Bell
          size={22}
          onClick={() => router.push("/dashboard/notifications")}
          className="cursor-pointer hover:text-[#F2924E] transition"
        />

        <MessageSquare
          size={22}
          onClick={() => setMessagesOpen(true)}
          className="cursor-pointer hover:text-[#F2924E] transition"
        />

        <div className="relative" ref={dropdownRef}>
          <div onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}>
            {profileImage ? (
              <img 
                src={profileImage} 
                alt="Profile" 
                className="w-8 h-8 rounded-full object-cover cursor-pointer border-2 border-transparent hover:border-[#F2924E] transition"
              />
            ) : (
              <User
                size={22}
                className="cursor-pointer hover:text-[#F2924E] transition"
              />
            )}
          </div>
          
          {isProfileDropdownOpen && (
            <div className="absolute right-0 mt-3 w-40 bg-white border border-gray-100 rounded-lg shadow-xl py-2 z-50">
              <button
                onClick={() => {
                  setIsProfileDropdownOpen(false);
                  router.push("/dashboard/settings/profile");
                }}
                className="block w-full text-left px-4 py-2 text-[14px] text-gray-700 hover:bg-orange-50 hover:text-[#F2924E] transition"
              >
                Profile
              </button>
              <button
                onClick={() => {
                  setIsProfileDropdownOpen(false);
                  localStorage.removeItem("access_token");
                  document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                  router.push("/login");
                }}
                className="block w-full text-left px-4 py-2 mt-1 border-t border-gray-100 text-[14px] text-gray-700 hover:bg-orange-50 hover:text-red-500 transition"
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