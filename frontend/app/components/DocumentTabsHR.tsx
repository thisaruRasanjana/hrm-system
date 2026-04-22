"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const tabs = [
  { name: "My Document", path: "/documents" },
  { name: "Request Document", path: "/documents/request" },
  { name: "Approval Document", path: "/documents/approval" },
  { name: "Template Management", path: "/documents/templates_management" },
  { name: "Request Management", path: "/documents/request_management" },
  { name: "Document Types", path: "/documents/document_types" },
];

export default function DocumentTabsHR() {
  const pathname = usePathname();

  return (
    <div className="inline-flex w-max bg-white p-1 rounded-full shadow-md border relative">
      {tabs.map((tab) => {
        let active = false;

        if (tab.path === "/documents") {
          // Only exact match
          active = pathname === tab.path;
        } else {
          // Match exact path or sub-routes with trailing slash
          active = pathname === tab.path || pathname.startsWith(`${tab.path}/`);
        }

        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`relative px-6 py-2 rounded-full text-sm font-medium transition-colors duration-300 z-10 ${
              active ? "text-white" : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {active && (
              <motion.div
                layoutId="active-hr-tab"
                className="absolute inset-0 bg-[#F2924E] rounded-full -z-10"
                transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.5 }}
              />
            )}
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}