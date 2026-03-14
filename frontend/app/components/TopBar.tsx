"use client";

import { Search, Bell, MessageSquare, User } from "lucide-react";

export default function TopBar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-16 border-b border-gray-200">
      <div className="h-full flex items-center">
        {/* ✅ left area same as sidebar */}
        <div className="w-64 h-full bg-[#F3F4F6] border-r border-gray-200" />

        {/* ✅ right area white */}
        <div className="flex-1 h-full bg-white flex items-center justify-between px-10">
          <div className="flex items-center bg-gray-100 px-5 py-2 rounded-full w-[320px]">
            <Search size={18} className="text-gray-400 mr-3" />
            <input
              type="text"
              placeholder="Search"
              className="bg-transparent outline-none w-full text-sm text-gray-600 placeholder-gray-400"
            />
          </div>

          <div className="flex items-center gap-6 text-gray-600">
            <Bell size={20} className="cursor-pointer hover:text-black" />
            <MessageSquare size={20} className="cursor-pointer hover:text-black" />
            <User size={20} className="cursor-pointer hover:text-black" />
          </div>
        </div>
      </div>
    </header>
  );
}