"use client";

import { Search, Bell, MessageSquare, User } from "lucide-react";

export default function Topbar() {
  return (
    <div className="w-full h-16 bg-white border-b flex items-center justify-between px-6">

      {/* Search Bar */}
      <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 w-[350px]">
        <Search size={18} className="text-gray-500 mr-2" />
        <input
          type="text"
          placeholder="Search"
          className="bg-transparent outline-none text-sm w-full"
        />
      </div>

      {/* Icons */}
      <div className="flex items-center gap-6 text-gray-600">

        <Bell size={22} className="cursor-pointer hover:text-[#F2924E]" />

        <MessageSquare size={22} className="cursor-pointer hover:text-[#F2924E]" />

        <User size={22} className="cursor-pointer hover:text-[#F2924E]" />

      </div>

    </div>
  );
}