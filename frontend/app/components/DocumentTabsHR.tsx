"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const DOC_TABS = [
  { name: "My Document",        suffix: "" },
  { name: "Approval",           suffix: "/approval" },
  { name: "Request Management", suffix: "/request_management" },
  { name: "Templates",          suffix: "/templates_management" },
  { name: "Document Types",     suffix: "/document_types" },
];

export default function DocumentTabsHR() {
  const pathname = usePathname();
  const base = pathname.startsWith("/dashboard") ? "/dashboard/documents" : "/documents";

  const tabs = DOC_TABS.map((t) => ({ name: t.name, path: `${base}${t.suffix}` }));

  return (
    <div className="inline-flex flex-wrap gap-1 bg-white/80 backdrop-blur-md p-1.5 rounded-full shadow-xl border border-gray-100 relative">
      {tabs.map((tab) => {
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
            className={`relative px-6 py-2 rounded-full text-sm font-medium transition-colors duration-300 z-10 ${active ? "text-white" : "text-gray-600 hover:text-gray-800"
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