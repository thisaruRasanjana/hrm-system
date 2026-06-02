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
  CheckCircle,
  Inbox,
  LayoutTemplate,
  FolderOpen,
  Send,
} from "lucide-react";

import { useAuth } from "@/context/auth-context";

const HR_DOC_LINKS = [
  { name: "My Documents",   path: "/dashboard/documents",                    icon: FileText },
  { name: "Approval",       path: "/dashboard/documents/approval",            icon: CheckCircle },
  { name: "Requests",       path: "/dashboard/documents/request_management",  icon: Inbox },
  { name: "Templates",      path: "/dashboard/documents/templates_management",icon: LayoutTemplate },
  { name: "Doc Types",      path: "/dashboard/documents/document_types",      icon: FolderOpen },
];

const EMP_DOC_LINKS = [
  { name: "My Documents",      path: "/dashboard/employee/documents",         icon: FileText },
  { name: "Request Document",  path: "/dashboard/employee/documents/request", icon: Send },
];

export default function Sidebar() {

  const pathname = usePathname();
  const { hasPermission, hasAnyPermission } = useAuth();

  const isHR = hasAnyPermission(["document:approve", "document:request_manage", "document:template_upload"]);
  const docLinks = isHR ? HR_DOC_LINKS : EMP_DOC_LINKS;
  const inDocSection = pathname.startsWith("/dashboard/documents") || pathname.startsWith("/dashboard/employee/documents");

  const menu = [
    { name: "Dashboard",           path: "/dashboard",                               icon: LayoutGrid },
    { name: "Employee Management", path: "/dashboard/employees",                     icon: Users,     anyPermission: ["employee:view_all", "employee:create", "employee:update", "employee:delete"] },
    { name: "Role Management",     path: "/dashboard/EmployeeManagement/assign-role",icon: Shield,    anyPermission: ["role:view", "role:create", "role:assign"] },
    { name: "Recruitment",         path: "/recruitment",                             icon: Users,     permission: "recruitment:view" },
    { name: "Leave",               path: "/dashboard/leave",                         icon: Calendar,  permission: "leave:request" },
    { name: "Settings",            path: "/dashboard/settings",                      icon: Settings },
  ];

  return (
    <aside className="fixed left-0 top-0 w-[260px] h-screen bg-[#EAEAEA] border-r border-gray-200 flex flex-col px-6 py-8 overflow-y-auto">

      {/* Logo */}
      <div className="flex items-center gap-4 mb-12">
        <div className="w-12 h-12 bg-[#F2924E] text-white flex items-center justify-center rounded-xl font-bold text-lg">HR</div>
        <div>
          <h2 className="font-semibold text-lg text-black">HRMS</h2>
          <p className="text-sm text-gray-500">Management System</p>
        </div>
      </div>

      <p className="text-xs text-gray-500 tracking-wide mb-8">MAIN MENU</p>

      <nav className="flex flex-col gap-7">

        {menu.map((item: any) => {
          if (item.anyPermission && !hasAnyPermission(item.anyPermission)) return null;
          if (item.permission && !hasPermission(item.permission)) return null;

          const Icon = item.icon;
          const active = pathname === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-4 text-[15px] transition ${
                active ? "text-[#F2924E] font-medium" : "text-gray-600 hover:text-[#F2924E]"
              }`}
            >
              <Icon size={20} strokeWidth={1.6} />
              {item.name}
            </Link>
          );
        })}

        {/* Document section */}
        {(hasPermission("document:request_own") || hasPermission("document:upload_own") || isHR) && (
          <div>
            <p className={`flex items-center gap-4 text-[15px] font-medium mb-3 ${inDocSection ? "text-[#F2924E]" : "text-gray-700"}`}>
              <FileText size={20} strokeWidth={1.6} />
              Documents
            </p>
            <div className="flex flex-col gap-3 pl-9">
              {docLinks.map((link) => {
                const SubIcon = link.icon;
                const active = pathname === link.path || pathname.startsWith(`${link.path}/`);
                return (
                  <Link
                    key={link.path}
                    href={link.path}
                    className={`flex items-center gap-3 text-[13px] transition ${
                      active ? "text-[#F2924E] font-medium" : "text-gray-500 hover:text-[#F2924E]"
                    }`}
                  >
                    <SubIcon size={15} strokeWidth={1.6} />
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </nav>

      <div className="mt-auto pt-8 text-xs text-gray-500">© 2026 HRMS</div>

    </aside>
  );
}