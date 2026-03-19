"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const tabs = [
  {
    name: "My Document",
    path: "/employee/documents",
  },
  {
    name: "Request Document",
    path: "/employee/documents/request",
  },
];

export default function DocumentTabsEmployee() {
  const pathname = usePathname();

  return (
    <div className="inline-flex bg-white p-1 rounded-full shadow-md border relative">
      {tabs.map((tab) => {
        let active = false;

        if (tab.path === "/employee/documents") {
          active = pathname === tab.path;
        } else {
          active = pathname.startsWith(tab.path);
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
                layoutId="active-emp-tab"
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