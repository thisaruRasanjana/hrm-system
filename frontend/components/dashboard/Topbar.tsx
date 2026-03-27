"use client";

import { Search, Bell, MessageSquare, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import MessagesPanel from "./MessagesPanel";

export default function Topbar() {
  const router = useRouter();
  const [messagesOpen, setMessagesOpen] = useState(false);

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

        <User
          size={22}
          className="cursor-pointer hover:text-[#F2924E] transition"
        />

      </div>

      <MessagesPanel isOpen={messagesOpen} onClose={() => setMessagesOpen(false)} />

    </header>
  );
}