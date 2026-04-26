import { Bell, MessageSquare, User } from "lucide-react";

export default function Navbar() {
  return (
    <div className="h-16 bg-white border-b border-gray-100 shadow-sm flex items-center justify-between px-12 relative z-10">

      <input
        type="text"
        placeholder="Search"
        className="bg-gray-100 px-4 py-2 rounded-lg w-96 outline-none text-sm"
      />

      <div className="flex items-center gap-6 text-gray-600">
        <Bell size={20} />
        <MessageSquare size={20} />
        <User size={20} />
      </div>

    </div>
  );
}
