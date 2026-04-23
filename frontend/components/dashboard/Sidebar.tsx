"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Shield,
  Users,
  Calendar,
  FileText,
  Settings
} from "lucide-react";

export default function Sidebar() {

  const pathname = usePathname();

  const menu = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutGrid },
    { name: "Employee Management", path: "/dashboard/employees", icon: Shield },
    { name: "Recruitment", path: "/dashboard/recruitment", icon: Users },
    { name: "Leave", path: "/dashboard/leave", icon: Calendar },
    { name: "Document", path: "/dashboard/documents", icon: FileText },
    { name: "Settings", path: "/dashboard/settings", icon: Settings }
  ];

  return (
    <aside className="fixed left-0 top-0 w-[260px] h-screen bg-[#EAEAEA] border-r border-gray-200 flex flex-col px-6 py-8">

      {/* Logo */}
      <div className="flex items-center gap-4 mb-12">

        <div className="w-12 h-12 bg-[#F2924E] text-white flex items-center justify-center rounded-xl font-bold text-lg">
          HR
        </div>

        <div>
          <h2 className="font-semibold text-lg text-black">HRMS</h2>
          <p className="text-sm text-gray-500">Management System</p>
        </div>

      </div>

      <p className="text-xs text-gray-500 tracking-wide mb-8">
        MAIN MENU
      </p>

      <nav className="flex flex-col gap-7">

        {menu.map((item) => {

          const Icon = item.icon;
          const active = pathname === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-4 text-[15px] transition
              ${active
                ? "text-[#F2924E] font-medium"
                : "text-gray-600 hover:text-[#F2924E]"
              }`}
            >
              <Icon size={20} strokeWidth={1.6} />
              {item.name}
            </Link>
          );

        })}

      </nav>

      <div className="mt-auto text-xs text-gray-500">
        © 2026 HRMS
      </div>

    </aside>
  );
}