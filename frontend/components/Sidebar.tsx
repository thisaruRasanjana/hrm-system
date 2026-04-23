"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Shield,
  UserPlus,
  CalendarDays,
  FileText,
  Settings,
} from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutGrid },
  { name: "Employee Management", href: "/employees", icon: Shield },
  { name: "Recruitment", href: "/recruitment", icon: UserPlus },
  { name: "Leave", href: "/apply-leave", icon: CalendarDays },
  { name: "Document", href: "/document", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname() || "/";

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-64 bg-[#F3F4F6] border-r border-gray-200 z-50">
      {/* Logo section */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center text-white font-bold">
            HR
          </div>

          <div className="leading-tight">
            <div className="text-lg font-semibold text-gray-900">HRMS</div>
            <div className="text-xs text-gray-500">Management System</div>
          </div>
        </div>
      </div>

      {/* MAIN MENU title */}
      <div className="px-6 text-xs font-semibold text-gray-400 mb-3">
        MAIN MENU
      </div>

      {/* Navigation */}
      <nav className="px-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.name === "Leave"
              ? pathname === "/apply-leave" ||
              pathname === "/leave-history" ||
              pathname === "/approval" ||
              pathname === "/reports"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${isActive ? "text-orange-500" : "text-gray-600 hover:bg-white/70"
                }`}
            >
              <Icon
                size={20}
                className={isActive ? "text-orange-500" : "text-gray-500"}
              />
              <span className={isActive ? "font-medium" : ""}>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 w-full px-6 text-xs text-gray-400">
        © 2026 HRSM
      </div>
    </aside>
  );

  const role = localStorage.getItem("role");

  <ul>
    <li><Link href="/apply-leave">Apply Leave</Link></li>
    <li><Link href="/leave-history">Leave History</Link></li>

    {role !== "employee" && (
      <li><Link href="/approval">Approval</Link></li>
    )}

    {role === "hr" && (
      <li><Link href="/reports">Reports</Link></li>
    )}
  </ul>
}