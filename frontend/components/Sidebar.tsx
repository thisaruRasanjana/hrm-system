"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutGrid,
  Shield,
  UserPlus,
  CalendarDays,
  FileText,
  Settings,
} from "lucide-react";

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  roles?: string[]; // if defined, only these roles can see the item
};

const navItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutGrid },
  {
    name: "Employee Management",
    href: "/employees",
    icon: Shield,
    roles: ["hr", "manager"],
  },
  {
    name: "Recruitment",
    href: "/recruitment",
    icon: UserPlus,
    roles: ["hr", "manager"],
  },
  { name: "Leave", href: "/apply-leave", icon: CalendarDays },
  { name: "Document", href: "/documents", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

const leaveRelatedPaths = ["/apply-leave", "/leave-history", "/approval", "/reports"];

export default function Sidebar() {
  const pathname = usePathname() || "/";
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(localStorage.getItem("role"));
  }, []);

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true; // visible to everyone
    return role !== null && item.roles.includes(role);
  });

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
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.name === "Leave"
              ? leaveRelatedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))
              : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${isActive
                  ? "text-orange-500"
                  : "text-gray-600 hover:bg-white/70"
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
        © 2026 HRMS
      </div>
    </aside>
  );
}