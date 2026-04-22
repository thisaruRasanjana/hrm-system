"use client";

import { IconSearch, IconBell, IconMessage, IconUser } from "./Icons";

export default function TopBar() {
  return (
    <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-200 shrink-0">
      {/* Search */}
      <div className="relative w-72">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <IconSearch />
        </span>
        <input
          type="text"
          placeholder="Search"
          className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition"
        />
      </div>

      {/* Action icons */}
      <div className="flex items-center gap-5 text-gray-400">
        <button className="hover:text-gray-600 transition-colors" aria-label="Notifications">
          <IconBell />
        </button>
        <button className="hover:text-gray-600 transition-colors" aria-label="Messages">
          <IconMessage />
        </button>
        <button className="hover:text-gray-600 transition-colors" aria-label="Profile">
          <IconUser />
        </button>
      </div>
    </header>
  );
}