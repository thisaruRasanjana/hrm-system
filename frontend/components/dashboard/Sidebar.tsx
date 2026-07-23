"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Shield,
  Users,
  Calendar,
  FileText,
  Settings,
} from "lucide-react";

import { useAuth } from "@/context/auth-context";

export default function Sidebar() {

  const pathname = usePathname();
  const { hasPermission, hasAnyPermission } = useAuth();

  const menu = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutGrid },
    { name: "Employee Management", path: "/dashboard/employees", icon: Users, anyPermission: ["employee:view_all", "employee:create", "employee:update", "employee:delete"] },
    { name: "Role Management", path: "/dashboard/EmployeeManagement/assign-role", icon: Shield, anyPermission: ["role:view", "role:create", "role:assign"] },
    { name: "Recruitment", path: "/recruitment", icon: Users, anyPermission: ["recruitment:view", "recruitment:manage", "recruitment:interview_panel"], activePrefixes: ["/recruitment"] },
    {
      name: "Leave", path: "/apply-leave", icon: Calendar,
      anyPermission: ["leave:request", "leave:approve"],
      activePrefixes: ["/apply-leave", "/leave-history", "/approval", "/reports", "/leave-settings"]
    },
    {
      name: "Documents", path: "/dashboard/documents", icon: FileText,
      anyPermission: ["document:upload_own", "document:request_own", "document:approve", "document:request_manage", "document:template_upload", "document:type_manage"],
      activePrefixes: ["/dashboard/documents", "/dashboard/employee/documents"]
    },
    { name: "Settings", path: "/dashboard/settings", icon: Settings, activePrefixes: ["/dashboard/settings", "/settings"] },
  ];

  return (
    <aside className="fixed left-0 top-0 w-[260px] h-screen bg-[#EAEAEA] border-r border-gray-200 flex flex-col px-6 py-8 overflow-y-auto">

      {/* Logo */}
      <div className="flex items-center gap-3 mb-12">
        <div className="w-10 h-10 bg-gradient-to-br from-[#F2924E] to-[#E37A32] text-white flex items-center justify-center rounded-xl shadow-sm border border-[#F2924E]/50">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
          </svg>
        </div>
        <div className="flex flex-col">
          <h2 className="font-bold text-[19px] text-gray-900 tracking-tight leading-none">CoreHR</h2>
          <p className="text-[10px] text-[#F2924E] font-bold tracking-[0.15em] uppercase mt-1">Workspace</p>
        </div>
      </div>

      <p className="text-xs text-gray-500 tracking-wide mb-8">MAIN MENU</p>

      <nav className="flex flex-col gap-7">

        {menu.map((item: any) => {
          if (item.anyPermission && !hasAnyPermission(item.anyPermission)) return null;
          if (item.permission && !hasPermission(item.permission)) return null;

          const Icon = item.icon;
          const active = item.activePrefixes
            ? item.activePrefixes.some((p: string) => pathname === p || pathname.startsWith(`${p}/`))
            : pathname === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-4 text-[15px] transition ${active ? "text-[#F2924E] font-medium" : "text-gray-600 hover:text-[#F2924E]"
                }`}
            >
              <Icon size={20} strokeWidth={1.6} />
              {item.name}
            </Link>
          );
        })}

      </nav>

      <div className="mt-auto pt-8 text-xs text-gray-500">© 2026 HRMS</div>

    </aside>
  );
}