"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDashboard,
  IconEmployees,
  IconRecruitment,
  IconLeave,
  IconDocument,
  IconSettings,
} from "./Icons";
import { FileText, CheckCircle, Inbox, LayoutTemplate, FolderOpen, Send } from "lucide-react";
import { useAuth } from "@/context/auth-context";

const NAV_ITEMS = [
  { label: "Dashboard",            icon: <IconDashboard />,   href: "/dashboard" },
  { label: "Employee\nManagement", icon: <IconEmployees />,   href: "/" },
  { label: "Recruitment",          icon: <IconRecruitment />, href: "/recruitment" },
  { label: "Leave",                icon: <IconLeave />,       href: "/leave" },
  { label: "Settings",             icon: <IconSettings />,    href: "/settings" },
];

const HR_DOC_ITEMS = [
  { label: "Documents",      icon: <FileText size={16} />,       href: "/documents" },
  { label: "Approval",       icon: <CheckCircle size={16} />,    href: "/documents/approval" },
  { label: "Requests",       icon: <Inbox size={16} />,          href: "/documents/request_management" },
  { label: "Templates",      icon: <LayoutTemplate size={16} />, href: "/documents/templates_management" },
  { label: "Document Types", icon: <FolderOpen size={16} />,     href: "/documents/document_types" },
];

const EMP_DOC_ITEMS = [
  { label: "My Documents",      icon: <FileText size={16} />, href: "/employee/documents" },
  { label: "Request Document",  icon: <Send size={16} />,     href: "/employee/documents/request" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = user?.role?.toLowerCase() ?? "";
  const isHR = role.includes("hr") || role.includes("admin") || role.includes("manager");
  const docItems = isHR ? HR_DOC_ITEMS : EMP_DOC_ITEMS;

  return (
    <aside className="w-56 shrink-0 bg-[#F5F5F5] border-r border-gray-200 flex flex-col h-full">
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
      <nav className="flex-1 px-3 py-5 overflow-y-auto">
        <p className="text-[10px] text-gray-400 tracking-widest font-semibold uppercase px-2 mb-3">
          Main Menu
        </p>
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
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
                <span className="whitespace-pre-line leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Document section */}
        <p className="text-[10px] text-gray-400 tracking-widest font-semibold uppercase px-2 mt-5 mb-3">
          Documents
        </p>
        <div className="space-y-0.5">
          {docItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
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
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 text-[11px] text-gray-400 border-t border-gray-200">
        © 2026 HRMS
      </div>
    </aside>
  );
}
