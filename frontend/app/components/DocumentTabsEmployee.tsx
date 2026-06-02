"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const EMP_TABS = [
  { name: "My Document",     suffix: "" },
  { name: "Request Document", suffix: "/request" },
];

export default function DocumentTabsEmployee() {
  const pathname = usePathname();
  const base = pathname.startsWith("/dashboard")
    ? "/dashboard/employee/documents"
    : "/employee/documents";

  const tabs = EMP_TABS.map((t) => ({ name: t.name, path: `${base}${t.suffix}` }));

  return (
    <div className="inline-flex w-max bg-white p-1 rounded-full shadow-lg border border-gray-100 relative">
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
            className={`relative px-6 py-2 rounded-full text-sm font-medium transition-colors duration-300 z-10 ${
              active ? "text-white" : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {active && (
              <motion.div
                layoutId="active-employee-tab"
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