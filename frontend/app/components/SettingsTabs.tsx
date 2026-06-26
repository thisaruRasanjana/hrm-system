"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const TABS = [
  { name: "Profile", href: "/dashboard/settings/profile" },
  { name: "Security", href: "/dashboard/settings/security" },
  { name: "Notifications", href: "/dashboard/settings/notifications" },
];

export default function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div className="inline-flex gap-1 bg-white/80 backdrop-blur-md p-1.5 rounded-full shadow-xl border border-gray-100 w-fit">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors duration-300 z-10 whitespace-nowrap ${active ? "text-white" : "text-gray-600 hover:text-gray-800"
              }`}
          >
            {active && (
              <motion.div
                layoutId="active-settings-tab"
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
