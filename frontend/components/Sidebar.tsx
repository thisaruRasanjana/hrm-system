"use client";

import Link from "next/link";
import {
  IconDashboard,
  IconEmployees,
  IconRecruitment,
  IconLeave,
  IconDocument,
  IconSettings,
} from "./Icons";

const NAV_ITEMS = [
  { label: "Dashboard",           icon: <IconDashboard />,   href: "/dashboard" },
  { label: "Employee Management", icon: <IconEmployees />,   href: "/employees" },
  { label: "Recruitment",         icon: <IconRecruitment />, href: "/recruitment" },
  { label: "Leave",               icon: <IconLeave />,       href: "/leave" },
  { label: "Document",            icon: <IconDocument />,    href: "/document" },
  { label: "Settings",            icon: <IconSettings />,    href: "/settings" },
];

type SidebarProps = {
  /** The pathname of the currently active page, e.g. "/recruitment" */
  activePath: string;
};

export default function Sidebar({ activePath }: SidebarProps) {
  return (
    <aside className="w-56 shrink-0 bg-[#F5F5F5] border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="w-10 h-10 bg-orange-400 rounded-lg flex items-center justify-center text-white font-bold text-sm tracking-wide select-none">
          HR
        </div>
        <div>
          <div className="text-gray-900 font-bold text-base leading-tight">HRMS</div>
          <div className="text-gray-400 text-xs">Management System</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5">
        <p className="text-[10px] text-gray-400 tracking-widest font-semibold uppercase px-2 mb-3">
          Main Menu
        </p>
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = activePath === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "text-orange-500 font-semibold bg-orange-50"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                }`}
              >
                <span className={isActive ? "text-orange-400" : "text-gray-400"}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 text-[11px] text-gray-400 border-t border-gray-200">
        © 2026 HRSM
      </div>
    </aside>
  );
}