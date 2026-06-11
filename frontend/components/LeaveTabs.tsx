"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth-context";

export default function LeaveTabs() {
  const pathname = usePathname();
  const [activePath, setActivePath] = useState(pathname);
  const { hasPermission } = useAuth();

  // Sync internal state if URL changes externally (e.g. browser back button)
  useEffect(() => {
    setActivePath(pathname);
  }, [pathname]);

  const tabs = [
    { name: "Request Leave", path: "/apply-leave" },
    { name: "Leave History", path: "/leave-history" },
    ...(hasPermission("leave:approve")
      ? [{ name: "Approval panel", path: "/approval" }]
      : []),
    ...(hasPermission("leave:report")
      ? [{ name: "Get Reports", path: "/reports" }]
      : []),
  ];

  return (
    <div
      suppressHydrationWarning
      className="inline-flex w-max bg-white p-1 rounded-full shadow-lg relative mt-1 mb-6"
    >
      {tabs.map((tab) => {
        let active = false;

        if (tab.path === "/apply-leave") {
          active = activePath === tab.path;
        } else {
          active = activePath === tab.path || activePath.startsWith(`${tab.path}/`);
        }

        return (
          <Link
            key={tab.path}
            href={tab.path}
            onClick={() => setActivePath(tab.path)}
            className={`relative px-6 py-2 rounded-full text-sm font-medium transition-colors duration-300 z-10 ${
              active ? "text-white" : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {active && (
              <motion.div
                layoutId="active-leave-tab"
                className="absolute inset-0 bg-[#F2924E] rounded-full -z-10"
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                  mass: 0.5,
                }}
              />
            )}
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}