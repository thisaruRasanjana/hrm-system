"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth-context";

const ALL_TABS = [
  { name: "My Documents",        suffix: "",                    permission: "document:upload_own" },
  { name: "Request Document",    suffix: "/request",            permission: "document:request_own" },
  { name: "Approval Management", suffix: "/approval",           permission: "document:approve" },
  { name: "Employee Documents",  suffix: "/employee_documents", permission: "document:view_employee_docs" },
  { name: "Request Management",  suffix: "/request_management", permission: "document:request_manage" },
  { name: "Template Management", suffix: "/templates_management", permission: "document:template_upload" },
  { name: "Document Types",      suffix: "/document_types",    permission: "document:type_manage" },
];

export default function DocumentTabsHR() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const base = pathname.startsWith("/dashboard") ? "/dashboard/documents" : "/documents";

  const visibleTabs = ALL_TABS
    .filter((t) => hasPermission(t.permission))
    .map((t) => ({ name: t.name, path: `${base}${t.suffix}` }));

  return (
    <div className="inline-flex gap-1 bg-white/80 backdrop-blur-md p-1.5 rounded-full shadow-xl border border-gray-100 w-fit">
      {visibleTabs.map((tab) => {
        let active = false;

        if (tab.path === base) {
          active = pathname === tab.path;
        } else {
          active = pathname === tab.path || pathname.startsWith(`${tab.path}/`);
        }

        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors duration-300 z-10 whitespace-nowrap ${active ? "text-white" : "text-gray-600 hover:text-gray-800"
              }`}
          >
            {active && (
              <motion.div
                layoutId="active-hr-tab"
                className="absolute inset-0 bg-[#F2924E] rounded-full -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.4 }}
              />
            )}
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
